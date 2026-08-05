begin;

-- ============================================================
-- PERSONAL FOLLOW-UP ENGAGEMENT STORAGE
-- ============================================================

alter table
  public.email_personal_follow_up_deliveries

  add column if not exists
    delivered_at timestamptz,

  add column if not exists
    first_opened_at timestamptz,

  add column if not exists
    last_opened_at timestamptz,

  add column if not exists
    open_count integer not null
      default 0,

  add column if not exists
    first_clicked_at timestamptz,

  add column if not exists
    last_clicked_at timestamptz,

  add column if not exists
    click_count integer not null
      default 0,

  add column if not exists
    last_clicked_url text;


do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'public.email_personal_follow_up_deliveries'::regclass

      and conname =
        'email_personal_follow_up_deliveries_open_count_check'
  ) then
    alter table
      public.email_personal_follow_up_deliveries

    add constraint
      email_personal_follow_up_deliveries_open_count_check

    check (
      open_count >= 0
    );
  end if;


  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'public.email_personal_follow_up_deliveries'::regclass

      and conname =
        'email_personal_follow_up_deliveries_click_count_check'
  ) then
    alter table
      public.email_personal_follow_up_deliveries

    add constraint
      email_personal_follow_up_deliveries_click_count_check

    check (
      click_count >= 0
    );
  end if;
end;
$constraints$;


-- ============================================================
-- RESEND EVENT RECORDER
-- ============================================================

