begin;

-- ============================================================
-- SAMANTHA CONTACT-ENRICHMENT REVIEW ACTIONS
-- ============================================================

create or replace function
  public.apply_contact_enrichment_review_action(
    p_review_id uuid,
    p_requester_id uuid,
    p_action text
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  review_row record;
  requester_row record;

  normalized_action text;
  applied_value boolean := false;
  affected_rows integer := 0;

  next_review_status text;
  next_contact_status text;

  contact_found boolean := false;
  match_found boolean := false;
  resolve_is_valid boolean := false;

  live_company text;
  live_company_normalized text;
  live_phone text;
  live_email_normalized text;
  live_mls_agent_id text;
  live_mls_office_id text;
  live_license_number text;

  live_match_contact_id uuid;
  live_match_agent_email_normalized text;
  live_match_agent_company text;
  live_match_external_agent_id text;
begin
  normalized_action :=
    lower(
      btrim(
        coalesce(
          p_action,
          ''
        )
      )
    );

  if normalized_action not in (
    'approve',
    'reject',
    'ignore',
    'resolve'
  ) then
    raise exception
      'Review action is invalid.';
  end if;

  select
    review_item.id,
    review_item.org_id,
    review_item.owner_user_id,
    review_item.contact_id,
    review_item.realtor_match_id,
    review_item.issue_type,
    review_item.field_name,
    review_item.current_value,
    review_item.proposed_value,
    review_item.status
  into review_row
  from public.contact_enrichment_reviews
    as review_item
  where review_item.id =
    p_review_id
  for update;

  if not found then
    raise exception
      'Contact enrichment review was not found.';
  end if;

  select
    profile.id,
    profile.org_id,
    profile.role
  into requester_row
  from public.profiles
    as profile
  where profile.id =
    p_requester_id;

  if not found then
    raise exception
      'Requester profile was not found.';
  end if;

  if not (
    requester_row.role =
      'platform_admin'
    or (
      requester_row.org_id =
        review_row.org_id
      and requester_row.role in (
        'admin',
        'org_admin'
      )
    )
    or (
      requester_row.org_id =
        review_row.org_id
      and requester_row.role =
        'agent'
      and review_row.owner_user_id =
        requester_row.id
    )
  ) then
    raise exception
      'Requester cannot manage this contact enrichment review.';
  end if;

  if review_row.status <>
    'pending'
  then
    raise exception
      'This contact enrichment review is no longer pending.';
  end if;

  if normalized_action in (
    'reject',
    'ignore'
  )
  and nullif(
    btrim(
      coalesce(
        review_row.proposed_value,
        ''
      )
    ),
    ''
  ) is null
  then
    raise exception
      'This review has no verified suggestion to reject or ignore.';
  end if;

  if normalized_action =
    'approve'
  then
    if review_row.contact_id
      is null
    then
      raise exception
        'This review cannot be approved automatically because it is not linked to a CRM contact.';
    end if;

    if nullif(
      btrim(
        coalesce(
          review_row.proposed_value,
          ''
        )
      ),
      ''
    ) is null
    then
      raise exception
        'This review does not contain a proposed value to approve.';
    end if;

    if review_row.field_name =
      'company'
    then
      update public.contacts
        as contact_row
      set
        company =
          review_row.proposed_value,

        last_enriched_at =
          now(),

        last_enrichment_source =
          'samantha_review_approved'
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id
        and contact_row.company
          is not distinct from
            review_row.current_value;

    elsif review_row.field_name =
      'phone'
    then
      update public.contacts
        as contact_row
      set
        phone =
          review_row.proposed_value,

        last_enriched_at =
          now(),

        last_enrichment_source =
          'samantha_review_approved'
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id
        and contact_row.phone
          is not distinct from
            review_row.current_value;

    elsif review_row.field_name =
      'mls_agent_id'
    then
      if exists (
        select 1
        from public.contacts
          as other_contact
        where other_contact.org_id =
            review_row.org_id
          and other_contact.id <>
            review_row.contact_id
          and other_contact.mls_agent_id =
            btrim(
              review_row.proposed_value
            )
      ) then
        raise exception
          'The proposed MLS user ID is already assigned to another CRM contact.';
      end if;

      update public.contacts
        as contact_row
      set
        mls_agent_id =
          review_row.proposed_value,

        last_enriched_at =
          now(),

        last_enrichment_source =
          'samantha_review_approved'
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id
        and contact_row.mls_agent_id
          is not distinct from
            review_row.current_value;

    elsif review_row.field_name =
      'mls_office_id'
    then
      update public.contacts
        as contact_row
      set
        mls_office_id =
          review_row.proposed_value,

        last_enriched_at =
          now(),

        last_enrichment_source =
          'samantha_review_approved'
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id
        and contact_row.mls_office_id
          is not distinct from
            review_row.current_value;

    elsif review_row.field_name =
      'license_number'
    then
      update public.contacts
        as contact_row
      set
        license_number =
          review_row.proposed_value,

        last_enriched_at =
          now(),

        last_enrichment_source =
          'samantha_review_approved'
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id
        and contact_row.license_number
          is not distinct from
            review_row.current_value;

    else
      raise exception
        'This review field cannot be approved automatically.';
    end if;

    get diagnostics
      affected_rows =
        row_count;

    if affected_rows <> 1 then
      raise exception
        'The CRM contact changed after this review was created. Refresh the review queue before approving it.';
    end if;

    applied_value :=
      true;

    next_review_status :=
      'approved';

  elsif normalized_action =
    'reject'
  then
    next_review_status :=
      'rejected';

  elsif normalized_action =
    'ignore'
  then
    next_review_status :=
      'ignored';

  else
    if review_row.contact_id
      is not null
    then
      select
        contact_row.company,
        contact_row.company_normalized,
        contact_row.phone,
        contact_row.email_normalized,
        contact_row.mls_agent_id,
        contact_row.mls_office_id,
        contact_row.license_number
      into
        live_company,
        live_company_normalized,
        live_phone,
        live_email_normalized,
        live_mls_agent_id,
        live_mls_office_id,
        live_license_number
      from public.contacts
        as contact_row
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id;

      contact_found :=
        found;
    end if;

    if review_row.realtor_match_id
      is not null
    then
      select
        match_row.contact_id,
        match_row.agent_email_normalized,
        match_row.agent_company,
        match_row.external_agent_id
      into
        live_match_contact_id,
        live_match_agent_email_normalized,
        live_match_agent_company,
        live_match_external_agent_id
      from public.listing_realtor_matches
        as match_row
      where match_row.id =
          review_row.realtor_match_id
        and match_row.org_id =
          review_row.org_id;

      match_found :=
        found;
    end if;

    if review_row.issue_type =
      'missing_phone'
    then
      resolve_is_valid :=
        contact_found
        and nullif(
          btrim(
            coalesce(
              live_phone,
              ''
            )
          ),
          ''
        ) is not null;

    elsif review_row.issue_type =
      'missing_brokerage'
    then
      resolve_is_valid :=
        contact_found
        and nullif(
          btrim(
            coalesce(
              live_company,
              ''
            )
          ),
          ''
        ) is not null;

    elsif review_row.issue_type =
      'brokerage_conflict'
    then
      resolve_is_valid :=
        contact_found
        and match_found
        and live_company_normalized =
          nullif(
            lower(
              regexp_replace(
                btrim(
                  coalesce(
                    live_match_agent_company,
                    ''
                  )
                ),
                '\s+',
                ' ',
                'g'
              )
            ),
            ''
          );

    elsif review_row.issue_type =
      'mls_id_conflict'
    then
      resolve_is_valid :=
        contact_found
        and match_found
        and nullif(
          btrim(
            coalesce(
              live_mls_agent_id,
              ''
            )
          ),
          ''
        ) =
          nullif(
            btrim(
              coalesce(
                live_match_external_agent_id,
                ''
              )
            ),
            ''
          );

    elsif review_row.issue_type =
      'unlinked_match'
    then
      resolve_is_valid :=
        match_found
        and live_match_contact_id
          is not null;

    elsif review_row.issue_type =
      'email_conflict'
    then
      resolve_is_valid :=
        contact_found
        and match_found
        and live_match_contact_id =
          review_row.contact_id
        and nullif(
          lower(
            btrim(
              coalesce(
                live_email_normalized,
                ''
              )
            )
          ),
          ''
        ) =
          nullif(
            lower(
              btrim(
                coalesce(
                  live_match_agent_email_normalized,
                  ''
                )
              )
            ),
            ''
          );

    elsif review_row.issue_type =
      'stale_data'
    then
      resolve_is_valid :=
        contact_found
        and (
          (
            review_row.field_name =
              'company'
            and live_company
              is distinct from
                review_row.current_value
          )
          or (
            review_row.field_name =
              'phone'
            and live_phone
              is distinct from
                review_row.current_value
          )
          or (
            review_row.field_name =
              'mls_agent_id'
            and live_mls_agent_id
              is distinct from
                review_row.current_value
          )
          or (
            review_row.field_name =
              'mls_office_id'
            and live_mls_office_id
              is distinct from
                review_row.current_value
          )
          or (
            review_row.field_name =
              'license_number'
            and live_license_number
              is distinct from
                review_row.current_value
          )
        );

    else
      resolve_is_valid :=
        false;
    end if;

    if not resolve_is_valid
    then
      raise exception
        'This review is not actually resolved. Update or verify the underlying contact data first.';
    end if;

    next_review_status :=
      'resolved';
  end if;

  update public.contact_enrichment_reviews
    as review_item
  set
    status =
      next_review_status,

    resolved_by =
      p_requester_id,

    resolved_at =
      now(),

    updated_at =
      now()
  where review_item.id =
    review_row.id;

  if review_row.contact_id
    is not null
  then
    select
      contact_row.company,
      contact_row.phone
    into
      live_company,
      live_phone
    from public.contacts
      as contact_row
    where contact_row.id =
        review_row.contact_id
      and contact_row.org_id =
        review_row.org_id;

    if not found then
      raise exception
        'The linked CRM contact was not found while refreshing its review status.';
    end if;

    if exists (
      select 1
      from public.contact_enrichment_reviews
        as remaining_review
      where remaining_review.contact_id =
          review_row.contact_id
        and remaining_review.status =
          'pending'
    )
    or nullif(
      btrim(
        coalesce(
          live_company,
          ''
        )
      ),
      ''
    ) is null
    or nullif(
      btrim(
        coalesce(
          live_phone,
          ''
        )
      ),
      ''
    ) is null
    then
      next_contact_status :=
        'needs_review';
    else
      next_contact_status :=
        'ready';
    end if;

    update public.contacts
      as contact_row
    set contact_review_status =
      next_contact_status
    where contact_row.id =
        review_row.contact_id
      and contact_row.org_id =
        review_row.org_id;
  end if;

  return jsonb_build_object(
    'review_id',
    review_row.id,

    'action',
    normalized_action,

    'status',
    next_review_status,

    'contact_id',
    review_row.contact_id,

    'contact_review_status',
    next_contact_status,

    'applied_value',
    applied_value
  );
end;
$$;

revoke all on function
  public.apply_contact_enrichment_review_action(
    uuid,
    uuid,
    text
  )
from public, anon, authenticated;

grant execute on function
  public.apply_contact_enrichment_review_action(
    uuid,
    uuid,
    text
  )
to service_role;

comment on function
  public.apply_contact_enrichment_review_action(
    uuid,
    uuid,
    text
  )
is
  'Atomically applies verified contact-enrichment decisions, prevents suggestion-free dismissals, validates live resolution conditions, rejects stale overwrites, and keeps incomplete contacts in review.';

commit;