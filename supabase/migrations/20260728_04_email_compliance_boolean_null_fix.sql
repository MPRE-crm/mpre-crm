-- ============================================================
-- EMAIL COMPLIANCE BOOLEAN NULL FIX
--
-- Corrects SQL three-valued boolean results returned by the
-- shared full-unsubscribe transaction.
--
-- This migration:
-- - Does not send email.
-- - Does not modify tables, columns, indexes, or policies.
-- - Replaces only the internal full-unsubscribe function.
-- ============================================================

begin;

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
    coalesce(
      recipient_row.unsubscribed_at
        is not null

      or recipient_row.status =
        'unsubscribed'

      or contact_marketing_status =
        'unsubscribed'

      or contact_unsubscribed_at
        is not null

      or suppression_reason =
        'unsubscribed',
      false
    );


  was_blocked :=
    coalesce(
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
      ),
      false
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

commit;
