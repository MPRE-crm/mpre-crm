begin;

-- ============================================================
-- PERSONAL FOLLOW-UP DELAY SUPPORT
-- ============================================================

alter table public.listing_email_sequence_steps
  drop constraint if exists
    listing_email_sequence_steps_delay_check;

alter table public.listing_email_sequence_steps
  add constraint
    listing_email_sequence_steps_delay_check
  check (
    (
      delay_unit = 'hours'
      and delay_value between 0 and 8760
    )
    or (
      delay_unit in (
        'days',
        'weeks'
      )
      and delay_value between 0 and 365
    )
  );


-- ============================================================
-- ONE PERSONAL FOLLOW-UP SEQUENCE PER SOURCE CAMPAIGN
-- ============================================================

create unique index if not exists
  listing_email_sequences_personal_follow_up_campaign_unique
on public.listing_email_sequences (
  (
    settings
      ->> 'source_campaign_id'
  )
)
where
  settings
    ->> 'kind' =
      'personal_follow_up';


-- ============================================================
-- ORGANIZATION-LOCAL SAFE SEND TIME
-- ============================================================

create or replace function
  public.email_safe_send_at(
    p_requested_at timestamptz,
    p_time_zone text,
    p_safe_start_hour integer
      default 8,
    p_safe_end_hour integer
      default 19
  )
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  resolved_time_zone text;
  local_requested timestamp;
  local_safe timestamp;
  local_hour integer;
begin
  if p_requested_at is null then
    raise exception
      'Requested send time is required.';
  end if;

  if
    p_safe_start_hour < 0
    or p_safe_start_hour > 23
    or p_safe_end_hour < 1
    or p_safe_end_hour > 24
    or p_safe_start_hour >=
      p_safe_end_hour
  then
    raise exception
      'Safe send hours are invalid.';
  end if;

  resolved_time_zone :=
    coalesce(
      nullif(
        btrim(
          p_time_zone
        ),
        ''
      ),
      'UTC'
    );

  if not exists (
    select 1
    from pg_timezone_names
    where name =
      resolved_time_zone
  ) then
    resolved_time_zone :=
      'UTC';
  end if;

  local_requested :=
    p_requested_at
      at time zone
        resolved_time_zone;

  local_hour :=
    extract(
      hour
      from local_requested
    )::integer;

  if local_hour <
    p_safe_start_hour
  then
    local_safe :=
      date_trunc(
        'day',
        local_requested
      )
      + make_interval(
          hours =>
            p_safe_start_hour
        );

  elsif local_hour >=
    p_safe_end_hour
  then
    local_safe :=
      date_trunc(
        'day',
        local_requested
      )
      + interval '1 day'
      + make_interval(
          hours =>
            p_safe_start_hour
        );

  else
    local_safe :=
      local_requested;
  end if;

  return
    local_safe
      at time zone
        resolved_time_zone;
end;
$$;


-- ============================================================
-- REGISTER FOLLOW-UP AFTER ORIGINAL RECIPIENT SEND
-- ============================================================

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
#variable_conflict use_variable
declare
  source_row record;

  follow_up jsonb;
  category_copy jsonb;
  enrollment_metadata jsonb;

  category_key text;
  subject_text text;
  preview_text text;
  paragraph_text text;
  resolved_time_zone text;

  delay_hours integer;
  stop_after_reply boolean;

  requested_send_at timestamptz;
  safe_send_at timestamptz;

  sequence_id uuid;
  sequence_step_id uuid;
  enrollment_id uuid;
  existing_status text;
