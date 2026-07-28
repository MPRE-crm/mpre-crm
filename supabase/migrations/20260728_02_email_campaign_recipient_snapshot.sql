-- ============================================================
-- ATOMIC EMAIL CAMPAIGN RECIPIENT SNAPSHOT
-- ============================================================

begin;


-- ============================================================
-- FROZEN RECIPIENT CONTEXT
-- Idempotently records the already-installed live column.
-- ============================================================

alter table public.email_campaign_recipients
  add column if not exists
    recipient_context jsonb not null
    default '{}'::jsonb;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'email_campaign_recipients_context_check'
      and conrelid =
        'public.email_campaign_recipients'::regclass
  ) then
    alter table
      public.email_campaign_recipients
    add constraint
      email_campaign_recipients_context_check
    check (
      jsonb_typeof(
        recipient_context
      ) = 'object'
    );
  end if;
end;
$$;


comment on column
  public.email_campaign_recipients.recipient_context
is
  'Frozen recipient-specific rendering data, including Contact Category, lifecycle information, tags, source, Buyer Match verification and Samantha classification.';


-- ============================================================
-- ATOMIC SNAPSHOT FUNCTION
-- ============================================================

create or replace function
  public.replace_email_campaign_recipient_snapshot(
    p_campaign_id uuid,
    p_requester_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  campaign_row record;
  requester_row record;

  category_filter text;
  temperature_filter text;
  relationship_filter text;
  company_filter text;
  selected_audience_source text;

  snapshot_time timestamptz :=
    clock_timestamp();

  candidate_count integer := 0;
  saved_count integer := 0;
  stale_count integer := 0;
begin
  if p_campaign_id is null then
    raise exception
      'Campaign ID is required.';
  end if;

  if p_requester_id is null then
    raise exception
      'Requester ID is required.';
  end if;


  -- ----------------------------------------------------------
  -- AUTHENTICATED REQUESTER
  -- ----------------------------------------------------------

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


  -- ----------------------------------------------------------
  -- CAMPAIGN LOCK
  -- Prevent simultaneous snapshot replacements or campaign
  -- changes while the recipient list is being frozen.
  -- ----------------------------------------------------------

  select
    campaign.id,
    campaign.org_id,
    campaign.owner_user_id,
    campaign.listing_id,
    campaign.campaign_type,
    campaign.status,
    campaign.audience_source,
    campaign.audience_filter,
    campaign.updated_at
  into campaign_row
  from public.email_campaigns
    as campaign
  where campaign.id =
    p_campaign_id
  for update;

  if not found then
    raise exception
      'Campaign was not found.';
  end if;


  -- ----------------------------------------------------------
  -- ROLE AND OWNERSHIP ACCESS
  -- ----------------------------------------------------------

  if not (
    requester_row.role =
      'platform_admin'

    or (
      requester_row.org_id =
        campaign_row.org_id

      and requester_row.role in (
        'admin',
        'org_admin'
      )
    )

    or (
      requester_row.org_id =
        campaign_row.org_id

      and requester_row.role =
        'agent'

      and campaign_row.owner_user_id =
        requester_row.id
    )
  ) then
    raise exception
      'Requester cannot manage this campaign.';
  end if;


  if campaign_row.status <>
    'draft'
  then
    raise exception
      'Recipients can be rebuilt only while the campaign is a draft.';
  end if;


  -- ----------------------------------------------------------
  -- DELIVERY-HISTORY LOCK
  -- A recipient snapshot becomes immutable after any delivery,
  -- tracking, reply, unsubscribe or provider activity.
  -- ----------------------------------------------------------

  if exists (
    select 1
    from public.email_campaign_recipients
      as recipient
    where recipient.campaign_id =
        campaign_row.id

      and (
        recipient.status <>
          'queued'

        or recipient.send_attempts > 0

        or recipient.resend_email_id
          is not null

        or recipient.sent_at
          is not null

        or recipient.delivered_at
          is not null

        or recipient.first_opened_at
          is not null

        or recipient.last_opened_at
          is not null

        or recipient.open_count > 0

        or recipient.first_clicked_at
          is not null

        or recipient.last_clicked_at
          is not null

        or recipient.click_count > 0

        or recipient.bounced_at
          is not null

        or recipient.complained_at
          is not null

        or recipient.failed_at
          is not null

        or recipient.unsubscribed_at
          is not null

        or recipient.first_replied_at
          is not null

        or recipient.last_replied_at
          is not null

        or recipient.reply_count > 0

        or recipient.error_message
          is not null
      )
  ) then
    raise exception
      'This campaign already has recipient delivery history and its snapshot cannot be rebuilt.';
  end if;


  -- ----------------------------------------------------------
  -- NORMALIZED CAMPAIGN FILTERS
  -- ----------------------------------------------------------

  category_filter :=
    coalesce(
      nullif(
        lower(
          btrim(
            campaign_row
              .audience_filter
              ->> 'contact_type'
          )
        ),
        ''
      ),
      'all'
    );


  if category_filter =
    'vendor'
  then
    category_filter :=
      'vendor_partner';
  end if;


  if category_filter =
    'consumer'
  then
    category_filter :=
      case lower(
        btrim(
          coalesce(
            campaign_row
              .audience_filter
              ->> 'lifecycle_stage',
            ''
          )
        )
      )
        when 'active_buyer'
          then 'buyer'

        when 'active_seller'
          then 'seller'

        when 'closed_client'
          then 'past_client'

        when 'past_client'
          then 'past_client'

        when 'sphere'
          then 'sphere'

        else 'prospect'
      end;
  end if;


  temperature_filter :=
    coalesce(
      nullif(
        lower(
          btrim(
            campaign_row
              .audience_filter
              ->> 'prospect_temperature'
          )
        ),
        ''
      ),
      'all'
    );


  relationship_filter :=
    coalesce(
      nullif(
        lower(
          btrim(
            campaign_row
              .audience_filter
              ->> 'relationship_status'
          )
        ),
        ''
      ),
      'all'
    );


  company_filter :=
    coalesce(
      nullif(
        btrim(
          campaign_row
            .audience_filter
            ->> 'company'
        ),
        ''
      ),
      'all'
    );


  selected_audience_source :=
    coalesce(
      nullif(
        btrim(
          campaign_row.audience_source
        ),
        ''
      ),
      'manual_filter'
    );


  if selected_audience_source
    not in (
      'manual_filter',
      'reverse_prospecting',
      'all_realtors',
      'imported'
    )
  then
    raise exception
      'This campaign audience source is not yet supported by the controlled recipient snapshot workflow.';
  end if;


  if selected_audience_source =
      'reverse_prospecting'
    and campaign_row.listing_id
      is null
  then
    raise exception
      'A listing is required for a reverse-prospecting recipient snapshot.';
  end if;


  -- ----------------------------------------------------------
  -- TRANSACTION-SCOPED CANDIDATE TABLE
  -- The candidate set is frozen once and reused for the upsert,
  -- stale-row deletion and final count verification.
  -- ----------------------------------------------------------

  create temporary table
    if not exists
    email_recipient_snapshot_candidates (
      contact_id uuid not null,
      email text not null,
      email_normalized text primary key,
      first_name text,
      last_name text,
      display_name text,
      company text,
      realtor_match_id uuid,
      audience_source text not null,
      match_reason text,
      recipient_context jsonb not null,

      constraint
        email_recipient_snapshot_candidates_contact_unique
        unique (
          contact_id
        ),

      constraint
        email_recipient_snapshot_candidates_context_check
        check (
          jsonb_typeof(
            recipient_context
          ) = 'object'
        )
    )
  on commit drop;


  truncate table
    email_recipient_snapshot_candidates;


  -- ----------------------------------------------------------
  -- BUILD THE AUTHORITATIVE RECIPIENT SET
  -- ----------------------------------------------------------

  with normalized_contacts as (
    select
      contact.id,
      contact.owner_user_id,
      contact.first_name,
      contact.last_name,
      contact.display_name,
      contact.company,
      contact.email,
      contact.email_normalized,
      contact.contact_type,
      contact.lifecycle_stage,
      contact.relationship_status,
      contact.prospect_temperature,
      contact.tags,
      contact.source,
      contact.email_marketing_status,
      contact.do_not_contact,
      contact.is_archived,

      lower(
        btrim(
          coalesce(
            nullif(
              contact.email_normalized,
              ''
            ),
            contact.email,
            ''
          )
        )
      ) as snapshot_email_normalized,

      case
        when lower(
          btrim(
            coalesce(
              contact.contact_type,
              ''
            )
          )
        ) = 'vendor'
        then
          'vendor_partner'

        when lower(
          btrim(
            coalesce(
              contact.contact_type,
              ''
            )
          )
        ) = 'consumer'
        then
          case lower(
            btrim(
              coalesce(
                contact.lifecycle_stage,
                ''
              )
            )
          )
            when 'active_buyer'
              then 'buyer'

            when 'active_seller'
              then 'seller'

            when 'closed_client'
              then 'past_client'

            when 'past_client'
              then 'past_client'

            when 'sphere'
              then 'sphere'

            else 'prospect'
          end

        else
          coalesce(
            nullif(
              lower(
                btrim(
                  contact.contact_type
                )
              ),
              ''
            ),
            'other'
          )
      end as contact_category

    from public.contacts
      as contact

    where contact.org_id =
      campaign_row.org_id
  ),

  eligible_contacts as (
    select
      contact.*
    from normalized_contacts
      as contact

    where contact.snapshot_email_normalized
        <> ''

      and contact.email_marketing_status =
        'active'

      and contact.do_not_contact =
        false

      and contact.is_archived =
        false

      and contact.contact_category <>
        'builder'

      and (
        requester_row.role <>
          'agent'

        or contact.owner_user_id =
          requester_row.id
      )

      and not exists (
        select 1
        from public.email_suppressions
          as suppression
        where suppression.org_id =
            campaign_row.org_id

          and suppression.email_normalized =
            contact.snapshot_email_normalized
      )

      and not exists (
        select 1
        from public.email_contact_preferences
          as preference
        where preference.org_id =
            campaign_row.org_id

          and preference.email_normalized =
            contact.snapshot_email_normalized

          and (
            (
              campaign_row.campaign_type =
                'open_house'

              and preference.allow_open_house =
                false
            )

            or (
              campaign_row.campaign_type =
                'price_change'

              and preference.allow_price_changes =
                false
            )

            or (
              campaign_row.campaign_type =
                'newsletter'

              and preference.allow_newsletters =
                false
            )

            or (
              campaign_row.campaign_type =
                'client_update'

              and preference.allow_market_updates =
                false
            )

            or (
              campaign_row.campaign_type not in (
                'open_house',
                'price_change',
                'newsletter',
                'client_update'
              )

              and preference.allow_listing_ads =
                false
            )
          )
      )

      and (
        category_filter =
          'all'

        or contact.contact_category =
          category_filter
      )

      and (
        category_filter <>
          'prospect'

        or temperature_filter =
          'all'

        or lower(
          btrim(
            coalesce(
              contact.prospect_temperature,
              ''
            )
          )
        ) =
          temperature_filter
      )

      and (
        category_filter not in (
          'buyer',
          'seller',
          'buyer_seller'
        )

        or relationship_filter =
          'all'

        or lower(
          btrim(
            coalesce(
              contact.relationship_status,
              ''
            )
          )
        ) =
          relationship_filter
      )

      and (
        company_filter =
          'all'

        or btrim(
          coalesce(
            contact.company,
            ''
          )
        ) =
          company_filter
      )

      and (
        selected_audience_source not in (
          'all_realtors',
          'reverse_prospecting'
        )

        or contact.contact_category =
          'realtor'
      )
  ),

  matched_contacts as (
    select
      contact.*,

      buyer_match.id
        as buyer_match_id,

      buyer_match.match_source
        as buyer_match_source,

      buyer_match.buyer_match_count,

      buyer_match.match_reasons,

      buyer_match.criteria_summary,

      buyer_match.match_score,

      buyer_match.last_matched_at

    from eligible_contacts
      as contact

    left join lateral (
      select
        match.id,
        match.match_source,
        match.buyer_match_count,
        match.match_reasons,
        match.criteria_summary,
        match.match_score,
        match.last_matched_at

      from public.listing_realtor_matches
        as match

      where campaign_row.listing_id
          is not null

        and contact.contact_category =
          'realtor'

        and match.listing_id =
          campaign_row.listing_id

        and match.contact_id =
          contact.id

        and match.is_active =
          true

        and match.buyer_match_count >=
          1

      order by
        match.last_matched_at desc
          nulls last,

        match.created_at desc,

        match.id desc

      limit 1
    ) as buyer_match
      on true
  ),

  final_contacts as (
    select *
    from matched_contacts
      as contact

    where selected_audience_source <>
        'reverse_prospecting'

      or contact.buyer_match_id
        is not null
  )

  insert into
    email_recipient_snapshot_candidates (
      contact_id,
      email,
      email_normalized,
      first_name,
      last_name,
      display_name,
      company,
      realtor_match_id,
      audience_source,
      match_reason,
      recipient_context
    )

  select
    contact.id,

    coalesce(
      nullif(
        btrim(
          contact.email
        ),
        ''
      ),
      contact.snapshot_email_normalized
    ),

    contact.snapshot_email_normalized,

    nullif(
      btrim(
        contact.first_name
      ),
      ''
    ),

    nullif(
      btrim(
        contact.last_name
      ),
      ''
    ),

    coalesce(
      nullif(
        btrim(
          contact.display_name
        ),
        ''
      ),

      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(
              btrim(
                contact.first_name
              ),
              ''
            ),
            nullif(
              btrim(
                contact.last_name
              ),
              ''
            )
          )
        ),
        ''
      ),

      contact.snapshot_email_normalized
    ),

    nullif(
      btrim(
        contact.company
      ),
      ''
    ),

    contact.buyer_match_id,

    selected_audience_source,

    case
      when contact.buyer_match_id
        is null
      then
        null

      else
        coalesce(
          nullif(
            btrim(
              contact.criteria_summary
            ),
            ''
          ),

          nullif(
            array_to_string(
              contact.match_reasons,
              '; '
            ),
            ''
          )
        )
    end,

    jsonb_build_object(
      'snapshot_version',
      2,

      'snapshotted_at',
      snapshot_time,

      'campaign',
      jsonb_build_object(
        'id',
        campaign_row.id,

        'listing_id',
        campaign_row.listing_id,

        'campaign_type',
        campaign_row.campaign_type,

        'audience_source',
        selected_audience_source,

        'updated_at',
        campaign_row.updated_at
      ),

      'contact',
      jsonb_build_object(
        'owner_user_id',
        contact.owner_user_id,

        'contact_type_raw',
        contact.contact_type,

        'contact_category',
        contact.contact_category,

        'lifecycle_stage',
        contact.lifecycle_stage,

        'relationship_status',
        contact.relationship_status,

        'prospect_temperature',
        contact.prospect_temperature,

        'tags',
        coalesce(
          contact.tags,
          '{}'::text[]
        ),

        'source',
        contact.source
      ),

      'audience_filter',
      jsonb_build_object(
        'contact_type',
        category_filter,

        'prospect_temperature',
        temperature_filter,

        'relationship_status',
        relationship_filter,

        'company',
        company_filter
      ),

      'verified_listing_buyer_match',
      contact.buyer_match_id
        is not null,

      'buyer_match',
      case
        when contact.buyer_match_id
          is null
        then
          'null'::jsonb

        else
          jsonb_build_object(
            'id',
            contact.buyer_match_id,

            'match_source',
            contact.buyer_match_source,

            'buyer_match_count',
            contact.buyer_match_count,

            'match_reasons',
            coalesce(
              contact.match_reasons,
              '{}'::text[]
            ),

            'criteria_summary',
            contact.criteria_summary,

            'match_score',
            contact.match_score,

            'last_matched_at',
            contact.last_matched_at
          )
      end,

      'samantha_classification',
      case
        when contact.contact_category =
            'realtor'
          and contact.buyer_match_id
            is not null
        then
          jsonb_build_object(
            'audience',
            'reverse_prospecting_realtor',

            'confidence',
            'high',

            'reason',
            'The Realtor has a verified listing-specific Buyer Match or reverse-prospecting connection.',

            'needs_review',
            false
          )

        when contact.contact_category =
          'realtor'
        then
          jsonb_build_object(
            'audience',
            'realtor',

            'confidence',
            'high',

            'reason',
            'The Contact Category is Realtor.',

            'needs_review',
            false
          )

        when contact.contact_category =
          'lender'
        then
          jsonb_build_object(
            'audience',
            'lender',

            'confidence',
            'high',

            'reason',
            'The Contact Category is Lender.',

            'needs_review',
            false
          )

        when contact.contact_category =
          'title_escrow'
        then
          jsonb_build_object(
            'audience',
            'title_escrow',

            'confidence',
            'high',

            'reason',
            'The Contact Category is Title or Escrow.',

            'needs_review',
            false
          )

        when contact.contact_category =
          'professional'
        then
          jsonb_build_object(
            'audience',
            'professional',

            'confidence',
            'high',

            'reason',
            'The Contact Category is Professional.',

            'needs_review',
            false
          )

        when contact.contact_category in (
          'buyer',
          'seller',
          'buyer_seller'
        )
        then
          jsonb_build_object(
            'audience',
            'active_client',

            'confidence',
            'high',

            'reason',
            'The Contact Category identifies an active Buyer, Seller, or Buyer and Seller relationship.',

            'needs_review',
            false
          )

        when contact.contact_category =
          'past_client'
        then
          jsonb_build_object(
            'audience',
            'past_client',

            'confidence',
            'high',

            'reason',
            'The Contact Category is Past or Closed Client.',

            'needs_review',
            false
          )

        when contact.contact_category =
          'sphere'
        then
          jsonb_build_object(
            'audience',
            'sphere',

            'confidence',
            'high',

            'reason',
            'The Contact Category is Sphere of Influence.',

            'needs_review',
            false
          )

        when contact.contact_category =
          'vendor_partner'
        then
          jsonb_build_object(
            'audience',
            'vendor_partner',

            'confidence',
            'high',

            'reason',
            'The Contact Category is Vendor or Partner.',

            'needs_review',
            false
          )

        when contact.contact_category =
          'prospect'
        then
          jsonb_build_object(
            'audience',
            'prospect',

            'confidence',
            'high',

            'reason',
            'The Contact Category is Prospect.',

            'needs_review',
            false
          )

        else
          jsonb_build_object(
            'audience',
            'unknown',

            'confidence',
            'low',

            'reason',
            'The Contact Category does not support a reliable relationship classification.',

            'needs_review',
            true
          )
      end
    )

  from final_contacts
    as contact;


  get diagnostics
    candidate_count =
      row_count;


  -- ----------------------------------------------------------
  -- UPSERT WITHOUT REPLACING UNIQUE RECIPIENT TOKENS
  -- ----------------------------------------------------------

  insert into
    public.email_campaign_recipients (
      campaign_id,
      contact_id,
      email,
      first_name,
      last_name,
      display_name,
      company,
      status,
      realtor_match_id,
      audience_source,
      match_reason,
      recipient_context
    )

  select
    campaign_row.id,
    candidate.contact_id,
    candidate.email,
    candidate.first_name,
    candidate.last_name,
    candidate.display_name,
    candidate.company,
    'queued',
    candidate.realtor_match_id,
    candidate.audience_source,
    candidate.match_reason,
    candidate.recipient_context

  from
    email_recipient_snapshot_candidates
      as candidate

  on conflict (
    campaign_id,
    email_normalized
  )

  do update set
    contact_id =
      excluded.contact_id,

    email =
      excluded.email,

    first_name =
      excluded.first_name,

    last_name =
      excluded.last_name,

    display_name =
      excluded.display_name,

    company =
      excluded.company,

    status =
      'queued',

    realtor_match_id =
      excluded.realtor_match_id,

    audience_source =
      excluded.audience_source,

    match_reason =
      excluded.match_reason,

    recipient_context =
      excluded.recipient_context,

    updated_at =
      now();


  -- ----------------------------------------------------------
  -- REMOVE RECIPIENTS NO LONGER IN THE CURRENT FILTER
  -- Only untouched queued rows can reach this point.
  -- ----------------------------------------------------------

  delete from
    public.email_campaign_recipients
      as recipient

  where recipient.campaign_id =
      campaign_row.id

    and recipient.status =
      'queued'

    and not exists (
      select 1

      from
        email_recipient_snapshot_candidates
          as candidate

      where candidate.email_normalized =
        recipient.email_normalized
    );


  get diagnostics
    stale_count =
      row_count;


  -- ----------------------------------------------------------
  -- VERIFY AND CORRECT CAMPAIGN TOTAL
  -- ----------------------------------------------------------

  select count(*)
  into saved_count
  from public.email_campaign_recipients
    as recipient
  where recipient.campaign_id =
    campaign_row.id;


  if saved_count <>
    candidate_count
  then
    raise exception
      'Recipient snapshot verification failed. Expected % rows but found %.',
      candidate_count,
      saved_count;
  end if;


  update public.email_campaigns
    as campaign

  set total_recipients =
    saved_count

  where campaign.id =
    campaign_row.id;


  return jsonb_build_object(
    'campaign_id',
    campaign_row.id,

    'snapshotted_at',
    snapshot_time,

    'saved_recipients',
    saved_count,

    'stale_recipients_removed',
    stale_count,

    'mass_send_unlocked',
    false
  );
end;
$$;


revoke all
on function
  public.replace_email_campaign_recipient_snapshot(
    uuid,
    uuid
  )
from public,
     anon,
     authenticated;


grant execute
on function
  public.replace_email_campaign_recipient_snapshot(
    uuid,
    uuid
  )
to service_role;


comment on function
  public.replace_email_campaign_recipient_snapshot(
    uuid,
    uuid
  )
is
  'Atomically builds and freezes an eligible email-campaign recipient snapshot, validates campaign ownership and delivery history, applies suppression and recipient-preference safeguards, preserves unique recipient tokens, removes stale queued rows, and corrects the campaign recipient total.';


commit;