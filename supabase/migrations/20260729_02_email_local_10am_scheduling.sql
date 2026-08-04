begin;


-- ============================================================
-- MARKETING TIMEZONE STORAGE
-- ============================================================

alter table public.contacts
  add column if not exists
    marketing_time_zone text;


comment on column
  public.contacts.marketing_time_zone
is
  'Optional IANA timezone used to schedule marketing email at the recipient local time.';


alter table public.email_campaign_recipients
  add column if not exists
    marketing_time_zone text;


alter table public.email_campaign_recipients
  add column if not exists
    marketing_time_zone_source text;


alter table public.email_campaign_recipients
  add column if not exists
    scheduled_at timestamptz;


comment on column
  public.email_campaign_recipients.marketing_time_zone
is
  'Frozen IANA timezone used for this recipient campaign delivery.';


comment on column
  public.email_campaign_recipients.marketing_time_zone_source
is
  'How the frozen recipient marketing timezone was resolved: recipient_override, contact, organization or utc_fallback.';


comment on column
  public.email_campaign_recipients.scheduled_at
is
  'Exact UTC delivery time calculated from the recipient local marketing send time.';


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'email_campaign_recipients_time_zone_source_check'
      and conrelid =
        'public.email_campaign_recipients'::regclass
  ) then
    alter table
      public.email_campaign_recipients
    add constraint
      email_campaign_recipients_time_zone_source_check
    check (
      marketing_time_zone_source is null
      or marketing_time_zone_source in (
        'recipient_override',
        'contact',
        'organization',
        'utc_fallback'
      )
    );
  end if;
end;
$$;


create index if not exists
  email_campaign_recipients_due_idx
on public.email_campaign_recipients (
  status,
  scheduled_at
)
where
  status = 'queued'
  and scheduled_at is not null;


-- ============================================================
-- RESOLVE THE BEST AVAILABLE TIMEZONE
-- ============================================================

create or replace function
  public.email_resolve_marketing_time_zone(
    p_recipient_time_zone text,
    p_contact_time_zone text,
    p_organization_time_zone text
  )
