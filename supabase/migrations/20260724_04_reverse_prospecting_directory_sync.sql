begin;

-- ============================================================
-- REVERSE-PROSPECTING CONTACT DIRECTORY SYNCHRONIZATION
-- ============================================================

create or replace function
  public.sync_reverse_prospecting_contact_directory(
    p_batch_id uuid,
    p_requester_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_row record;

  affected_rows integer := 0;

  contacts_updated integer := 0;
  reviews_created integer := 0;
  reviews_resolved integer := 0;

  ready_contacts integer := 0;
  contacts_needing_review integer := 0;
begin
  select
    batch.id,
    batch.org_id,
    batch.owner_user_id,
    batch.listing_id
  into batch_row
  from public.mls_reverse_prospecting_batches
    as batch
  where batch.id =
    p_batch_id;

  if not found then
    raise exception
      'Reverse-prospecting batch was not found.';
  end if;

  if not exists (
    select 1
    from public.profiles
      as profile
    where profile.id =
      p_requester_id
      and (
        profile.role =
          'platform_admin'
        or profile.org_id =
          batch_row.org_id
      )
  ) then
    raise exception
      'Requester cannot synchronize this contact directory batch.';
  end if;

  -- Fill only blank directory fields. Existing values are never
  -- overwritten. MLS user IDs are assigned only when no other
  -- contact in the organization already owns the same ID.

  with latest_match as (
    select distinct on (
      match_row.contact_id
    )
      match_row.contact_id,
      match_row.org_id,

      nullif(
        regexp_replace(
          btrim(
            coalesce(
              match_row.agent_company,
              ''
            )
          ),
          '\s+',
          ' ',
          'g'
        ),
        ''
      ) as agent_company,

      nullif(
        btrim(
          coalesce(
            match_row.external_agent_id,
            ''
          )
        ),
        ''
      ) as mls_agent_id,

      nullif(
        btrim(
          coalesce(
            match_row.external_office_id,
            ''
          )
        ),
        ''
      ) as mls_office_id

    from public.listing_realtor_matches
      as match_row

    where match_row.batch_id =
        p_batch_id
      and match_row.contact_id
        is not null
      and match_row.is_active =
        true

    order by
      match_row.contact_id,
      match_row.last_matched_at
        desc nulls last,
      match_row.created_at
        desc
  ),

  safe_match as (
    select
      latest_match.*,

      case
        when latest_match.mls_agent_id
          is null then
          false

        when exists (
          select 1
          from public.contacts
            as other_contact
          where other_contact.org_id =
              latest_match.org_id
            and other_contact.id <>
              latest_match.contact_id
            and other_contact.mls_agent_id =
              latest_match.mls_agent_id
        ) then
          false

        when (
          select count(
            distinct duplicate_match.contact_id
          )
          from public.listing_realtor_matches
            as duplicate_match
          where duplicate_match.batch_id =
              p_batch_id
            and duplicate_match.contact_id
              is not null
            and nullif(
              btrim(
                coalesce(
                  duplicate_match.external_agent_id,
                  ''
                )
              ),
              ''
            ) =
              latest_match.mls_agent_id
        ) > 1 then
          false

        else
          true
      end as can_assign_mls_agent_id

    from latest_match
  )

  update public.contacts
    as contact_row

  set
    company =
      case
        when contact_row.company
          is null then
          safe_match.agent_company

        else
          contact_row.company
      end,

    mls_agent_id =
      case
        when contact_row.mls_agent_id
          is null
          and safe_match.can_assign_mls_agent_id then
          safe_match.mls_agent_id

        else
          contact_row.mls_agent_id
      end,

    mls_office_id =
      case
        when contact_row.mls_office_id
          is null then
          safe_match.mls_office_id

        else
          contact_row.mls_office_id
      end,

    last_enriched_at =
      now(),

    last_enrichment_source =
      'reverse_prospecting_import'

  from safe_match

  where contact_row.id =
      safe_match.contact_id
    and contact_row.org_id =
      batch_row.org_id
    and (
      (
        contact_row.company is null
        and safe_match.agent_company
          is not null
      )
      or (
        contact_row.mls_agent_id
          is null
        and safe_match.mls_agent_id
          is not null
        and safe_match.can_assign_mls_agent_id
      )
      or (
        contact_row.mls_office_id
          is null
        and safe_match.mls_office_id
          is not null
      )
    );

  get diagnostics
    contacts_updated =
      row_count;

  -- Resolve missing-field reviews when the field is now present.

  update public.contact_enrichment_reviews
    as review_row

  set
    status =
      'resolved',

    resolved_by =
      p_requester_id,

    resolved_at =
      now(),

    updated_at =
      now()

  from public.contacts
    as contact_row

  where review_row.contact_id =
      contact_row.id
    and review_row.status =
      'pending'
    and exists (
      select 1
      from public.listing_realtor_matches
        as match_row
      where match_row.batch_id =
          p_batch_id
        and match_row.contact_id =
          contact_row.id
    )
    and (
      (
        review_row.issue_type =
          'missing_brokerage'
        and contact_row.company
          is not null
      )
      or (
        review_row.issue_type =
          'missing_phone'
        and nullif(
          btrim(
            coalesce(
              contact_row.phone,
              ''
            )
          ),
          ''
        ) is not null
      )
    );

  get diagnostics
    affected_rows =
      row_count;

  reviews_resolved :=
    reviews_resolved +
    affected_rows;

  -- Resolve match-level problems when the match is now linked or
  -- the stored value now agrees with the imported value.

  update public.contact_enrichment_reviews
    as review_row

  set
    status =
      'resolved',

    resolved_by =
      p_requester_id,

    resolved_at =
      now(),

    updated_at =
      now()

  from public.listing_realtor_matches
    as match_row

  left join public.contacts
    as contact_row
    on contact_row.id =
      match_row.contact_id

  where review_row.realtor_match_id =
      match_row.id
    and review_row.status =
      'pending'
    and match_row.batch_id =
      p_batch_id
    and (
      (
        review_row.issue_type in (
          'unlinked_match',
          'email_conflict'
        )
        and match_row.contact_id
          is not null
      )
      or (
        review_row.issue_type =
          'brokerage_conflict'
        and contact_row.company_normalized =
          nullif(
            lower(
              regexp_replace(
                btrim(
                  coalesce(
                    match_row.agent_company,
                    ''
                  )
                ),
                '\s+',
                ' ',
                'g'
              )
            ),
            ''
          )
      )
      or (
        review_row.issue_type =
          'mls_id_conflict'
        and contact_row.mls_agent_id =
          nullif(
            btrim(
              match_row.external_agent_id
            ),
            ''
          )
      )
    );

  get diagnostics
    affected_rows =
      row_count;

  reviews_resolved :=
    reviews_resolved +
    affected_rows;

  -- Missing phone: one pending review per contact is enough.

  insert into public.contact_enrichment_reviews (
    org_id,
    owner_user_id,
    contact_id,
    listing_id,
    realtor_match_id,
    issue_type,
    field_name,
    current_value,
    proposed_value,
    source,
    confidence,
    details,
    created_by
  )

  select distinct on (
    contact_row.id
  )
    contact_row.org_id,
    contact_row.owner_user_id,
    contact_row.id,
    match_row.listing_id,
    match_row.id,
    'missing_phone',
    'phone',
    contact_row.phone,
    null,
    'reverse_prospecting_import',
    100,

    jsonb_build_object(
      'reason',
      'The linked Realtor contact has no cell or home phone stored.'
    ),

    p_requester_id

  from public.listing_realtor_matches
    as match_row

  join public.contacts
    as contact_row
    on contact_row.id =
      match_row.contact_id

  where match_row.batch_id =
      p_batch_id
    and match_row.is_active =
      true
    and nullif(
      btrim(
        coalesce(
          contact_row.phone,
          ''
        )
      ),
      ''
    ) is null
    and not exists (
      select 1
      from public.contact_enrichment_reviews
        as existing_review
      where existing_review.contact_id =
          contact_row.id
        and existing_review.issue_type =
          'missing_phone'
        and existing_review.status =
          'pending'
    )

  order by
    contact_row.id,
    match_row.last_matched_at
      desc nulls last,
    match_row.created_at
      desc

  on conflict do nothing;

  get diagnostics
    affected_rows =
      row_count;

  reviews_created :=
    reviews_created +
    affected_rows;

  -- Missing brokerage: preserve existing legacy review items and
  -- create a new one only when none is already pending.

  insert into public.contact_enrichment_reviews (
    org_id,
    owner_user_id,
    contact_id,
    listing_id,
    realtor_match_id,
    issue_type,
    field_name,
    current_value,
    proposed_value,
    source,
    confidence,
    details,
    created_by
  )

  select distinct on (
    contact_row.id
  )
    contact_row.org_id,
    contact_row.owner_user_id,
    contact_row.id,
    match_row.listing_id,
    match_row.id,
    'missing_brokerage',
    'company',
    contact_row.company,
    match_row.agent_company,
    'reverse_prospecting_import',
    100,

    jsonb_build_object(
      'reason',
      'The linked Realtor contact still has no verified brokerage.'
    ),

    p_requester_id

  from public.listing_realtor_matches
    as match_row

  join public.contacts
    as contact_row
    on contact_row.id =
      match_row.contact_id

  where match_row.batch_id =
      p_batch_id
    and match_row.is_active =
      true
    and contact_row.company
      is null
    and not exists (
      select 1
      from public.contact_enrichment_reviews
        as existing_review
      where existing_review.contact_id =
          contact_row.id
        and existing_review.issue_type =
          'missing_brokerage'
        and existing_review.status =
          'pending'
    )

  order by
    contact_row.id,
    match_row.last_matched_at
      desc nulls last,
    match_row.created_at
      desc

  on conflict do nothing;

  get diagnostics
    affected_rows =
      row_count;

  reviews_created :=
    reviews_created +
    affected_rows;

  -- Brokerage conflicts are suggestions only; existing CRM data
  -- is never silently replaced.

  insert into public.contact_enrichment_reviews (
    org_id,
    owner_user_id,
    contact_id,
    listing_id,
    realtor_match_id,
    issue_type,
    field_name,
    current_value,
    proposed_value,
    source,
    confidence,
    details,
    created_by
  )

  select
    match_row.org_id,
    match_row.owner_user_id,
    contact_row.id,
    match_row.listing_id,
    match_row.id,
    'brokerage_conflict',
    'company',
    contact_row.company,
    match_row.agent_company,
    'reverse_prospecting_import',
    100,

    jsonb_build_object(
      'reason',
      'The stored brokerage differs from the imported Realtor-match brokerage.'
    ),

    p_requester_id

  from public.listing_realtor_matches
    as match_row

  join public.contacts
    as contact_row
    on contact_row.id =
      match_row.contact_id

  where match_row.batch_id =
      p_batch_id
    and match_row.is_active =
      true
    and contact_row.company_normalized
      is not null
    and nullif(
      lower(
        regexp_replace(
          btrim(
            coalesce(
              match_row.agent_company,
              ''
            )
          ),
          '\s+',
          ' ',
          'g'
        )
      ),
      ''
    ) is not null
    and contact_row.company_normalized <>
      lower(
        regexp_replace(
          btrim(
            match_row.agent_company
          ),
          '\s+',
          ' ',
          'g'
        )
      )

  on conflict do nothing;

  get diagnostics
    affected_rows =
      row_count;

  reviews_created :=
    reviews_created +
    affected_rows;

  -- MLS-ID conflicts include an imported ID that disagrees with
  -- the linked contact or is already assigned to another contact.

  insert into public.contact_enrichment_reviews (
    org_id,
    owner_user_id,
    contact_id,
    listing_id,
    realtor_match_id,
    issue_type,
    field_name,
    current_value,
    proposed_value,
    source,
    confidence,
    details,
    created_by
  )

  select
    match_row.org_id,
    match_row.owner_user_id,
    contact_row.id,
    match_row.listing_id,
    match_row.id,
    'mls_id_conflict',
    'mls_agent_id',
    contact_row.mls_agent_id,
    match_row.external_agent_id,
    'reverse_prospecting_import',
    100,

    jsonb_build_object(
      'reason',
      'The imported MLS user ID conflicts with existing CRM directory data.'
    ),

    p_requester_id

  from public.listing_realtor_matches
    as match_row

  join public.contacts
    as contact_row
    on contact_row.id =
      match_row.contact_id

  where match_row.batch_id =
      p_batch_id
    and match_row.is_active =
      true
    and nullif(
      btrim(
        coalesce(
          match_row.external_agent_id,
          ''
        )
      ),
      ''
    ) is not null
    and (
      (
        contact_row.mls_agent_id
          is not null
        and contact_row.mls_agent_id <>
          btrim(
            match_row.external_agent_id
          )
      )
      or exists (
        select 1
        from public.contacts
          as other_contact
        where other_contact.org_id =
            match_row.org_id
          and other_contact.id <>
            contact_row.id
          and other_contact.mls_agent_id =
            btrim(
              match_row.external_agent_id
            )
      )
      or (
        select count(
          distinct duplicate_match.contact_id
        )
        from public.listing_realtor_matches
          as duplicate_match
        where duplicate_match.batch_id =
            p_batch_id
          and duplicate_match.contact_id
            is not null
          and nullif(
            btrim(
              coalesce(
                duplicate_match.external_agent_id,
                ''
              )
            ),
            ''
          ) =
            btrim(
              match_row.external_agent_id
            )
      ) > 1
    )

  on conflict do nothing;

  get diagnostics
    affected_rows =
      row_count;

  reviews_created :=
    reviews_created +
    affected_rows;

  -- When email and MLS ID identify different CRM contacts, leave
  -- the Realtor match unlinked and create an explicit conflict.

  insert into public.contact_enrichment_reviews (
    org_id,
    owner_user_id,
    contact_id,
    listing_id,
    realtor_match_id,
    issue_type,
    field_name,
    current_value,
    proposed_value,
    source,
    confidence,
    details,
    created_by
  )

  select
    match_row.org_id,
    match_row.owner_user_id,
    null,
    match_row.listing_id,
    match_row.id,
    'email_conflict',
    'contact_id',
    email_contact.id::text,
    mls_contact.id::text,
    'reverse_prospecting_import',
    100,

    jsonb_build_object(
      'reason',
      'The imported email and MLS user ID identify different CRM contacts.',
      'email_contact_id',
      email_contact.id,
      'mls_contact_id',
      mls_contact.id,
      'agent_email',
      match_row.agent_email,
      'external_agent_id',
      match_row.external_agent_id
    ),

    p_requester_id

  from public.listing_realtor_matches
    as match_row

  join public.contacts
    as email_contact
    on email_contact.org_id =
      match_row.org_id
    and email_contact.email_normalized =
      match_row.agent_email_normalized

  join public.contacts
    as mls_contact
    on mls_contact.org_id =
      match_row.org_id
    and mls_contact.mls_agent_id =
      match_row.external_agent_id

  where match_row.batch_id =
      p_batch_id
    and match_row.is_active =
      true
    and match_row.contact_id
      is null
    and email_contact.id <>
      mls_contact.id

  on conflict do nothing;

  get diagnostics
    affected_rows =
      row_count;

  reviews_created :=
    reviews_created +
    affected_rows;

  -- Any remaining unlinked match is queued without creating a
  -- duplicate generic item for a known email/MLS conflict.

  insert into public.contact_enrichment_reviews (
    org_id,
    owner_user_id,
    contact_id,
    listing_id,
    realtor_match_id,
    issue_type,
    field_name,
    current_value,
    proposed_value,
    source,
    confidence,
    details,
    created_by
  )

  select
    match_row.org_id,
    match_row.owner_user_id,
    null,
    match_row.listing_id,
    match_row.id,
    'unlinked_match',
    'contact_id',
    null,
    match_row.agent_email,
    'reverse_prospecting_import',
    100,

    jsonb_build_object(
      'agent_email',
      match_row.agent_email,
      'agent_name',
      match_row.agent_display_name,
      'agent_company',
      match_row.agent_company,
      'external_agent_id',
      match_row.external_agent_id
    ),

    p_requester_id

  from public.listing_realtor_matches
    as match_row

  where match_row.batch_id =
      p_batch_id
    and match_row.is_active =
      true
    and match_row.contact_id
      is null
    and not exists (
      select 1
      from public.contacts
        as email_contact
      join public.contacts
        as mls_contact
        on mls_contact.org_id =
          email_contact.org_id
      where email_contact.org_id =
          match_row.org_id
        and email_contact.email_normalized =
          match_row.agent_email_normalized
        and mls_contact.mls_agent_id =
          match_row.external_agent_id
        and email_contact.id <>
          mls_contact.id
    )

  on conflict do nothing;

  get diagnostics
    affected_rows =
      row_count;

  reviews_created :=
    reviews_created +
    affected_rows;

  -- Set each linked contact's directory status from its current
  -- pending-review state.

  update public.contacts
    as contact_row

  set contact_review_status =
    'needs_review'

  where exists (
    select 1
    from public.listing_realtor_matches
      as match_row
    where match_row.batch_id =
        p_batch_id
      and match_row.contact_id =
        contact_row.id
      and match_row.is_active =
        true
  )
    and exists (
      select 1
      from public.contact_enrichment_reviews
        as review_row
      where review_row.contact_id =
          contact_row.id
        and review_row.status =
          'pending'
    );

  update public.contacts
    as contact_row

  set contact_review_status =
    'ready'

  where exists (
    select 1
    from public.listing_realtor_matches
      as match_row
    where match_row.batch_id =
        p_batch_id
      and match_row.contact_id =
        contact_row.id
      and match_row.is_active =
        true
  )
    and not exists (
      select 1
      from public.contact_enrichment_reviews
        as review_row
      where review_row.contact_id =
          contact_row.id
        and review_row.status =
          'pending'
    );

  select
    count(*) filter (
      where contact_row.contact_review_status =
        'ready'
    ),

    count(*) filter (
      where contact_row.contact_review_status =
        'needs_review'
    )

  into
    ready_contacts,
    contacts_needing_review

  from public.contacts
    as contact_row

  where exists (
    select 1
    from public.listing_realtor_matches
      as match_row
    where match_row.batch_id =
        p_batch_id
      and match_row.contact_id =
        contact_row.id
      and match_row.is_active =
        true
  );

  return jsonb_build_object(
    'contacts_updated',
    contacts_updated,

    'reviews_created',
    reviews_created,

    'reviews_resolved',
    reviews_resolved,

    'ready_contacts',
    ready_contacts,

    'contacts_needing_review',
    contacts_needing_review
  );
end;
$$;

revoke all on function
  public.sync_reverse_prospecting_contact_directory(
    uuid,
    uuid
  )
from public, anon, authenticated;

grant execute on function
  public.sync_reverse_prospecting_contact_directory(
    uuid,
    uuid
  )
to service_role;

comment on function
  public.sync_reverse_prospecting_contact_directory(
    uuid,
    uuid
  )
is
  'Fills only blank Realtor directory fields after a reverse-prospecting import, creates or resolves Samantha review items, and never silently overwrites conflicting contact data.';

commit;