create or replace function
  public.record_resend_personal_follow_up_event(
    p_provider_event_id text,
    p_event_type text,
    p_resend_email_id text,
    p_event_at timestamptz,
    p_payload jsonb default '{}'::jsonb
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  normalized_provider_event_id text;
  normalized_event_type text;
  normalized_resend_email_id text;
  internal_event_type text;
  occurred_at timestamptz;
  selected_delivery record;
  inserted_event_id uuid;
  clicked_url text;
begin
  normalized_provider_event_id :=
    nullif(
      btrim(
        coalesce(
          p_provider_event_id,
          ''
        )
      ),
      ''
    );

  normalized_event_type :=
    lower(
      btrim(
        coalesce(
          p_event_type,
          ''
        )
      )
    );

  normalized_resend_email_id :=
    nullif(
      btrim(
        coalesce(
          p_resend_email_id,
          ''
        )
      ),
      ''
    );

  occurred_at :=
    coalesce(
      p_event_at,
      clock_timestamp()
    );

  if normalized_provider_event_id is null then
    raise exception
      'Provider event ID is required.';
  end if;

  if normalized_resend_email_id is null then
    raise exception
      'Resend email ID is required.';
  end if;

  internal_event_type :=
    case normalized_event_type
      when 'email.sent'
        then 'sent'

      when 'email.delivered'
        then 'delivered'

      when 'email.opened'
        then 'opened'

      when 'email.clicked'
        then 'clicked'

      else null
    end;

  if internal_event_type is null then
    return jsonb_build_object(
      'ok',
      true,

      'ignored',
      true,

      'reason',
      'unsupported_event_type',

      'event_type',
      normalized_event_type
    );
  end if;


  select
    delivery.id,
    delivery.source_campaign_id,
    delivery.source_recipient_id

  into selected_delivery

  from public.email_personal_follow_up_deliveries
    as delivery

  where delivery.resend_email_id =
    normalized_resend_email_id

  order by
    delivery.sent_at desc nulls last,
    delivery.created_at desc,
    delivery.id desc

  limit 1;


  if not found then
    return jsonb_build_object(
      'ok',
      true,

      'ignored',
      true,

      'reason',
      'personal_follow_up_delivery_not_found',

      'resend_email_id',
      normalized_resend_email_id,

      'event_type',
      normalized_event_type
    );
  end if;


  insert into public.email_events (
    campaign_id,
    recipient_id,
    resend_email_id,
    provider_event_id,
    event_type,
    event_at,
    payload
  )

  values (
    selected_delivery.source_campaign_id,
    selected_delivery.source_recipient_id,
    normalized_resend_email_id,
    normalized_provider_event_id,
    internal_event_type,
    occurred_at,

    coalesce(
      p_payload,
      '{}'::jsonb
    )
    || jsonb_build_object(
      'message_kind',
      'personal_follow_up',

      'personal_follow_up_delivery_id',
      selected_delivery.id
    )
  )

  on conflict (
    provider_event_id
  )
  where provider_event_id is not null

  do nothing

  returning id
  into inserted_event_id;


  if inserted_event_id is null then
    return jsonb_build_object(
      'ok',
      true,

      'duplicate',
      true,

      'message_kind',
      'personal_follow_up',

      'provider_event_id',
      normalized_provider_event_id,

      'delivery_id',
      selected_delivery.id,

      'campaign_id',
      selected_delivery.source_campaign_id,

      'recipient_id',
      selected_delivery.source_recipient_id
    );
  end if;


  clicked_url :=
    nullif(
      btrim(
        coalesce(
          p_payload #>> '{data,click,link}',
          p_payload #>> '{click,link}',
          ''
        )
      ),
      ''
    );


  update
    public.email_personal_follow_up_deliveries
      as delivery

  set
    sent_at =
      case
        when internal_event_type in (
          'sent',
          'delivered',
          'opened',
          'clicked'
        )
        then coalesce(
          delivery.sent_at,
          occurred_at
        )

        else delivery.sent_at
      end,

    delivered_at =
      case
        when internal_event_type in (
          'delivered',
          'opened',
          'clicked'
        )
        then
          case
            when delivery.delivered_at is null
              then occurred_at

            else least(
              delivery.delivered_at,
              occurred_at
            )
          end

        else delivery.delivered_at
      end,

    first_opened_at =
      case
        when internal_event_type =
          'opened'
        then
          case
            when delivery.first_opened_at is null
              then occurred_at

            else least(
              delivery.first_opened_at,
              occurred_at
            )
          end

        else delivery.first_opened_at
      end,

    last_opened_at =
      case
        when internal_event_type =
          'opened'
        then
          case
            when delivery.last_opened_at is null
              then occurred_at

            else greatest(
              delivery.last_opened_at,
              occurred_at
            )
          end

        else delivery.last_opened_at
      end,

    open_count =
      case
        when internal_event_type =
          'opened'
        then delivery.open_count + 1

        else delivery.open_count
      end,

    first_clicked_at =
      case
        when internal_event_type =
          'clicked'
        then
          case
            when delivery.first_clicked_at is null
              then occurred_at

            else least(
              delivery.first_clicked_at,
              occurred_at
            )
          end

        else delivery.first_clicked_at
      end,

    last_clicked_at =
      case
        when internal_event_type =
          'clicked'
        then
          case
            when delivery.last_clicked_at is null
              then occurred_at

            else greatest(
              delivery.last_clicked_at,
              occurred_at
            )
          end

        else delivery.last_clicked_at
      end,

    click_count =
      case
        when internal_event_type =
          'clicked'
        then delivery.click_count + 1

        else delivery.click_count
      end,

    last_clicked_url =
      case
        when internal_event_type =
          'clicked'
        then coalesce(
          clicked_url,
          delivery.last_clicked_url
        )

        else delivery.last_clicked_url
      end,

    updated_at =
      clock_timestamp()

  where delivery.id =
    selected_delivery.id;


  return jsonb_build_object(
    'ok',
    true,

    'duplicate',
    false,

    'message_kind',
    'personal_follow_up',

    'provider_event_id',
    normalized_provider_event_id,

    'event_type',
    internal_event_type,

    'delivery_id',
    selected_delivery.id,

    'recipient_id',
    selected_delivery.source_recipient_id,

    'campaign_id',
    selected_delivery.source_campaign_id,

    'event_at',
    occurred_at
  );
end;
$function$;


revoke all
on function
  public.record_resend_personal_follow_up_event(
    text,
    text,
    text,
    timestamptz,
    jsonb
  )
from public,
     anon,
     authenticated;


grant execute
on function
  public.record_resend_personal_follow_up_event(
    text,
    text,
    text,
    timestamptz,
    jsonb
  )
to service_role;


comment on function
  public.record_resend_personal_follow_up_event(
    text,
    text,
    text,
    timestamptz,
    jsonb
  )
is
  'Idempotently records Resend sent, delivered, opened and clicked events for Personal Follow-Up deliveries.';


-- ============================================================
-- SELLER REPORT EMAIL AGGREGATION
-- ============================================================

do $seller_report_patch$
declare
  function_sql text;
  normalized_sql text;
  patched_sql text;

  start_marker text :=
    'production_recipients as (';

  end_marker text :=
    'email_lifetime as (';

  start_position integer;
  end_position integer;

  replacement_sql text;
begin
  function_sql :=
    pg_get_functiondef(
      'public.get_listing_seller_report_metrics(uuid,timestamp with time zone,timestamp with time zone)'::regprocedure
    );

  normalized_sql :=
    lower(
      function_sql
    );

  if position(
    'email_personal_follow_up_deliveries'
    in normalized_sql
  ) = 0 then
    if regexp_count(
      normalized_sql,
      'production_recipients\s+as\s*\('
    ) <> 1 then
      raise exception
        'Preflight failed: expected exactly one production_recipients CTE.';
    end if;

    if regexp_count(
      normalized_sql,
      'email_lifetime\s+as\s*\('
    ) <> 1 then
      raise exception
        'Preflight failed: expected exactly one email_lifetime CTE.';
    end if;

    start_position :=
      position(
        start_marker
        in normalized_sql
      );

    end_position :=
      position(
        end_marker
        in normalized_sql
      );

    if start_position = 0
       or end_position = 0
       or end_position <= start_position
    then
      raise exception
        'Preflight failed: Seller Report CTE boundaries were not found.';
    end if;

    replacement_sql :=
$replacement$
production_recipients as (
    select
      recipient.campaign_id,
      recipient.sent_at,
      recipient.delivered_at,
      recipient.first_opened_at,
      recipient.first_clicked_at,
      recipient.first_replied_at

    from public.email_campaign_recipients
      as recipient

    join eligible_campaigns
      as campaign
      on campaign.id =
        recipient.campaign_id

    where recipient.sent_at
      is not null


    union all


    select
      delivery.source_campaign_id
        as campaign_id,

      delivery.sent_at,

      delivery.delivered_at,

      delivery.first_opened_at,

      delivery.first_clicked_at,

      null::timestamptz
        as first_replied_at

    from public.email_personal_follow_up_deliveries
      as delivery

    join eligible_campaigns
      as campaign
      on campaign.id =
        delivery.source_campaign_id

    where delivery.status =
        'sent'

      and delivery.sent_at
        is not null
  ),

  $replacement$;

    patched_sql :=
      substring(
        function_sql
        from 1
        for start_position - 1
      )
      || replacement_sql
      || substring(
           function_sql
           from end_position
         );

    if patched_sql =
      function_sql
    then
      raise exception
        'Patch failed: Seller Report function was unchanged.';
    end if;

    execute patched_sql;
  end if;


  if position(
    'email_personal_follow_up_deliveries'
    in lower(
      pg_get_functiondef(
        'public.get_listing_seller_report_metrics(uuid,timestamp with time zone,timestamp with time zone)'::regprocedure
      )
    )
  ) = 0 then
    raise exception
      'Postflight failed: Personal Follow-Up delivery table is missing from Seller Report.';
  end if;
end;
$seller_report_patch$;


commit;
