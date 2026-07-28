-- ============================================================
-- SHARED EMAIL COMPLIANCE ACTIONS
-- PRODUCTION MIGRATION
--
-- Provides service-role-only functions for:
-- 1. Loading recipient email preferences.
-- 2. Saving recipient email preferences.
-- 3. Processing a full unsubscribe by unsubscribe token.
-- 4. Processing a full unsubscribe from the preferences page.
--
-- This migration:
-- - Does not send email.
-- - Does not grant anonymous table access.
-- - Does not create or modify tables, columns, or indexes.
-- - Preserves stronger complaint, bounce, suppression, invalid,
--   manual and do-not-contact blocks.
-- ============================================================

begin;


-- ============================================================
-- FOCUSED DATABASE PREFLIGHT
-- ============================================================

do $$
begin
  if to_regclass(
    'public.email_campaigns'
  ) is null then
    raise exception
      'Required table public.email_campaigns was not found.';
  end if;

  if to_regclass(
    'public.email_campaign_recipients'
  ) is null then
    raise exception
      'Required table public.email_campaign_recipients was not found.';
  end if;

  if to_regclass(
    'public.email_contact_preferences'
  ) is null then
    raise exception
      'Required table public.email_contact_preferences was not found.';
  end if;

  if to_regclass(
    'public.email_suppressions'
  ) is null then
    raise exception
      'Required table public.email_suppressions was not found.';
  end if;

  if to_regclass(
    'public.email_events'
  ) is null then
    raise exception
      'Required table public.email_events was not found.';
  end if;

  if to_regclass(
    'public.contacts'
  ) is null then
    raise exception
      'Required table public.contacts was not found.';
  end if;
end;
$$;


-- ============================================================
-- INTERNAL FULL-UNSUBSCRIBE TRANSACTION
--
-- This function is intentionally not executable by the
-- service_role directly. The token-specific wrapper functions
-- call it while running as the function owner.
-- ============================================================

