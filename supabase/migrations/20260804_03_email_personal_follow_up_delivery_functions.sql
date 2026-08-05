begin;

do $preflight$
begin
  if to_regclass(
    'public.email_personal_follow_up_deliveries'
  ) is null then
    raise exception
      'Preflight failed: email_personal_follow_up_deliveries does not exist.';
  end if;
end;
$preflight$;


create or replace function
  public.claim_email_personal_follow_up_deliveries(
    p_limit integer default 25,
    p_claim_seconds integer default 900
  )
returns table (
  delivery_id uuid,
  enrollment_id uuid,
  org_id uuid,
  owner_user_id uuid,
  listing_id uuid,
  source_campaign_id uuid,
  source_recipient_id uuid,
  sequence_step_id uuid,
  email text,
  email_normalized text,
  first_name text,
  category text,
  subject text,
  preview_text text,
  follow_up_paragraph text,
  content_snapshot jsonb,
  scheduled_at timestamptz,
  attempt_count integer,
  idempotency_key text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_limit integer :=
    greatest(
      1,
      least(
        coalesce(p_limit, 25),
        100
      )
    );

  resolved_claim_seconds integer :=
    greatest(
      60,
      least(
        coalesce(p_claim_seconds, 900),
        3600
      )
    );

  claim_time timestamptz :=
    clock_timestamp();
begin
  update public.email_personal_follow_up_deliveries
    as delivery
  set
    status = 'queued',
    retry_at = claim_time,
    claimed_at = null,
    claim_expires_at = null,
    error_code = 'claim_expired',
    error_message =
      'A previous processor claim expired before finalization.',
    updated_at = claim_time
  where delivery.status = 'processing'
    and delivery.sent_at is null
    and delivery.claim_expires_at is not null
    and delivery.claim_expires_at < claim_time;


  insert into public.email_personal_follow_up_deliveries (
    enrollment_id,
    sequence_id,
    sequence_step_id,
    org_id,
    owner_user_id,
    listing_id,
    source_campaign_id,
    source_recipient_id,
    email,
    email_normalized,
    first_name,
    category,
    subject,
    preview_text,
    follow_up_paragraph,
    content_snapshot,
    status,
    scheduled_at,
    idempotency_key
  )
  select
    enrollment.id,
    enrollment.sequence_id,
    step.id,
    enrollment.org_id,
    enrollment.owner_user_id,
    enrollment.listing_id,
    (
      enrollment.metadata
        ->> 'source_campaign_id'
    )::uuid,
    (
      enrollment.metadata
        ->> 'source_recipient_id'
    )::uuid,
    enrollment.email,
    enrollment.email_normalized,
    enrollment.first_name,
    coalesce(
      nullif(
        btrim(
          enrollment.metadata
            ->> 'category'
        ),
        ''
      ),
      'unknown'
    ),
    enrollment.metadata
      ->> 'subject',
    nullif(
      btrim(
        enrollment.metadata
          ->> 'preview_text'
      ),
      ''
    ),
    enrollment.metadata
      ->> 'follow_up_paragraph',
    enrollment.metadata,
    'queued',
    coalesce(
      enrollment.next_send_at,
      enrollment.created_at
    ),
    (
      'personal-follow-up-' ||
      enrollment.id::text ||
      '-v1'
    )
  from public.listing_email_sequence_enrollments
    as enrollment
  join public.listing_email_sequences
    as sequence
    on sequence.id =
      enrollment.sequence_id
  join public.listing_email_sequence_steps
    as step
    on step.sequence_id =
      enrollment.sequence_id
    and step.step_order =
      enrollment.current_step_order
  where sequence.settings
      ->> 'kind' =
        'personal_follow_up'
    and enrollment.status in (
      'queued',
      'active',
      'paused'
    )
    and enrollment.last_sent_at
      is null
    and enrollment.metadata
      ->> 'source_campaign_id'
        is not null
    and enrollment.metadata
      ->> 'source_recipient_id'
        is not null
    and nullif(
      btrim(
        enrollment.metadata
          ->> 'subject'
      ),
      ''
    ) is not null
    and nullif(
      btrim(
        enrollment.metadata
          ->> 'follow_up_paragraph'
      ),
      ''
    ) is not null
  on conflict on constraint email_personal_follow_up_deliveries_enrollment_unique do nothing;


  update public.listing_email_sequence_enrollments
    as enrollment
  set
    status = 'stopped',
    next_send_at = null,
    stop_reason =
      'reply_received_before_personal_follow_up',
    metadata =
      enrollment.metadata
      || jsonb_build_object(
        'outcome',
        'stopped',
        'stop_reason',
        'reply_received_before_personal_follow_up',
        'stopped_at',
        claim_time
      ),
    updated_at = claim_time
  from public.email_personal_follow_up_deliveries
    as delivery
  join public.email_campaign_recipients
    as source_recipient
    on source_recipient.id =
      delivery.source_recipient_id
  where enrollment.id =
      delivery.enrollment_id
    and enrollment.status in (
      'queued',
      'active',
      'paused'
    )
    and delivery.status in (
      'queued',
      'failed'
    )
    and lower(
      coalesce(
        enrollment.metadata
          ->> 'stop_after_reply',
        'true'
      )
    ) <> 'false'
    and (
      source_recipient.last_replied_at
        is not null
      or source_recipient.reply_count > 0
    );


  update public.email_personal_follow_up_deliveries
    as delivery
  set
    status = 'stopped',
    stopped_at = claim_time,
    claimed_at = null,
    claim_expires_at = null,
    retry_at = null,
    error_code = 'reply_received',
    error_message =
      'The recipient replied before the Personal Follow-Up was sent.',
    updated_at = claim_time
  from public.listing_email_sequence_enrollments
    as enrollment
  where enrollment.id =
      delivery.enrollment_id
    and enrollment.status =
      'stopped'
    and enrollment.stop_reason =
      'reply_received_before_personal_follow_up'
    and delivery.status in (
      'queued',
      'failed'
    );


  update public.listing_email_sequence_enrollments
    as enrollment
  set
    status = 'suppressed',
    next_send_at = null,
    stop_reason =
      'personal_follow_up_suppressed',
    metadata =
      enrollment.metadata
      || jsonb_build_object(
        'outcome',
        'suppressed',
        'stop_reason',
        'personal_follow_up_suppressed',
        'suppressed_at',
        claim_time
      ),
    updated_at = claim_time
  from public.email_personal_follow_up_deliveries
    as delivery
  where enrollment.id =
      delivery.enrollment_id
    and enrollment.status in (
      'queued',
      'active',
      'paused'
    )
    and delivery.status in (
      'queued',
      'failed'
    )
    and (
      exists (
        select 1
        from public.email_campaign_recipients
          as source_recipient
        where source_recipient.id =
            delivery.source_recipient_id
          and (
            source_recipient.status in (
              'unsubscribed',
              'suppressed',
              'bounced',
              'complained'
            )
            or source_recipient.unsubscribed_at
              is not null
            or source_recipient.bounced_at
              is not null
            or source_recipient.complained_at
              is not null
          )
      )
      or exists (
        select 1
        from public.email_suppressions
          as suppression
        where suppression.org_id =
            delivery.org_id
          and suppression.email_normalized =
            delivery.email_normalized
      )
      or exists (
        select 1
        from public.contacts
          as contact
        where contact.id =
            enrollment.contact_id
          and (
            contact.do_not_contact =
              true
            or contact.is_archived =
              true
            or contact.email_marketing_status
              <> 'active'
          )
      )
      or exists (
        select 1
        from public.email_contact_preferences
          as preference
        where preference.org_id =
            delivery.org_id
          and preference.email_normalized =
            delivery.email_normalized
          and preference.allow_listing_ads =
            false
      )
    );


  update public.email_personal_follow_up_deliveries
    as delivery
  set
    status = 'suppressed',
    suppressed_at = claim_time,
    claimed_at = null,
    claim_expires_at = null,
    retry_at = null,
    error_code =
      'recipient_suppressed',
    error_message =
      'Current recipient permissions or suppression rules block this Personal Follow-Up.',
    updated_at = claim_time
  from public.listing_email_sequence_enrollments
    as enrollment
  where enrollment.id =
      delivery.enrollment_id
    and enrollment.status =
      'suppressed'
    and enrollment.stop_reason =
      'personal_follow_up_suppressed'
    and delivery.status in (
      'queued',
      'failed'
    );


  return query
  with candidates as (
    select
      delivery.id
    from public.email_personal_follow_up_deliveries
      as delivery
    join public.listing_email_sequence_enrollments
      as enrollment
      on enrollment.id =
        delivery.enrollment_id
    join public.listing_email_sequences
      as sequence
      on sequence.id =
        delivery.sequence_id
    join public.listing_email_sequence_steps
      as step
      on step.id =
        delivery.sequence_step_id
    join public.email_campaign_recipients
      as source_recipient
      on source_recipient.id =
        delivery.source_recipient_id
    where delivery.status in (
        'queued',
        'failed'
      )
      and delivery.sent_at
        is null
      and delivery.scheduled_at <=
        claim_time
      and (
        delivery.retry_at
          is null
        or delivery.retry_at <=
          claim_time
      )
      and delivery.attempt_count < 5
      and enrollment.status in (
        'queued',
        'active'
      )
      and enrollment.last_sent_at
        is null
      and enrollment.next_send_at <=
        claim_time
      and sequence.status =
        'active'
      and sequence.settings
        ->> 'kind' =
          'personal_follow_up'
      and step.is_enabled =
        true
      and step.creative_kind =
        'quick_note'
      and step.creative_key =
        'personal_follow_up'
      and source_recipient.status =
        'sent'
      and not (
        lower(
          coalesce(
            enrollment.metadata
              ->> 'stop_after_reply',
            'true'
          )
        ) <> 'false'
        and (
          source_recipient.last_replied_at
            is not null
          or source_recipient.reply_count > 0
        )
      )
      and not exists (
        select 1
        from public.email_suppressions
          as suppression
        where suppression.org_id =
            delivery.org_id
          and suppression.email_normalized =
            delivery.email_normalized
      )
      and not exists (
        select 1
        from public.email_contact_preferences
          as preference
        where preference.org_id =
            delivery.org_id
          and preference.email_normalized =
            delivery.email_normalized
          and preference.allow_listing_ads =
            false
      )
    order by
      coalesce(
        delivery.retry_at,
        delivery.scheduled_at
      ),
      delivery.created_at,
      delivery.id
    for update of delivery
    skip locked
    limit resolved_limit
  ),
  claimed as (
    update public.email_personal_follow_up_deliveries
      as delivery
    set
      status = 'processing',
      attempt_count =
        delivery.attempt_count + 1,
      claimed_at = claim_time,
      claim_expires_at =
        claim_time
        + make_interval(
            secs =>
              resolved_claim_seconds
          ),
      retry_at = null,
      error_code = null,
      error_message = null,
      updated_at = claim_time
    from candidates
    where delivery.id =
      candidates.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.enrollment_id,
    claimed.org_id,
    claimed.owner_user_id,
    claimed.listing_id,
    claimed.source_campaign_id,
    claimed.source_recipient_id,
    claimed.sequence_step_id,
    claimed.email,
    claimed.email_normalized,
    claimed.first_name,
    claimed.category,
    claimed.subject,
    claimed.preview_text,
    claimed.follow_up_paragraph,
    claimed.content_snapshot,
    claimed.scheduled_at,
    claimed.attempt_count,
    claimed.idempotency_key
  from claimed;
end;
$$;


create or replace function
  public.finalize_email_personal_follow_up_sent(
    p_delivery_id uuid,
    p_resend_email_id text,
    p_sent_at timestamptz default null
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  delivery_row record;

  resolved_sent_at timestamptz :=
    coalesce(
      p_sent_at,
      clock_timestamp()
    );

  resolved_resend_email_id text :=
    nullif(
      btrim(
        coalesce(
          p_resend_email_id,
          ''
        )
      ),
      ''
    );
begin
  if p_delivery_id is null then
    raise exception
      'Delivery ID is required.';
  end if;

  if resolved_resend_email_id
    is null
  then
    raise exception
      'Resend email ID is required.';
  end if;

  select *
  into delivery_row
  from public.email_personal_follow_up_deliveries
  where id =
    p_delivery_id
  for update;

  if not found then
    raise exception
      'Personal Follow-Up delivery was not found.';
  end if;

  if delivery_row.status =
      'sent'
  then
    if delivery_row.resend_email_id =
        resolved_resend_email_id
    then
      return jsonb_build_object(
        'ok',
        true,
        'already_finalized',
        true,
        'delivery_id',
        delivery_row.id,
        'enrollment_id',
        delivery_row.enrollment_id,
        'resend_email_id',
        delivery_row.resend_email_id,
        'sent_at',
        delivery_row.sent_at
      );
    end if;

    raise exception
      'Delivery was already finalized with another Resend email ID.';
  end if;

  if delivery_row.status <>
      'processing'
  then
    raise exception
      'Only a processing Personal Follow-Up delivery can be finalized as sent.';
  end if;

  update public.email_personal_follow_up_deliveries
  set
    status = 'sent',
    resend_email_id =
      resolved_resend_email_id,
    sent_at = resolved_sent_at,
    failed_at = null,
    claimed_at = null,
    claim_expires_at = null,
    retry_at = null,
    error_code = null,
    error_message = null,
    updated_at = resolved_sent_at
  where id =
    delivery_row.id;


  update public.listing_email_sequence_enrollments
    as enrollment
  set
    status = 'completed',
    last_sent_at =
      resolved_sent_at,
    next_send_at = null,
    stop_reason = null,
    metadata =
      enrollment.metadata
      || jsonb_build_object(
        'outcome',
        'sent',
        'delivery_id',
        delivery_row.id,
        'resend_email_id',
        resolved_resend_email_id,
        'idempotency_key',
        delivery_row.idempotency_key,
        'follow_up_sent_at',
        resolved_sent_at
      ),
    updated_at =
      resolved_sent_at
  where enrollment.id =
    delivery_row.enrollment_id;


  update public.email_campaign_recipients
    as recipient
  set
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
          'delivery_id',
          delivery_row.id,
          'delivery_status',
          'sent',
          'resend_email_id',
          resolved_resend_email_id,
          'sent_at',
          resolved_sent_at
        ),
        true
      ),
    updated_at =
      resolved_sent_at
  where recipient.id =
    delivery_row.source_recipient_id;


  return jsonb_build_object(
    'ok',
    true,
    'already_finalized',
    false,
    'delivery_id',
    delivery_row.id,
    'enrollment_id',
    delivery_row.enrollment_id,
    'resend_email_id',
    resolved_resend_email_id,
    'sent_at',
    resolved_sent_at
  );
end;
$$;


create or replace function
  public.finalize_email_personal_follow_up_failure(
    p_delivery_id uuid,
    p_error_code text,
    p_error_message text,
    p_retryable boolean default true
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  delivery_row record;

  action_time timestamptz :=
    clock_timestamp();

  resolved_error_code text :=
    left(
      coalesce(
        nullif(
          btrim(p_error_code),
          ''
        ),
        'personal_follow_up_send_failed'
      ),
      200
    );

  resolved_error_message text :=
    left(
      coalesce(
        nullif(
          btrim(p_error_message),
          ''
        ),
        'Personal Follow-Up delivery failed.'
      ),
      2000
    );

  will_retry boolean;
  retry_time timestamptz;
  resulting_status text;
begin
  if p_delivery_id is null then
    raise exception
      'Delivery ID is required.';
  end if;

  select *
  into delivery_row
  from public.email_personal_follow_up_deliveries
  where id =
    p_delivery_id
  for update;

  if not found then
    raise exception
      'Personal Follow-Up delivery was not found.';
  end if;

  if delivery_row.status =
      'sent'
  then
    raise exception
      'A sent Personal Follow-Up delivery cannot be finalized as failed.';
  end if;

  if delivery_row.status <>
      'processing'
  then
    raise exception
      'Only a processing Personal Follow-Up delivery can be finalized as failed.';
  end if;

  will_retry :=
    coalesce(
      p_retryable,
      true
    )
    and delivery_row.attempt_count < 5;

  if will_retry then
    retry_time :=
      action_time
      + make_interval(
          mins =>
            least(
              60,
              greatest(
                5,
                delivery_row.attempt_count * 5
              )
            )
        );

    resulting_status :=
      'queued';
  else
    retry_time :=
      null;

    resulting_status :=
      'failed';
  end if;

  update public.email_personal_follow_up_deliveries
  set
    status =
      resulting_status,
    retry_at =
      retry_time,
    failed_at =
      case
        when will_retry
        then null
        else action_time
      end,
    claimed_at = null,
    claim_expires_at = null,
    error_code =
      resolved_error_code,
    error_message =
      resolved_error_message,
    updated_at =
      action_time
  where id =
    delivery_row.id;

  if will_retry then
    update public.listing_email_sequence_enrollments
      as enrollment
    set
      status = 'active',
      next_send_at =
        retry_time,
      stop_reason = null,
      metadata =
        enrollment.metadata
        || jsonb_build_object(
          'outcome',
          'retry_scheduled',
          'delivery_id',
          delivery_row.id,
          'attempt_count',
          delivery_row.attempt_count,
          'retry_at',
          retry_time,
          'last_error_code',
          resolved_error_code,
          'last_error_message',
          resolved_error_message
        ),
      updated_at =
        action_time
    where enrollment.id =
      delivery_row.enrollment_id;
  else
    update public.listing_email_sequence_enrollments
      as enrollment
    set
      status = 'stopped',
      next_send_at = null,
      stop_reason =
        'personal_follow_up_delivery_failed',
      metadata =
        enrollment.metadata
        || jsonb_build_object(
          'outcome',
          'failed',
          'delivery_id',
          delivery_row.id,
          'attempt_count',
          delivery_row.attempt_count,
          'failed_at',
          action_time,
          'error_code',
          resolved_error_code,
          'error_message',
          resolved_error_message
        ),
      updated_at =
        action_time
    where enrollment.id =
      delivery_row.enrollment_id;
  end if;

  return jsonb_build_object(
    'ok',
    true,
    'delivery_id',
    delivery_row.id,
    'enrollment_id',
    delivery_row.enrollment_id,
    'status',
    resulting_status,
    'will_retry',
    will_retry,
    'retry_at',
    retry_time,
    'attempt_count',
    delivery_row.attempt_count,
    'error_code',
    resolved_error_code
  );
end;
$$;


create or replace function
  public.finalize_email_personal_follow_up_blocked(
    p_delivery_id uuid,
    p_status text,
    p_reason text
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  delivery_row record;

  action_time timestamptz :=
    clock_timestamp();

  resolved_status text :=
    lower(
      btrim(
        coalesce(
          p_status,
          ''
        )
      )
    );

  resolved_reason text :=
    left(
      coalesce(
        nullif(
          btrim(p_reason),
          ''
        ),
        'personal_follow_up_blocked'
      ),
      500
    );
begin
  if p_delivery_id is null then
    raise exception
      'Delivery ID is required.';
  end if;

  if resolved_status not in (
    'suppressed',
    'stopped'
  ) then
    raise exception
      'Blocked delivery status must be suppressed or stopped.';
  end if;

  select *
  into delivery_row
  from public.email_personal_follow_up_deliveries
  where id =
    p_delivery_id
  for update;

  if not found then
    raise exception
      'Personal Follow-Up delivery was not found.';
  end if;

  if delivery_row.status =
      'sent'
  then
    raise exception
      'A sent Personal Follow-Up delivery cannot be blocked.';
  end if;

  update public.email_personal_follow_up_deliveries
  set
    status =
      resolved_status,
    suppressed_at =
      case
        when resolved_status =
          'suppressed'
        then action_time
        else suppressed_at
      end,
    stopped_at =
      case
        when resolved_status =
          'stopped'
        then action_time
        else stopped_at
      end,
    claimed_at = null,
    claim_expires_at = null,
    retry_at = null,
    error_code =
      resolved_reason,
    error_message =
      resolved_reason,
    updated_at =
      action_time
  where id =
    delivery_row.id;


  update public.listing_email_sequence_enrollments
    as enrollment
  set
    status =
      resolved_status,
    next_send_at = null,
    stop_reason =
      resolved_reason,
    metadata =
      enrollment.metadata
      || jsonb_build_object(
        'outcome',
        resolved_status,
        'delivery_id',
        delivery_row.id,
        'stop_reason',
        resolved_reason,
        'blocked_at',
        action_time
      ),
    updated_at =
      action_time
  where enrollment.id =
    delivery_row.enrollment_id;


  return jsonb_build_object(
    'ok',
    true,
    'delivery_id',
    delivery_row.id,
    'enrollment_id',
    delivery_row.enrollment_id,
    'status',
    resolved_status,
    'reason',
    resolved_reason
  );
end;
$$;


revoke all
on function
  public.claim_email_personal_follow_up_deliveries(
    integer,
    integer
  )
from public,
     anon,
     authenticated;

revoke all
on function
  public.finalize_email_personal_follow_up_sent(
    uuid,
    text,
    timestamptz
  )
from public,
     anon,
     authenticated;

revoke all
on function
  public.finalize_email_personal_follow_up_failure(
    uuid,
    text,
    text,
    boolean
  )
from public,
     anon,
     authenticated;

revoke all
on function
  public.finalize_email_personal_follow_up_blocked(
    uuid,
    text,
    text
  )
from public,
     anon,
     authenticated;


grant execute
on function
  public.claim_email_personal_follow_up_deliveries(
    integer,
    integer
  )
to service_role;

grant execute
on function
  public.finalize_email_personal_follow_up_sent(
    uuid,
    text,
    timestamptz
  )
to service_role;

grant execute
on function
  public.finalize_email_personal_follow_up_failure(
    uuid,
    text,
    text,
    boolean
  )
to service_role;

grant execute
on function
  public.finalize_email_personal_follow_up_blocked(
    uuid,
    text,
    text
  )
to service_role;


comment on function
  public.claim_email_personal_follow_up_deliveries(
    integer,
    integer
  )
is
  'Creates missing delivery-ledger rows, applies reply and suppression stops, recovers expired claims and atomically claims due Personal Follow-Up deliveries.';

comment on function
  public.finalize_email_personal_follow_up_sent(
    uuid,
    text,
    timestamptz
  )
is
  'Finalizes an accepted Personal Follow-Up delivery and completes its sequence enrollment idempotently.';

comment on function
  public.finalize_email_personal_follow_up_failure(
    uuid,
    text,
    text,
    boolean
  )
is
  'Records a Personal Follow-Up delivery failure and either schedules a bounded retry or stops the enrollment after the retry limit.';

comment on function
  public.finalize_email_personal_follow_up_blocked(
    uuid,
    text,
    text
  )
is
  'Finalizes a Personal Follow-Up delivery as suppressed or stopped when a live safeguard blocks sending.';


commit;