begin
  if p_campaign_id is null then
    raise exception
      'Campaign ID is required.';
  end if;

  if p_recipient_id is null then
    raise exception
      'Recipient ID is required.';
  end if;

  select
    campaign.id
      as campaign_id,

    campaign.name
      as campaign_name,

    campaign.org_id,

    campaign.owner_user_id,

    campaign.listing_id,

    campaign.design_settings,

    recipient.id
      as recipient_id,

    recipient.contact_id,

    recipient.realtor_match_id,

    recipient.email,

    recipient.email_normalized,

    recipient.first_name,

    recipient.last_name,

    recipient.display_name,

    recipient.company,

    recipient.status
      as recipient_status,

    recipient.sent_at,

    recipient.recipient_context,

    organization.timezone

  into source_row

  from public.email_campaigns
    as campaign

  join public.email_campaign_recipients
    as recipient
    on recipient.campaign_id =
      campaign.id

  join public.organizations
    as organization
    on organization.id =
      campaign.org_id

  where campaign.id =
      p_campaign_id

    and recipient.id =
      p_recipient_id

  for update of
    campaign,
    recipient;

  if not found then
    raise exception
      'Campaign recipient was not found.';
  end if;

  if source_row.listing_id
    is null
  then
    return jsonb_build_object(
      'scheduled',
      false,
      'reason',
      'listing_required'
    );
  end if;

  if source_row.owner_user_id
    is null
  then
    raise exception
      'Campaign owner is required.';
  end if;

  if source_row.sent_at
    is null
  then
    return jsonb_build_object(
      'scheduled',
      false,
      'reason',
      'original_recipient_not_sent'
    );
  end if;

  follow_up :=
    source_row
      .design_settings
      -> 'personal_follow_up';

  if
    follow_up is null
    or jsonb_typeof(
      follow_up
    ) <> 'object'
    or lower(
      coalesce(
        follow_up
          ->> 'enabled',
        'false'
      )
    ) <> 'true'
  then
    return jsonb_build_object(
      'scheduled',
      false,
      'reason',
      'personal_follow_up_disabled'
    );
  end if;

  if
    coalesce(
      follow_up
        ->> 'delay_hours',
      ''
    ) ~ '^(24|36|48)$'
  then
    delay_hours :=
      (
        follow_up
          ->> 'delay_hours'
      )::integer;
  else
    delay_hours := 36;
  end if;

  stop_after_reply :=
    lower(
      coalesce(
        follow_up
          ->> 'stop_after_reply',
        'true'
      )
    ) <> 'false';

  category_key :=
    coalesce(
      nullif(
        btrim(
          source_row
            .recipient_context
            -> 'samantha_classification'
            ->> 'audience'
        ),
        ''
      ),

      nullif(
        btrim(
          source_row
            .recipient_context
            -> 'contact'
            ->> 'contact_category'
        ),
        ''
      ),

      'unknown'
    );

  category_copy :=
    follow_up
      -> 'categories'
      -> category_key;

  if
    category_copy is null
    or jsonb_typeof(
      category_copy
    ) <> 'object'
  then
    category_key :=
      'unknown';

    category_copy :=
      follow_up
        -> 'categories'
        -> 'unknown';
  end if;

  subject_text :=
    btrim(
      coalesce(
        category_copy
          ->> 'subject',
        ''
      )
    );

  preview_text :=
    btrim(
      coalesce(
        category_copy
          ->> 'preview_text',
        ''
      )
    );

  paragraph_text :=
    btrim(
      coalesce(
        category_copy
          ->> 'follow_up_paragraph',
        ''
      )
    );

  if
    subject_text = ''
    or paragraph_text = ''
  then
    return jsonb_build_object(
      'scheduled',
      false,
      'reason',
      'personal_follow_up_copy_missing',
      'category',
      category_key
    );
  end if;

  resolved_time_zone :=
    coalesce(
      nullif(
        btrim(
          source_row.timezone
        ),
        ''
      ),
      'UTC'
    );

  requested_send_at :=
    coalesce(
      source_row.sent_at,
      p_sent_at,
      clock_timestamp()
    )
    + make_interval(
        hours =>
          delay_hours
      );

  safe_send_at :=
    public.email_safe_send_at(
      requested_send_at,
      resolved_time_zone,
      8,
      19
    );


  -- ----------------------------------------------------------
  -- CREATE OR REUSE THE CAMPAIGN'S PERSONAL FOLLOW-UP SEQUENCE
  -- ----------------------------------------------------------

  select sequence.id
  into sequence_id
  from public.listing_email_sequences
    as sequence
  where sequence.settings
      ->> 'kind' =
        'personal_follow_up'

    and sequence.settings
      ->> 'source_campaign_id' =
        source_row
          .campaign_id::text
  limit 1
  for update;

  if sequence_id is null then
    insert into
      public.listing_email_sequences (
        org_id,
        owner_user_id,
        listing_id,
        name,
        status,
        audience_mode,
        cadence_value,
        cadence_unit,
        repeat_mode,
        start_at,
        settings,
        created_by
      )
    values (
      source_row.org_id,
      source_row.owner_user_id,
      source_row.listing_id,
      left(
        'Personal Follow-up - ' ||
        source_row.campaign_name,
        200
      ),
      'active',
      'manual',
      1,
      'days',
      'stop_after_cycle',
      source_row.sent_at,
      jsonb_build_object(
        'kind',
        'personal_follow_up',

        'version',
        1,

        'source_campaign_id',
        source_row.campaign_id,

        'time_zone',
        resolved_time_zone,

        'safe_start_hour',
        8,

        'safe_end_hour',
        19
      ),
      source_row.owner_user_id
    )
    on conflict do nothing
    returning id
    into sequence_id;
  end if;

  if sequence_id is null then
    select sequence.id
    into sequence_id
    from public.listing_email_sequences
      as sequence
    where sequence.settings
        ->> 'kind' =
          'personal_follow_up'

      and sequence.settings
        ->> 'source_campaign_id' =
          source_row
            .campaign_id::text
    limit 1;
  end if;

  if sequence_id is null then
    raise exception
      'Personal follow-up sequence could not be created.';
  end if;

  update public.listing_email_sequences
    as sequence
  set
    status =
      'active',

    start_at =
      coalesce(
        sequence.start_at,
        source_row.sent_at
      ),

    settings =
      sequence.settings
      || jsonb_build_object(
        'kind',
        'personal_follow_up',

        'version',
        1,

        'source_campaign_id',
        source_row.campaign_id,

        'time_zone',
        resolved_time_zone,

        'safe_start_hour',
        8,

        'safe_end_hour',
        19
      )

  where sequence.id =
    sequence_id;


  -- ----------------------------------------------------------
  -- CREATE OR UPDATE THE QUICK-NOTE SEQUENCE STEP
  -- ----------------------------------------------------------

  insert into
    public.listing_email_sequence_steps (
      sequence_id,
      org_id,
      owner_user_id,
      step_order,
      creative_kind,
      creative_key,
      presentation_mode,
      subject_strategy,
      delay_value,
      delay_unit,
      trigger_rule,
      step_settings,
      is_enabled
    )
  values (
    sequence_id,
    source_row.org_id,
    source_row.owner_user_id,
    1,
    'quick_note',
    'personal_follow_up',
    'plain_text',
    'manual',
    delay_hours,
    'hours',
    jsonb_build_object(
      'after',
      'original_recipient_sent',

      'stop_after_reply',
      stop_after_reply
    ),
    jsonb_build_object(
      'source_campaign_id',
      source_row.campaign_id,

      'time_zone',
      resolved_time_zone,

      'safe_start_hour',
      8,

      'safe_end_hour',
      19
    ),
    true
  )
  on conflict on constraint
    listing_email_sequence_steps_unique
  do update set
    creative_kind =
      excluded.creative_kind,

    creative_key =
      excluded.creative_key,

    presentation_mode =
      excluded.presentation_mode,

    subject_strategy =
      excluded.subject_strategy,

    delay_value =
      excluded.delay_value,

    delay_unit =
      excluded.delay_unit,

    trigger_rule =
      excluded.trigger_rule,

    step_settings =
      excluded.step_settings,

    is_enabled =
      true,

    updated_at =
      now()

  returning id
  into sequence_step_id;


  -- ----------------------------------------------------------
  -- FREEZE THE RECIPIENT-SPECIFIC FOLLOW-UP COPY
  -- ----------------------------------------------------------

  enrollment_metadata :=
    jsonb_build_object(
      'kind',
      'personal_follow_up',

      'version',
      1,

      'outcome',
      'scheduled',

      'source_campaign_id',
      source_row.campaign_id,

      'source_recipient_id',
      source_row.recipient_id,

      'source_sent_at',
      source_row.sent_at,

      'category',
      category_key,

      'subject',
      subject_text,

      'preview_text',
      preview_text,

      'follow_up_paragraph',
      paragraph_text,

      'delay_hours',
      delay_hours,

      'stop_after_reply',
      stop_after_reply,

      'time_zone',
      resolved_time_zone,

      'safe_start_hour',
      8,

      'safe_end_hour',
      19,

      'requested_send_at',
      requested_send_at,

      'scheduled_at',
      safe_send_at
    );


  insert into
    public.listing_email_sequence_enrollments (
      sequence_id,
      org_id,
      owner_user_id,
      listing_id,
      contact_id,
      realtor_match_id,
      email,
      email_normalized,
      first_name,
      last_name,
      display_name,
      company,
      status,
      current_step_order,
      next_send_at,
      stop_reason,
      metadata
    )
  values (
    sequence_id,
    source_row.org_id,
    source_row.owner_user_id,
    source_row.listing_id,
    source_row.contact_id,
    source_row.realtor_match_id,
    source_row.email,
    source_row.email_normalized,
    source_row.first_name,
    source_row.last_name,
    source_row.display_name,
    source_row.company,
    'active',
    1,
    safe_send_at,
    null,
    enrollment_metadata
  )
  on conflict on constraint
    listing_email_enrollments_unique
  do update set
    contact_id =
      excluded.contact_id,

    realtor_match_id =
      excluded.realtor_match_id,

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
      'active',

    current_step_order =
      1,

    next_send_at =
      excluded.next_send_at,

    stop_reason =
      null,

    metadata =
      excluded.metadata,

    updated_at =
      now()

  where
    public
      .listing_email_sequence_enrollments
      .status
    in (
      'queued',
      'active',
      'paused'
    )

  returning id
  into enrollment_id;

  if enrollment_id is null then
    select
      enrollment.id,
      enrollment.status
    into
      enrollment_id,
      existing_status
    from public.listing_email_sequence_enrollments
      as enrollment
    where enrollment.sequence_id =
        sequence_id

      and enrollment.email_normalized =
        source_row.email_normalized;

    return jsonb_build_object(
      'scheduled',
      false,
      'reason',
      'personal_follow_up_already_finalized',
      'enrollment_id',
      enrollment_id,
      'status',
      existing_status
    );
  end if;


  -- ----------------------------------------------------------
  -- LINK THE ORIGINAL RECIPIENT AND CAMPAIGN TO THE FOLLOW-UP
  -- ----------------------------------------------------------

  update public.email_campaign_recipients
    as recipient
  set
    sequence_enrollment_id =
      enrollment_id,

    sequence_step_id =
      sequence_step_id,

    recipient_context =
      recipient.recipient_context
      || jsonb_build_object(
        'personal_follow_up',
        jsonb_build_object(
          'sequence_id',
          sequence_id,

          'sequence_step_id',
          sequence_step_id,

          'enrollment_id',
          enrollment_id,

          'category',
          category_key,

          'scheduled_at',
          safe_send_at
        )
      ),

    updated_at =
      now()

  where recipient.id =
    source_row.recipient_id;


  update public.email_campaigns
    as campaign
  set
    design_settings =
      jsonb_set(
        jsonb_set(
          jsonb_set(
            campaign.design_settings,
            '{personal_follow_up,sequence_id}',
            to_jsonb(
              sequence_id
            ),
            true
          ),
          '{personal_follow_up,sequence_step_id}',
          to_jsonb(
            sequence_step_id
          ),
          true
        ),
        '{personal_follow_up,time_zone}',
        to_jsonb(
          resolved_time_zone
        ),
        true
      ),

    updated_at =
      now()

  where campaign.id =
    source_row.campaign_id;


  return jsonb_build_object(
    'scheduled',
    true,

    'campaign_id',
    source_row.campaign_id,

    'recipient_id',
    source_row.recipient_id,

    'sequence_id',
    sequence_id,

    'sequence_step_id',
    sequence_step_id,

    'enrollment_id',
    enrollment_id,

    'category',
    category_key,

    'delay_hours',
    delay_hours,

    'requested_send_at',
    requested_send_at,

    'scheduled_at',
    safe_send_at,

    'time_zone',
    resolved_time_zone
  );
end;
$$;


revoke all
on function
  public.email_safe_send_at(
    timestamptz,
    text,
    integer,
    integer
  )
from public,
     anon,
     authenticated;

grant execute
on function
  public.email_safe_send_at(
    timestamptz,
    text,
    integer,
    integer
  )
to service_role;


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
  public.register_email_personal_follow_up(
    uuid,
    uuid,
    timestamptz
  )
to service_role;


comment on function
  public.register_email_personal_follow_up(
    uuid,
    uuid,
    timestamptz
  )
is
  'Creates or updates a recipient-specific Personal Follow-up enrollment only after the original campaign recipient has been sent, freezes the correct category copy, applies the organization-local safe-send window, and links the original recipient to the follow-up sequence.';


commit;