create or replace function
  public.apply_email_recipient_full_unsubscribe(
    p_recipient_id uuid,
    p_source text
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_row record;

  action_time timestamptz :=
    clock_timestamp();

  normalized_email text;
  normalized_source text;

  contact_marketing_status text;
  contact_unsubscribed_at timestamptz;
  contact_do_not_contact boolean :=
    false;

  suppression_reason text;
  suppression_source text;
  suppression_notes text;

  effective_suppression_reason text;
  effective_suppression_source text;
  effective_suppression_notes text;

  already_unsubscribed boolean :=
    false;

  was_blocked boolean :=
    false;

  recipient_rows_updated integer :=
    0;
begin
  if p_recipient_id is null then
    raise exception
      'Recipient ID is required.';
  end if;


  normalized_source :=
    case lower(
      btrim(
        coalesce(
          p_source,
          ''
        )
      )
    )
      when 'preferences_page'
        then 'recipient_preferences_page'

      else
        'recipient_unsubscribe_link'
    end;


  -- ----------------------------------------------------------
  -- RECIPIENT AND CAMPAIGN LOCK
  -- ----------------------------------------------------------

  select
    recipient.id,
    recipient.campaign_id,
    recipient.contact_id,
    recipient.email,
    recipient.email_normalized,
    recipient.status,
    recipient.unsubscribed_at,

    campaign.org_id,
    campaign.owner_user_id

  into recipient_row

  from public.email_campaign_recipients
    as recipient

  join public.email_campaigns
    as campaign
    on campaign.id =
      recipient.campaign_id

  where recipient.id =
    p_recipient_id

  for update of recipient;


  if not found then
    raise exception
      'Recipient was not found.';
  end if;


  normalized_email :=
    lower(
      btrim(
        coalesce(
          nullif(
            recipient_row.email_normalized,
            ''
          ),
          recipient_row.email,
          ''
        )
      )
    );


  if normalized_email = '' then
    raise exception
      'Recipient email is missing.';
  end if;


  -- ----------------------------------------------------------
  -- ORGANIZATION-AND-EMAIL TRANSACTION LOCK
  --
  -- Serializes unsubscribe and preference changes even when
  -- different campaign-recipient rows represent the same email.
  -- ----------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtext(
      recipient_row.org_id::text
    ),
    hashtext(
      normalized_email
    )
  );


  -- ----------------------------------------------------------
  -- CURRENT CONTACT AND SUPPRESSION STATE
  -- ----------------------------------------------------------

  select
    contact.email_marketing_status,
    contact.email_unsubscribed_at,
    contact.do_not_contact

  into
    contact_marketing_status,
    contact_unsubscribed_at,
    contact_do_not_contact

  from public.contacts
    as contact

  where contact.org_id =
      recipient_row.org_id

    and contact.email_normalized =
      normalized_email

  for update;


  select
    suppression.reason,
    suppression.source,
    suppression.notes

  into
    suppression_reason,
    suppression_source,
    suppression_notes

  from public.email_suppressions
    as suppression

  where suppression.org_id =
      recipient_row.org_id

    and suppression.email_normalized =
      normalized_email

  for update;


  already_unsubscribed :=
    recipient_row.unsubscribed_at
      is not null

    or recipient_row.status =
      'unsubscribed'

    or contact_marketing_status =
      'unsubscribed'

    or contact_unsubscribed_at
      is not null

    or suppression_reason =
      'unsubscribed';


  was_blocked :=
    recipient_row.status in (
      'bounced',
      'complained'
    )

    or coalesce(
      contact_do_not_contact,
      false
    )

    or contact_marketing_status in (
      'bounced',
      'complained',
      'suppressed'
    )

    or suppression_reason in (
      'bounced',
      'complained',
      'manual',
      'invalid',
      'do_not_contact'
    );


  -- ----------------------------------------------------------
  -- DETERMINE THE AUTHORITATIVE SUPPRESSION REASON
  --
  -- A recipient unsubscribe never downgrades an existing
  -- complaint, bounce, invalid-address, manual or DNC block.
  -- ----------------------------------------------------------

  effective_suppression_reason :=
    case
      when
        suppression_reason =
          'complained'

        or contact_marketing_status =
          'complained'

        or recipient_row.status =
          'complained'
      then
        'complained'

      when
        suppression_reason =
          'do_not_contact'

        or coalesce(
          contact_do_not_contact,
          false
        )
      then
        'do_not_contact'

      when
        suppression_reason =
          'bounced'

        or contact_marketing_status =
          'bounced'

        or recipient_row.status =
          'bounced'
      then
        'bounced'

      when suppression_reason =
        'invalid'
      then
        'invalid'

      when
        suppression_reason =
          'manual'

        or contact_marketing_status =
          'suppressed'
      then
        'manual'

      else
        'unsubscribed'
    end;


  effective_suppression_source :=
    case
      when effective_suppression_reason =
        'unsubscribed'
      then
        normalized_source

      when suppression_reason =
          effective_suppression_reason
        and nullif(
          btrim(
            coalesce(
              suppression_source,
              ''
            )
          ),
          ''
        ) is not null
      then
        suppression_source

      else
        'contact_status'
    end;


  effective_suppression_notes :=
    case
      when effective_suppression_reason =
        'unsubscribed'
      then
        'Recipient requested a full marketing-email unsubscribe.'

      when suppression_reason =
          effective_suppression_reason
        and nullif(
          btrim(
            coalesce(
              suppression_notes,
              ''
            )
          ),
          ''
        ) is not null
      then
        suppression_notes

      else
        'A stronger existing marketing-email block was preserved when the recipient also requested unsubscribe.'
    end;


  -- ----------------------------------------------------------
  -- CURRENT RECIPIENT AND OTHER UNSENT RECIPIENT SNAPSHOTS
  -- ----------------------------------------------------------

  update public.email_campaign_recipients
    as target

  set
    status =
      case
        when target.id =
            recipient_row.id
          and target.status in (
            'bounced',
            'complained'
          )
        then
          target.status

        when target.id =
          recipient_row.id
        then
          'unsubscribed'

        else
          'suppressed'
      end,

    unsubscribed_at =
      coalesce(
        target.unsubscribed_at,
        action_time
      ),

    updated_at =
      action_time

  from public.email_campaigns
    as target_campaign

  where target_campaign.id =
      target.campaign_id

    and target_campaign.org_id =
      recipient_row.org_id

    and target.email_normalized =
      normalized_email

    and (
      target.id =
        recipient_row.id

      or (
        target.status in (
          'queued',
          'sending'
        )

        and target.sent_at
          is null
      )
    );


  get diagnostics
    recipient_rows_updated =
      row_count;


  -- ----------------------------------------------------------
  -- AUTHORITATIVE CONTACT STATUS
  --
  -- email_unsubscribed_at records the recipient's request.
  -- Stronger contact blocks remain stronger than unsubscribed.
  -- ----------------------------------------------------------

  update public.contacts
    as contact

  set
    email_marketing_status =
      case
        when effective_suppression_reason =
          'complained'
        then
          'complained'

        when effective_suppression_reason =
          'bounced'
        then
          'bounced'

        when effective_suppression_reason in (
          'manual',
          'invalid',
          'do_not_contact'
        )
        then
          'suppressed'

        else
          'unsubscribed'
      end,

    email_unsubscribed_at =
      coalesce(
        contact.email_unsubscribed_at,
        action_time
      ),

    updated_at =
      action_time

  where contact.org_id =
      recipient_row.org_id

    and contact.email_normalized =
      normalized_email;


  -- ----------------------------------------------------------
  -- ORGANIZATION-WIDE SUPPRESSION
  -- ----------------------------------------------------------

  insert into
    public.email_suppressions (
      org_id,
      contact_id,
      email,
      reason,
      source,
      notes,
      created_by
    )

  values (
    recipient_row.org_id,
    recipient_row.contact_id,
    recipient_row.email,
    effective_suppression_reason,
    effective_suppression_source,
    effective_suppression_notes,
    null
  )

  on conflict (
    org_id,
    email_normalized
  )

  do update set
    contact_id =
      coalesce(
        excluded.contact_id,
        email_suppressions.contact_id
      ),

    email =
      excluded.email,

    reason =
      excluded.reason,

    source =
      excluded.source,

    notes =
      excluded.notes;


  -- ----------------------------------------------------------
  -- CATEGORY PREFERENCES ALSO BECOME FALSE
  -- ----------------------------------------------------------

  insert into
    public.email_contact_preferences (
      org_id,
      owner_user_id,
      contact_id,
      email,
      email_normalized,
      allow_listing_ads,
      allow_open_house,
      allow_price_changes,
      allow_market_updates,
      allow_newsletters,
      source,
      updated_by
    )

  values (
    recipient_row.org_id,
    recipient_row.owner_user_id,
    recipient_row.contact_id,
    recipient_row.email,
    normalized_email,
    false,
    false,
    false,
    false,
    false,
    'unsubscribe_page',
    null
  )

  on conflict (
    org_id,
    email_normalized
  )

  do update set
    owner_user_id =
      excluded.owner_user_id,

    contact_id =
      coalesce(
        excluded.contact_id,
        email_contact_preferences.contact_id
      ),

    email =
      excluded.email,

    allow_listing_ads =
      false,

    allow_open_house =
      false,

    allow_price_changes =
      false,

    allow_market_updates =
      false,

    allow_newsletters =
      false,

    source =
      'unsubscribe_page',

    updated_by =
      null,

    updated_at =
      action_time;


  -- ----------------------------------------------------------
  -- IDEMPOTENT RECIPIENT-ACTION AUDIT EVENT
  --
  -- Provider unsubscribe events do not prevent recording the
  -- recipient's explicit action through this public workflow.
  -- ----------------------------------------------------------

  if not exists (
    select 1

    from public.email_events
      as event

    where event.recipient_id =
        recipient_row.id

      and event.event_type =
        'unsubscribed'

      and coalesce(
        event.payload ->> 'source',
        ''
      ) in (
        'recipient_unsubscribe_link',
        'recipient_preferences_page'
      )
  ) then
    insert into
      public.email_events (
        campaign_id,
        recipient_id,
        event_type,
        event_at,
        payload
      )

    values (
      recipient_row.campaign_id,
      recipient_row.id,
      'unsubscribed',
      action_time,

      jsonb_build_object(
        'source',
        normalized_source,

        'org_id',
        recipient_row.org_id,

        'already_unsubscribed',
        already_unsubscribed,

        'was_blocked',
        was_blocked,

        'preserved_suppression_reason',
        effective_suppression_reason
      )
    );
  end if;


  return jsonb_build_object(
    'ok',
    true,

    'recipient_id',
    recipient_row.id,

    'campaign_id',
    recipient_row.campaign_id,

    'email_masked',
    case
      when position(
        '@' in normalized_email
      ) > 1
      then
        left(
          normalized_email,
          1
        )
        || '***'
        || substring(
          normalized_email
          from position(
            '@' in normalized_email
          )
        )

      else
        'your email address'
    end,

    'unsubscribed_at',
    action_time,

    'already_unsubscribed',
    already_unsubscribed,

    'was_blocked',
    was_blocked,

    'suppression_reason',
    effective_suppression_reason,

    'recipient_rows_updated',
    recipient_rows_updated
  );
