begin;


create table if not exists
  public.email_personal_follow_up_deliveries (
    id uuid primary key
      default gen_random_uuid(),

    enrollment_id uuid not null
      references
        public.listing_email_sequence_enrollments(id)
      on delete cascade,

    sequence_id uuid not null
      references
        public.listing_email_sequences(id)
      on delete cascade,

    sequence_step_id uuid not null
      references
        public.listing_email_sequence_steps(id)
      on delete cascade,

    org_id uuid not null
      references public.organizations(id)
      on delete cascade,

    owner_user_id uuid not null
      references auth.users(id)
      on delete cascade,

    listing_id uuid not null
      references public.listings(id)
      on delete cascade,

    source_campaign_id uuid not null
      references public.email_campaigns(id)
      on delete restrict,

    source_recipient_id uuid not null
      references public.email_campaign_recipients(id)
      on delete restrict,

    email text not null,
    email_normalized text not null,
    first_name text,

    category text not null
      default 'unknown',

    subject text not null,
    preview_text text,
    follow_up_paragraph text not null,

    content_snapshot jsonb not null
      default '{}'::jsonb,

    status text not null
      default 'queued',

    attempt_count integer not null
      default 0,

    scheduled_at timestamptz not null,
    retry_at timestamptz,

    claimed_at timestamptz,
    claim_expires_at timestamptz,

    idempotency_key text not null,

    resend_email_id text,

    sent_at timestamptz,
    failed_at timestamptz,
    suppressed_at timestamptz,
    stopped_at timestamptz,

    error_code text,
    error_message text,

    created_at timestamptz not null
      default now(),

    updated_at timestamptz not null
      default now(),

    constraint
      email_personal_follow_up_deliveries_enrollment_unique
      unique (
        enrollment_id
      ),

    constraint
      email_personal_follow_up_deliveries_idempotency_unique
      unique (
        idempotency_key
      ),

    constraint
      email_personal_follow_up_deliveries_status_check
      check (
        status in (
          'queued',
          'processing',
          'sent',
          'failed',
          'suppressed',
          'stopped'
        )
      ),

    constraint
      email_personal_follow_up_deliveries_attempt_check
      check (
        attempt_count >= 0
      ),

    constraint
      email_personal_follow_up_deliveries_email_check
      check (
        char_length(
          btrim(email_normalized)
        ) >= 3
      ),

    constraint
      email_personal_follow_up_deliveries_subject_check
      check (
        char_length(
          btrim(subject)
        ) >= 1
      ),

    constraint
      email_personal_follow_up_deliveries_paragraph_check
      check (
        char_length(
          btrim(follow_up_paragraph)
        ) >= 1
      ),

    constraint
      email_personal_follow_up_deliveries_snapshot_check
      check (
        jsonb_typeof(
          content_snapshot
        ) = 'object'
      )
  );


create index if not exists
  email_personal_follow_up_deliveries_due_idx
on public.email_personal_follow_up_deliveries (
  status,
  retry_at,
  scheduled_at
);


create index if not exists
  email_personal_follow_up_deliveries_campaign_idx
on public.email_personal_follow_up_deliveries (
  source_campaign_id,
  status
);


create index if not exists
  email_personal_follow_up_deliveries_recipient_idx
on public.email_personal_follow_up_deliveries (
  source_recipient_id
);


create unique index if not exists
  email_personal_follow_up_deliveries_resend_unique
on public.email_personal_follow_up_deliveries (
  resend_email_id
)
where resend_email_id is not null;


alter table
  public.email_personal_follow_up_deliveries
enable row level security;


revoke all
on table
  public.email_personal_follow_up_deliveries
from public,
     anon,
     authenticated;


grant
  select,
  insert,
  update,
  delete
on table
  public.email_personal_follow_up_deliveries
to service_role;


insert into
  public.email_personal_follow_up_deliveries (
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
    idempotency_key,
    sent_at,
    suppressed_at,
    stopped_at
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

  case
    when enrollment.status =
      'completed'
      and enrollment.last_sent_at
        is not null
    then 'sent'

    when enrollment.status =
      'suppressed'
    then 'suppressed'

    when enrollment.status =
      'stopped'
    then 'stopped'

    else 'queued'
  end,

  coalesce(
    enrollment.next_send_at,
    enrollment.last_sent_at,
    enrollment.created_at
  ),

  (
    'personal-follow-up-' ||
    enrollment.id::text ||
    '-v1'
  ),

  case
    when enrollment.status =
      'completed'
    then enrollment.last_sent_at
    else null
  end,

  case
    when enrollment.status =
      'suppressed'
    then coalesce(
      enrollment.updated_at,
      now()
    )
    else null
  end,

  case
    when enrollment.status =
      'stopped'
    then coalesce(
      enrollment.updated_at,
      now()
    )
    else null
  end

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

on conflict (
  enrollment_id
)
do nothing;


comment on table
  public.email_personal_follow_up_deliveries
is
  'Durable delivery ledger for recipient-specific Personal Follow-Up emails, including atomic claims, retries, Resend idempotency and final delivery outcomes.';


commit;