returns table (
  resolved_time_zone text,
  resolved_source text
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  candidate text;
begin
  candidate :=
    nullif(
      btrim(
        p_recipient_time_zone
      ),
      ''
    );

  if
    candidate is not null
    and exists (
      select 1
      from pg_timezone_names
      where name = candidate
    )
  then
    return query
    select
      candidate,
      'recipient_override'::text;

    return;
  end if;


  candidate :=
    nullif(
      btrim(
        p_contact_time_zone
      ),
      ''
    );

  if
    candidate is not null
    and exists (
      select 1
      from pg_timezone_names
      where name = candidate
    )
  then
    return query
    select
      candidate,
      'contact'::text;

    return;
  end if;


  candidate :=
    nullif(
      btrim(
        p_organization_time_zone
      ),
      ''
    );

  if
    candidate is not null
    and exists (
      select 1
      from pg_timezone_names
      where name = candidate
    )
  then
    return query
    select
      candidate,
      'organization'::text;

    return;
  end if;


  return query
  select
    'UTC'::text,
    'utc_fallback'::text;
end;
$$;


-- ============================================================
-- NEXT AVAILABLE 10:00 AM IN THE RESOLVED LOCAL TIMEZONE
-- ============================================================

create or replace function
  public.email_next_local_10am_at(
    p_not_before timestamptz,
    p_time_zone text
  )
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  resolved_time_zone text;
  local_not_before timestamp;
  local_target timestamp;
begin
  if p_not_before is null then
    raise exception
      'A not-before time is required.';
  end if;


  resolved_time_zone :=
    nullif(
      btrim(
        p_time_zone
      ),
      ''
    );


  if
    resolved_time_zone is null
    or not exists (
      select 1
      from pg_timezone_names
      where name =
        resolved_time_zone
    )
  then
    resolved_time_zone :=
      'UTC';
  end if;


  local_not_before :=
    p_not_before
      at time zone
        resolved_time_zone;


  local_target :=
    date_trunc(
      'day',
      local_not_before
    )
    + interval '10 hours';


  if local_not_before >
    local_target
  then
    local_target :=
      local_target
      + interval '1 day';
  end if;


  return
    local_target
      at time zone
        resolved_time_zone;
end;
$$;


-- ============================================================
-- FREEZE CURRENT RECIPIENT TIMEZONES
-- ============================================================

with resolved_recipient_time_zones as (
  select
    recipient.id,

    resolved.resolved_time_zone,

    resolved.resolved_source

  from public.email_campaign_recipients
    as recipient

  join public.email_campaigns
    as campaign
    on campaign.id =
      recipient.campaign_id

  join public.organizations
    as organization
    on organization.id =
      campaign.org_id

  left join public.contacts
    as contact
    on contact.id =
      recipient.contact_id

  cross join lateral
    public.email_resolve_marketing_time_zone(
      case
        when recipient
          .marketing_time_zone_source =
          'recipient_override'
        then recipient
          .marketing_time_zone

        else null
      end,

      contact.marketing_time_zone,

      organization.timezone
    ) as resolved
)

update public.email_campaign_recipients
  as recipient

set
  marketing_time_zone =
    resolved
      .resolved_time_zone,

  marketing_time_zone_source =
    resolved
      .resolved_source,

  updated_at =
    now()

from resolved_recipient_time_zones
  as resolved

where recipient.id =
  resolved.id;


-- ============================================================
-- SCHEDULE A CAMPAIGN FOR RECIPIENT-LOCAL 10:00 AM
-- This function schedules only. It never sends.
-- ============================================================

create or replace function
  public.schedule_email_campaign_for_local_10am(
    p_campaign_id uuid,
    p_requester_id uuid,
    p_not_before timestamptz
      default null
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requester_row record;
  campaign_row record;

  resolved_not_before timestamptz;

  scheduled_count integer;
  earliest_scheduled_at timestamptz;
  latest_scheduled_at timestamptz;
begin
  if p_campaign_id is null then
    raise exception
      'Campaign ID is required.';
  end if;


  if p_requester_id is null then
    raise exception
      'Requester ID is required.';
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


  select
    campaign.id,
    campaign.org_id,
    campaign.owner_user_id,
    campaign.status,

    organization.timezone
      as organization_time_zone

  into campaign_row

  from public.email_campaigns
    as campaign

  join public.organizations
    as organization
    on organization.id =
      campaign.org_id

  where campaign.id =
    p_campaign_id

  for update of campaign;


  if not found then
    raise exception
      'Campaign was not found.';
  end if;


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


  if campaign_row.owner_user_id
    is null
  then
    raise exception
      'Campaign owner is required.';
  end if;


  if campaign_row.status not in (
    'draft',
    'scheduled'
  )
  then
    raise exception
      'Only a draft or unsent scheduled campaign can be scheduled.';
  end if;


  if exists (
    select 1

    from public.email_campaign_recipients
      as recipient

    where recipient.campaign_id =
        campaign_row.id

      and (
        recipient.status not in (
          'queued',
          'suppressed',
          'skipped',
          'unsubscribed'
        )

        or recipient.send_attempts > 0

        or recipient.resend_email_id
          is not null

        or recipient.sent_at
          is not null

        or recipient.delivered_at
          is not null

        or recipient.bounced_at
          is not null

        or recipient.complained_at
          is not null

        or recipient.failed_at
          is not null

        or recipient.error_message
          is not null
      )
  )
  then
    raise exception
      'This campaign already has delivery activity and cannot be rescheduled.';
  end if;


  resolved_not_before :=
    coalesce(
      p_not_before,
      clock_timestamp()
    );


  with resolved_recipients as (
    select
      recipient.id,

      resolved.resolved_time_zone,

      resolved.resolved_source,

      public.email_next_local_10am_at(
        resolved_not_before,
        resolved.resolved_time_zone
      ) as resolved_scheduled_at

    from public.email_campaign_recipients
      as recipient

    left join public.contacts
      as contact
      on contact.id =
        recipient.contact_id

    cross join lateral
      public.email_resolve_marketing_time_zone(
        case
          when recipient
            .marketing_time_zone_source =
            'recipient_override'
          then recipient
            .marketing_time_zone

          else null
        end,

        contact.marketing_time_zone,

        campaign_row
          .organization_time_zone
      ) as resolved

    where recipient.campaign_id =
        campaign_row.id

      and recipient.status =
        'queued'
  ),

  scheduled_recipients as (
    update public.email_campaign_recipients
      as recipient

    set
      marketing_time_zone =
        resolved
          .resolved_time_zone,

      marketing_time_zone_source =
        resolved
          .resolved_source,

      scheduled_at =
        resolved
          .resolved_scheduled_at,

      recipient_context =
        jsonb_set(
          recipient.recipient_context,

          '{delivery_schedule}',

          jsonb_build_object(
            'version',
            1,

            'policy',
            'recipient_local_10am',

            'local_hour',
            10,

            'time_zone',
            resolved
              .resolved_time_zone,

            'time_zone_source',
            resolved
              .resolved_source,

            'not_before',
            resolved_not_before,

            'scheduled_at',
            resolved
              .resolved_scheduled_at
          ),

          true
        ),

      updated_at =
        now()

    from resolved_recipients
      as resolved

    where recipient.id =
      resolved.id

    returning recipient.scheduled_at
  )

  select
    count(*),
    min(scheduled_at),
    max(scheduled_at)

  into
    scheduled_count,
    earliest_scheduled_at,
    latest_scheduled_at

  from scheduled_recipients;


  if scheduled_count = 0 then
    raise exception
      'The campaign has no queued recipients to schedule.';
  end if;


  update public.email_campaigns
    as campaign

  set
    status =
      'scheduled',

    scheduled_at =
      earliest_scheduled_at,

    send_started_at =
      null,

    sent_at =
      null,

    last_error =
      null,

    send_reason =
      'recipient_local_10am',

    design_settings =
      jsonb_set(
        campaign.design_settings,

        '{delivery_schedule}',

        jsonb_build_object(
          'version',
          1,

          'policy',
          'recipient_local_10am',

          'local_hour',
          10,

          'requested_not_before',
          resolved_not_before,

          'earliest_scheduled_at',
          earliest_scheduled_at,

          'latest_scheduled_at',
          latest_scheduled_at,

          'recipient_count',
          scheduled_count
        ),

        true
      ),

    updated_at =
      now()

  where campaign.id =
    campaign_row.id;


  return jsonb_build_object(
    'scheduled',
    true,

    'campaign_id',
    campaign_row.id,

    'recipient_count',
    scheduled_count,

    'policy',
    'recipient_local_10am',

    'local_hour',
    10,

    'requested_not_before',
    resolved_not_before,

    'earliest_scheduled_at',
    earliest_scheduled_at,

    'latest_scheduled_at',
    latest_scheduled_at
  );
end;
$$;


-- ============================================================
-- WRAP THE VERIFIED PERSONAL FOLLOW-UP REGISTRATION
-- ============================================================

do $$
begin
  if to_regprocedure(
    'public.register_email_personal_follow_up_base(uuid,uuid,timestamp with time zone)'
  ) is null
  then
    if to_regprocedure(
      'public.register_email_personal_follow_up(uuid,uuid,timestamp with time zone)'
    ) is null
    then
      raise exception
        'The verified Personal Follow-up registration function was not found.';
    end if;

    alter function
      public.register_email_personal_follow_up(
        uuid,
        uuid,
        timestamptz
      )
    rename to
      register_email_personal_follow_up_base;
  end if;
end;
$$;


create or replace function
  public.register_email_personal_follow_up(
    p_campaign_id uuid,
    p_recipient_id uuid,
    p_sent_at timestamptz
      default null
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  base_result jsonb;

  resolved_time_zone text;
  resolved_time_zone_source text;

  requested_send_at timestamptz;
  scheduled_send_at timestamptz;

  sequence_id uuid;
  sequence_step_id uuid;
  enrollment_id uuid;
begin
  base_result :=
    public
      .register_email_personal_follow_up_base(
        p_campaign_id,
        p_recipient_id,
        p_sent_at
      );


  if coalesce(
    (
      base_result
        ->> 'scheduled'
    )::boolean,
    false
  ) is not true
  then
    return base_result;
  end if;


  select
    resolved.resolved_time_zone,
    resolved.resolved_source

  into
    resolved_time_zone,
    resolved_time_zone_source

  from public.email_campaign_recipients
    as recipient

  join public.email_campaigns
    as campaign
    on campaign.id =
      recipient.campaign_id

  join public.organizations
    as organization
    on organization.id =
      campaign.org_id

  left join public.contacts
    as contact
    on contact.id =
      recipient.contact_id

  cross join lateral
    public.email_resolve_marketing_time_zone(
      case
        when recipient
          .marketing_time_zone_source =
          'recipient_override'
        then recipient
          .marketing_time_zone

        else null
      end,

      contact.marketing_time_zone,

      organization.timezone
    ) as resolved

  where recipient.id =
      p_recipient_id

    and recipient.campaign_id =
      p_campaign_id;


  if resolved_time_zone
    is null
  then
    raise exception
      'The Personal Follow-up timezone could not be resolved.';
  end if;


  requested_send_at :=
    (
      base_result
        ->> 'requested_send_at'
    )::timestamptz;


  scheduled_send_at :=
    public.email_next_local_10am_at(
      requested_send_at,
      resolved_time_zone
    );


  sequence_id :=
    (
      base_result
        ->> 'sequence_id'
    )::uuid;


  sequence_step_id :=
    (
      base_result
        ->> 'sequence_step_id'
    )::uuid;


  enrollment_id :=
    (
      base_result
        ->> 'enrollment_id'
    )::uuid;


  update public.listing_email_sequence_enrollments
    as enrollment

  set
    next_send_at =
      scheduled_send_at,

    last_campaign_id =
      p_campaign_id,

    last_recipient_id =
      p_recipient_id,

    metadata =
      enrollment.metadata
      || jsonb_build_object(
        'send_time_policy',
        'recipient_local_10am',

        'send_local_hour',
        10,

        'time_zone',
        resolved_time_zone,

        'time_zone_source',
        resolved_time_zone_source,

        'requested_send_at',
        requested_send_at,

        'scheduled_at',
        scheduled_send_at
      ),

    updated_at =
      now()

  where enrollment.id =
    enrollment_id;


  update public.email_campaign_recipients
    as recipient

  set
    marketing_time_zone =
      resolved_time_zone,

    marketing_time_zone_source =
      resolved_time_zone_source,

    recipient_context =
      jsonb_set(
        recipient.recipient_context,

        '{personal_follow_up}',

        coalesce(
          recipient.recipient_context
            -> 'personal_follow_up',

          '{}'::jsonb
        )
        || jsonb_build_object(
          'send_time_policy',
          'recipient_local_10am',

          'send_local_hour',
          10,

          'time_zone',
          resolved_time_zone,

          'time_zone_source',
          resolved_time_zone_source,

          'requested_send_at',
          requested_send_at,

          'scheduled_at',
          scheduled_send_at
        ),

        true
      ),

    updated_at =
      now()

  where recipient.id =
    p_recipient_id;


  update public.listing_email_sequences
    as sequence

  set
    settings =
      sequence.settings
      || jsonb_build_object(
        'send_time_policy',
        'recipient_local_10am',

        'send_local_hour',
        10
      ),

    updated_at =
      now()

  where sequence.id =
    sequence_id;


  update public.listing_email_sequence_steps
    as step

  set
    step_settings =
      step.step_settings
      || jsonb_build_object(
        'send_time_policy',
        'recipient_local_10am',

        'send_local_hour',
        10
      ),

    updated_at =
      now()

  where step.id =
    sequence_step_id;


  update public.email_campaigns
    as campaign

  set
    design_settings =
      jsonb_set(
        campaign.design_settings,

        '{personal_follow_up}',

        coalesce(
          campaign.design_settings
            -> 'personal_follow_up',

          '{}'::jsonb
        )
        || jsonb_build_object(
          'send_time_policy',
          'recipient_local_10am',

          'send_local_hour',
          10
        ),

        true
      ),

    updated_at =
      now()

  where campaign.id =
    p_campaign_id;


  return
    base_result
    || jsonb_build_object(
      'scheduled_at',
      scheduled_send_at,

      'time_zone',
      resolved_time_zone,

      'time_zone_source',
      resolved_time_zone_source,

      'send_time_policy',
      'recipient_local_10am',

      'send_local_hour',
      10
    );
end;
$$;


-- ============================================================
-- FUNCTION PERMISSIONS
-- ============================================================

revoke all
on function
  public.email_resolve_marketing_time_zone(
    text,
    text,
    text
  )
from public,
     anon,
     authenticated;


revoke all
on function
  public.email_next_local_10am_at(
    timestamptz,
    text
  )
from public,
     anon,
     authenticated;


revoke all
on function
  public.schedule_email_campaign_for_local_10am(
    uuid,
    uuid,
    timestamptz
  )
from public,
     anon,
     authenticated;


revoke all
on function
  public.register_email_personal_follow_up_base(
    uuid,
    uuid,
    timestamptz
  )
from public,
     anon,
     authenticated,
     service_role;


revoke all
on function
  public.register_email_personal_follow_up(
    uuid,
    uuid,
    timestamptz
  )
from public,
     anon,
     authenticated;


grant execute
on function
  public.schedule_email_campaign_for_local_10am(
    uuid,
    uuid,
    timestamptz
  )
to service_role;


grant execute
on function
  public.register_email_personal_follow_up(
    uuid,
    uuid,
    timestamptz
  )
to service_role;


comment on function
  public.schedule_email_campaign_for_local_10am(
    uuid,
    uuid,
    timestamptz
  )
is
  'Schedules every queued recipient for the next 10:00 AM in the best available recipient timezone. This function never sends email.';


comment on function
  public.register_email_personal_follow_up(
    uuid,
    uuid,
    timestamptz
  )
is
  'Registers the verified recipient-specific Personal Follow-up and schedules it for the next 10:00 AM in the best available recipient timezone after the configured delay.';


commit;