end;
$$;


-- ============================================================
-- UNSUBSCRIBE BY UNSUBSCRIBE TOKEN
-- ============================================================

create or replace function
  public.unsubscribe_email_recipient_by_token(
    p_unsubscribe_token uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_recipient_id uuid;
begin
  if p_unsubscribe_token is null then
    raise exception
      'Unsubscribe token is required.';
  end if;


  select
    recipient.id

  into selected_recipient_id

  from public.email_campaign_recipients
    as recipient

  where recipient.unsubscribe_token =
    p_unsubscribe_token;


  if not found then
    raise exception
      'The unsubscribe link is invalid.';
  end if;


  return
    public.apply_email_recipient_full_unsubscribe(
      selected_recipient_id,
      'unsubscribe_link'
    );
end;
$$;


-- ============================================================
-- UNSUBSCRIBE FROM THE PREFERENCES PAGE
-- ============================================================

create or replace function
  public.unsubscribe_email_recipient_by_preferences_token(
    p_preferences_token uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_recipient_id uuid;
begin
  if p_preferences_token is null then
    raise exception
      'Preferences token is required.';
  end if;


  select
    recipient.id

  into selected_recipient_id

  from public.email_campaign_recipients
    as recipient

  where recipient.preferences_token =
    p_preferences_token;


  if not found then
    raise exception
      'The email-preferences link is invalid.';
  end if;


  return
    public.apply_email_recipient_full_unsubscribe(
      selected_recipient_id,
      'preferences_page'
    );
end;
$$;


-- ============================================================
-- LOAD RECIPIENT PREFERENCES
-- ============================================================

create or replace function
  public.load_email_recipient_preferences(
    p_preferences_token uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_row record;

  normalized_email text;

  contact_marketing_status text;
  contact_unsubscribed_at timestamptz;
  contact_do_not_contact boolean :=
    false;

  suppression_reason text;

  current_status text;
  current_status_reason text;
begin
  if p_preferences_token is null then
    raise exception
      'Preferences token is required.';
  end if;


  select
    recipient.id,
    recipient.campaign_id,
    recipient.contact_id,
    recipient.email,
    recipient.email_normalized,
    recipient.status,
    recipient.unsubscribed_at,

    campaign.org_id,
    campaign.owner_user_id,

    preference.allow_listing_ads,
    preference.allow_open_house,
    preference.allow_price_changes,
    preference.allow_market_updates,
    preference.allow_newsletters

  into recipient_row

  from public.email_campaign_recipients
    as recipient

  join public.email_campaigns
    as campaign
    on campaign.id =
      recipient.campaign_id

  left join public.email_contact_preferences
    as preference
    on preference.org_id =
        campaign.org_id

      and preference.email_normalized =
        recipient.email_normalized

  where recipient.preferences_token =
    p_preferences_token;


  if not found then
    raise exception
      'The email-preferences link is invalid.';
  end if;


  normalized_email :=
    lower(
      btrim(
        coalesce(
          nullif(
            recipient_row.email_normalized,
            ''
          ),
          recipient_row.email,
          ''
        )
      )
    );


  if normalized_email = '' then
    raise exception
      'Recipient email is missing.';
  end if;


  select
    contact.email_marketing_status,
    contact.email_unsubscribed_at,
    contact.do_not_contact

  into
    contact_marketing_status,
    contact_unsubscribed_at,
    contact_do_not_contact

  from public.contacts
    as contact

  where contact.org_id =
      recipient_row.org_id

    and contact.email_normalized =
      normalized_email;


  select
    suppression.reason

  into suppression_reason

  from public.email_suppressions
    as suppression

  where suppression.org_id =
      recipient_row.org_id

    and suppression.email_normalized =
      normalized_email;


  current_status :=
    case
      when recipient_row.status in (
        'bounced',
        'complained'
      )

      or coalesce(
        contact_do_not_contact,
        false
      )

      or contact_marketing_status in (
        'bounced',
        'complained',
        'suppressed'
      )

      or suppression_reason in (
        'bounced',
        'complained',
        'manual',
        'invalid',
        'do_not_contact'
      )
      then
        'blocked'

      when recipient_row.unsubscribed_at
          is not null

        or recipient_row.status =
          'unsubscribed'

        or contact_marketing_status =
          'unsubscribed'

        or contact_unsubscribed_at
          is not null

        or suppression_reason =
          'unsubscribed'
      then
        'unsubscribed'

      else
        'active'
    end;


  current_status_reason :=
    case
      when current_status =
        'blocked'
      then
        case
          when suppression_reason in (
            'bounced',
            'complained',
            'manual',
            'invalid',
            'do_not_contact'
          )
          then
            suppression_reason

          when coalesce(
            contact_do_not_contact,
            false
          )
          then
            'do_not_contact'

          when contact_marketing_status in (
            'bounced',
            'complained',
            'suppressed'
          )
          then
            contact_marketing_status

          when recipient_row.status in (
            'bounced',
            'complained'
          )
          then
            recipient_row.status

          else
            'blocked'
        end

      when current_status =
        'unsubscribed'
      then
        'unsubscribed'

      else
        'active'
    end;


  return jsonb_build_object(
    'ok',
    true,

    'recipient_id',
    recipient_row.id,

    'email_masked',
    case
      when position(
        '@' in normalized_email
      ) > 1
      then
        left(
          normalized_email,
          1
        )
        || '***'
        || substring(
          normalized_email
          from position(
            '@' in normalized_email
          )
        )

      else
        'your email address'
    end,

    'marketing_status',
    current_status,

    'status_reason',
    current_status_reason,

    'can_update',
    current_status =
      'active',

    'preferences',
    jsonb_build_object(
      'allow_listing_ads',
      coalesce(
        recipient_row.allow_listing_ads,
        true
      ),

      'allow_open_house',
      coalesce(
        recipient_row.allow_open_house,
        true
      ),

      'allow_price_changes',
      coalesce(
        recipient_row.allow_price_changes,
        true
      ),

      'allow_market_updates',
      coalesce(
        recipient_row.allow_market_updates,
        true
      ),

      'allow_newsletters',
      coalesce(
        recipient_row.allow_newsletters,
        true
      )
    )
  );
end;
$$;


-- ============================================================
-- SAVE RECIPIENT PREFERENCES
--
-- A preference update cannot reactivate an unsubscribed,
-- bounced, complained, suppressed, invalid or DNC address.
-- ============================================================

create or replace function
  public.save_email_recipient_preferences(
    p_preferences_token uuid,
    p_allow_listing_ads boolean,
    p_allow_open_house boolean,
    p_allow_price_changes boolean,
    p_allow_market_updates boolean,
    p_allow_newsletters boolean
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_row record;

  action_time timestamptz :=
    clock_timestamp();

  normalized_email text;

  contact_marketing_status text;
  contact_unsubscribed_at timestamptz;
  contact_do_not_contact boolean :=
    false;

  suppression_reason text;

  queued_recipients_suppressed integer :=
    0;
begin
  if p_preferences_token is null then
    raise exception
      'Preferences token is required.';
  end if;


  if
    p_allow_listing_ads
      is null

    or p_allow_open_house
      is null

    or p_allow_price_changes
      is null

    or p_allow_market_updates
      is null

    or p_allow_newsletters
      is null
  then
    raise exception
      'All email-preference values are required.';
  end if;


  if not (
    p_allow_listing_ads

    or p_allow_open_house

    or p_allow_price_changes

    or p_allow_market_updates

    or p_allow_newsletters
  ) then
    raise exception
      'Use the unsubscribe option to turn off all marketing email.';
  end if;


  select
    recipient.id,
    recipient.campaign_id,
    recipient.contact_id,
    recipient.email,
    recipient.email_normalized,
    recipient.status,
    recipient.unsubscribed_at,

    campaign.org_id,
    campaign.owner_user_id

  into recipient_row

  from public.email_campaign_recipients
    as recipient

  join public.email_campaigns
    as campaign
    on campaign.id =
      recipient.campaign_id

  where recipient.preferences_token =
    p_preferences_token

  for update of recipient;


  if not found then
    raise exception
      'The email-preferences link is invalid.';
  end if;


  normalized_email :=
    lower(
      btrim(
        coalesce(
          nullif(
            recipient_row.email_normalized,
            ''
          ),
          recipient_row.email,
          ''
        )
      )
    );


  if normalized_email = '' then
    raise exception
      'Recipient email is missing.';
  end if;


  perform pg_advisory_xact_lock(
    hashtext(
      recipient_row.org_id::text
    ),
    hashtext(
      normalized_email
    )
  );


  select
    contact.email_marketing_status,
    contact.email_unsubscribed_at,
    contact.do_not_contact

  into
    contact_marketing_status,
    contact_unsubscribed_at,
    contact_do_not_contact

  from public.contacts
    as contact

  where contact.org_id =
      recipient_row.org_id

    and contact.email_normalized =
      normalized_email

  for update;


  select
    suppression.reason

  into suppression_reason

  from public.email_suppressions
    as suppression

  where suppression.org_id =
      recipient_row.org_id

    and suppression.email_normalized =
      normalized_email

  for update;


  if
    recipient_row.status in (
      'bounced',
      'complained'
    )

    or coalesce(
      contact_do_not_contact,
      false
    )

    or contact_marketing_status in (
      'bounced',
      'complained',
      'suppressed'
    )

    or suppression_reason in (
      'bounced',
      'complained',
      'manual',
      'invalid',
      'do_not_contact'
    )
  then
    raise exception
      'This email address is blocked and cannot be reactivated from this page.';
  end if;


  if
    recipient_row.unsubscribed_at
      is not null

    or recipient_row.status =
      'unsubscribed'

    or contact_marketing_status =
      'unsubscribed'

    or contact_unsubscribed_at
      is not null

    or suppression_reason =
      'unsubscribed'
  then
    raise exception
      'This email address is already unsubscribed and cannot be reactivated from this page.';
  end if;


  -- ----------------------------------------------------------
  -- SAVE CATEGORY PREFERENCES
  -- ----------------------------------------------------------

  insert into
    public.email_contact_preferences (
      org_id,
      owner_user_id,
      contact_id,
      email,
      email_normalized,
      allow_listing_ads,
      allow_open_house,
      allow_price_changes,
      allow_market_updates,
      allow_newsletters,
      source,
      updated_by
    )

  values (
    recipient_row.org_id,
    recipient_row.owner_user_id,
    recipient_row.contact_id,
    recipient_row.email,
    normalized_email,
    p_allow_listing_ads,
    p_allow_open_house,
    p_allow_price_changes,
    p_allow_market_updates,
    p_allow_newsletters,
    'recipient',
    null
  )

  on conflict (
    org_id,
    email_normalized
  )

  do update set
    owner_user_id =
      excluded.owner_user_id,

    contact_id =
      coalesce(
        excluded.contact_id,
        email_contact_preferences.contact_id
      ),

    email =
      excluded.email,

    allow_listing_ads =
      excluded.allow_listing_ads,

    allow_open_house =
      excluded.allow_open_house,

    allow_price_changes =
      excluded.allow_price_changes,

    allow_market_updates =
      excluded.allow_market_updates,

    allow_newsletters =
      excluded.allow_newsletters,

    source =
      'recipient',

    updated_by =
      null,

    updated_at =
      action_time;


  -- ----------------------------------------------------------
  -- STOP UNSENT CAMPAIGNS FOR DISABLED CATEGORIES
  --
  -- Re-enabling a preference never automatically resumes a
  -- previously suppressed delivery.
  -- ----------------------------------------------------------

  update public.email_campaign_recipients
    as target

  set
    status =
      'suppressed',

    updated_at =
      action_time

  from public.email_campaigns
    as target_campaign

  where target_campaign.id =
      target.campaign_id

    and target_campaign.org_id =
      recipient_row.org_id

    and target.email_normalized =
      normalized_email

    and target.status in (
      'queued',
      'sending'
    )

    and target.sent_at
      is null

    and (
      (
        target_campaign.campaign_type =
          'open_house'

        and p_allow_open_house =
          false
      )

      or (
        target_campaign.campaign_type =
          'price_change'

        and p_allow_price_changes =
          false
      )

      or (
        target_campaign.campaign_type =
          'newsletter'

        and p_allow_newsletters =
          false
      )

      or (
        target_campaign.campaign_type =
          'client_update'

        and p_allow_market_updates =
          false
      )

      or (
        target_campaign.campaign_type
          not in (
            'open_house',
            'price_change',
            'newsletter',
            'client_update'
          )

        and p_allow_listing_ads =
          false
      )
    );


  get diagnostics
    queued_recipients_suppressed =
      row_count;


  -- ----------------------------------------------------------
  -- AUDIT EVENT
  -- ----------------------------------------------------------

  insert into
    public.email_events (
      campaign_id,
      recipient_id,
      event_type,
      event_at,
      payload
    )

  values (
    recipient_row.campaign_id,
    recipient_row.id,
    'preferences_updated',
    action_time,

    jsonb_build_object(
      'source',
      'recipient_preferences_page',

      'org_id',
      recipient_row.org_id,

      'preferences',
      jsonb_build_object(
        'allow_listing_ads',
        p_allow_listing_ads,

        'allow_open_house',
        p_allow_open_house,

        'allow_price_changes',
        p_allow_price_changes,

        'allow_market_updates',
        p_allow_market_updates,

        'allow_newsletters',
        p_allow_newsletters
      ),

      'queued_recipients_suppressed',
      queued_recipients_suppressed
    )
  );


  return jsonb_build_object(
    'ok',
    true,

    'recipient_id',
    recipient_row.id,

    'email_masked',
    case
      when position(
        '@' in normalized_email
      ) > 1
      then
        left(
          normalized_email,
          1
        )
        || '***'
        || substring(
          normalized_email
          from position(
            '@' in normalized_email
          )
        )

      else
        'your email address'
    end,

    'marketing_status',
    'active',

    'preferences',
    jsonb_build_object(
      'allow_listing_ads',
      p_allow_listing_ads,

      'allow_open_house',
      p_allow_open_house,

      'allow_price_changes',
      p_allow_price_changes,

      'allow_market_updates',
      p_allow_market_updates,

      'allow_newsletters',
      p_allow_newsletters
    ),

    'queued_recipients_suppressed',
    queued_recipients_suppressed
  );
end;
$$;


-- ============================================================
-- FUNCTION ACCESS
--
-- Public routes invoke only token-specific functions through
-- the server-side service role. Browser roles receive no
-- function or table access.
-- ============================================================

revoke all
on function
  public.apply_email_recipient_full_unsubscribe(
    uuid,
    text
  )
from public,
     anon,
     authenticated,
     service_role;


revoke all
on function
  public.unsubscribe_email_recipient_by_token(
    uuid
  )
from public,
     anon,
     authenticated;


revoke all
on function
  public.unsubscribe_email_recipient_by_preferences_token(
    uuid
  )
from public,
     anon,
     authenticated;


revoke all
on function
  public.load_email_recipient_preferences(
    uuid
  )
from public,
     anon,
     authenticated;


revoke all
on function
  public.save_email_recipient_preferences(
    uuid,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean
  )
from public,
     anon,
     authenticated;


grant execute
on function
  public.unsubscribe_email_recipient_by_token(
    uuid
  )
to service_role;


grant execute
on function
  public.unsubscribe_email_recipient_by_preferences_token(
    uuid
  )
to service_role;


grant execute
on function
  public.load_email_recipient_preferences(
    uuid
  )
to service_role;


grant execute
on function
  public.save_email_recipient_preferences(
    uuid,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean
  )
to service_role;


comment on function
  public.apply_email_recipient_full_unsubscribe(
    uuid,
    text
  )
is
  'Internal transaction that records a full marketing-email unsubscribe without downgrading stronger bounce, complaint, invalid, manual, suppression or do-not-contact blocks.';


comment on function
  public.unsubscribe_email_recipient_by_token(
    uuid
  )
is
  'Resolves a unique unsubscribe token and applies the shared full-unsubscribe transaction.';


comment on function
  public.unsubscribe_email_recipient_by_preferences_token(
    uuid
  )
is
  'Resolves a unique preferences token and applies the shared full-unsubscribe transaction from the public preferences page.';


comment on function
  public.load_email_recipient_preferences(
    uuid
  )
is
  'Loads recipient-controlled marketing-email preferences while distinguishing active, unsubscribed and stronger blocked states.';


comment on function
  public.save_email_recipient_preferences(
    uuid,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean
  )
is
  'Saves recipient-controlled marketing-email category preferences, serializes concurrent changes, suppresses incompatible queued deliveries and never reactivates blocked or unsubscribed contacts.';


commit;

