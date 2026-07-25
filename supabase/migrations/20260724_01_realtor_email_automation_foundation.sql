begin;

-- ============================================================
-- MLS REVERSE-PROSPECTING IMPORT BATCHES
-- Uses the existing mls_compliance_profiles table as the
-- provider/compliance connection record.
-- ============================================================

create table public.mls_reverse_prospecting_batches (
  id uuid primary key
    default gen_random_uuid(),

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  listing_id uuid not null
    references public.listings(id)
    on delete cascade,

  mls_compliance_profile_id uuid
    references public.mls_compliance_profiles(id)
    on delete set null,

  source_type text not null
    default 'manual_upload',

  status text not null
    default 'pending',

  external_batch_id text,
  source_file_name text,

  imported_rows integer not null
    default 0,

  matched_rows integer not null
    default 0,

  skipped_rows integer not null
    default 0,

  started_at timestamptz,
  completed_at timestamptz,

  last_error text,

  metadata jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint mls_reverse_batches_source_type_check
    check (
      source_type in (
        'manual_upload',
        'manual_entry',
        'reso_web_api',
        'api',
        'rets',
        'vendor_feed',
        'other'
      )
    ),

  constraint mls_reverse_batches_status_check
    check (
      status in (
        'pending',
        'processing',
        'completed',
        'partially_completed',
        'failed',
        'cancelled'
      )
    ),

  constraint mls_reverse_batches_counts_check
    check (
      imported_rows >= 0
      and matched_rows >= 0
      and skipped_rows >= 0
    ),

  constraint mls_reverse_batches_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
    )
);

comment on table
  public.mls_reverse_prospecting_batches
is
  'Tracks manual and automated MLS reverse-prospecting imports for a listing.';

-- ============================================================
-- MATCHED REALTORS
-- This intentionally stores the matched Realtor and aggregate
-- match reasoning, not buyer names or buyer contact information.
-- ============================================================

create table public.listing_realtor_matches (
  id uuid primary key
    default gen_random_uuid(),

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  listing_id uuid not null
    references public.listings(id)
    on delete cascade,

  batch_id uuid
    references public.mls_reverse_prospecting_batches(id)
    on delete set null,

  mls_compliance_profile_id uuid
    references public.mls_compliance_profiles(id)
    on delete set null,

  contact_id uuid
    references public.contacts(id)
    on delete set null,

  external_agent_id text,
  external_office_id text,
  external_match_id text,

  agent_email text not null,
  agent_email_normalized text not null,

  agent_first_name text,
  agent_last_name text,
  agent_display_name text,
  agent_company text,

  match_source text not null
    default 'manual_upload',

  buyer_match_count integer not null
    default 1,

  match_reasons text[] not null
    default '{}'::text[],

  criteria_summary text,

  match_score numeric(6,2),

  is_active boolean not null
    default true,

  first_matched_at timestamptz not null
    default now(),

  last_matched_at timestamptz not null
    default now(),

  source_payload jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint listing_realtor_matches_source_check
    check (
      match_source in (
        'manual_upload',
        'manual_entry',
        'reso_web_api',
        'api',
        'rets',
        'vendor_feed',
        'behavior',
        'other'
      )
    ),

  constraint listing_realtor_matches_count_check
    check (
      buyer_match_count >= 1
    ),

  constraint listing_realtor_matches_score_check
    check (
      match_score is null
      or (
        match_score >= 0
        and match_score <= 100
      )
    ),

  constraint listing_realtor_matches_email_check
    check (
      char_length(
        trim(agent_email_normalized)
      ) >= 3
    ),

  constraint listing_realtor_matches_payload_check
    check (
      jsonb_typeof(source_payload) = 'object'
    )
);

comment on table
  public.listing_realtor_matches
is
  'Realtors matched to a listing through MLS reverse prospecting, manual imports, or CRM behavior.';

comment on column
  public.listing_realtor_matches.source_payload
is
  'Provider metadata only. Do not store buyer names, buyer contact information, or other buyer PII.';

-- ============================================================
-- VERIFIED LISTING MARKETING EVENTS
-- ============================================================

create table public.listing_email_events (
  id uuid primary key
    default gen_random_uuid(),

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  listing_id uuid not null
    references public.listings(id)
    on delete cascade,

  event_type text not null,
  event_source text not null
    default 'manual',

  status text not null
    default 'draft',

  title text,
  summary text,

  occurred_at timestamptz not null
    default now(),

  effective_at timestamptz,
  expires_at timestamptz,

  payload jsonb not null
    default '{}'::jsonb,

  verification_note text,

  verified_by uuid
    references auth.users(id)
    on delete set null,

  verified_at timestamptz,

  processed_at timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint listing_email_events_type_check
    check (
      event_type in (
        'open_house',
        'price_change',
        'new_video',
        'new_photos',
        'back_on_market',
        'showing_window',
        'seller_terms',
        'offer_deadline',
        'status_change',
        'manual'
      )
    ),

  constraint listing_email_events_source_check
    check (
      event_source in (
        'manual',
        'mls',
        'crm',
        'system'
      )
    ),

  constraint listing_email_events_status_check
    check (
      status in (
        'draft',
        'verified',
        'scheduled',
        'processed',
        'ignored',
        'cancelled'
      )
    ),

  constraint listing_email_events_payload_check
    check (
      jsonb_typeof(payload) = 'object'
    ),

  constraint listing_email_events_dates_check
    check (
      expires_at is null
      or effective_at is null
      or expires_at >= effective_at
    )
);

-- ============================================================
-- LISTING EMAIL SEQUENCES
-- ============================================================

create table public.listing_email_sequences (
  id uuid primary key
    default gen_random_uuid(),

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  listing_id uuid not null
    references public.listings(id)
    on delete cascade,

  name text not null,

  status text not null
    default 'draft',

  audience_mode text not null
    default 'all_realtors',

  cadence_value integer not null
    default 1,

  cadence_unit text not null
    default 'weeks',

  repeat_mode text not null
    default 'refresh_cycle',

  current_cycle integer not null
    default 1,

  start_at timestamptz,
  next_run_at timestamptz,
  last_run_at timestamptz,
  completed_at timestamptz,

  stop_listing_statuses text[] not null
    default array[
      'pending',
      'sold',
      'withdrawn',
      'expired',
      'cancelled'
    ]::text[],

  settings jsonb not null
    default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint listing_email_sequences_name_check
    check (
      char_length(trim(name))
      between 1 and 200
    ),

  constraint listing_email_sequences_status_check
    check (
      status in (
        'draft',
        'active',
        'paused',
        'completed',
        'cancelled'
      )
    ),

  constraint listing_email_sequences_audience_check
    check (
      audience_mode in (
        'all_realtors',
        'reverse_prospecting',
        'manual',
        'engaged_realtors'
      )
    ),

  constraint listing_email_sequences_cadence_check
    check (
      cadence_value >= 1
      and cadence_value <= 365
      and cadence_unit in (
        'days',
        'weeks'
      )
    ),

  constraint listing_email_sequences_repeat_check
    check (
      repeat_mode in (
        'stop_after_cycle',
        'refresh_cycle'
      )
    ),

  constraint listing_email_sequences_cycle_check
    check (
      current_cycle >= 1
    ),

  constraint listing_email_sequences_settings_check
    check (
      jsonb_typeof(settings) = 'object'
    )
);

create table public.listing_email_sequence_steps (
  id uuid primary key
    default gen_random_uuid(),

  sequence_id uuid not null
    references public.listing_email_sequences(id)
    on delete cascade,

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  step_order integer not null,

  creative_kind text not null
    default 'luxury_edition',

  creative_key text not null,

  presentation_mode text not null
    default 'designed',

  subject_strategy text not null
    default 'samantha',

  delay_value integer not null
    default 0,

  delay_unit text not null
    default 'days',

  trigger_rule jsonb not null
    default '{}'::jsonb,

  step_settings jsonb not null
    default '{}'::jsonb,

  is_enabled boolean not null
    default true,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint listing_email_sequence_steps_order_check
    check (
      step_order >= 1
    ),

  constraint listing_email_sequence_steps_creative_kind_check
    check (
      creative_kind in (
        'luxury_edition',
        'quick_note',
        'micro_feature',
        'listing_event'
      )
    ),

  constraint listing_email_sequence_steps_creative_key_check
    check (
      char_length(trim(creative_key))
      between 1 and 100
    ),

  constraint listing_email_sequence_steps_presentation_check
    check (
      presentation_mode in (
        'designed',
        'plain_text'
      )
    ),

  constraint listing_email_sequence_steps_subject_check
    check (
      subject_strategy in (
        'manual',
        'samantha',
        'ab_test'
      )
    ),

  constraint listing_email_sequence_steps_delay_check
    check (
      delay_value >= 0
      and delay_value <= 365
      and delay_unit in (
        'days',
        'weeks'
      )
    ),

  constraint listing_email_sequence_steps_trigger_check
    check (
      jsonb_typeof(trigger_rule) = 'object'
    ),

  constraint listing_email_sequence_steps_settings_check
    check (
      jsonb_typeof(step_settings) = 'object'
    ),

  constraint listing_email_sequence_steps_unique
    unique (
      sequence_id,
      step_order
    )
);

create table public.listing_email_sequence_enrollments (
  id uuid primary key
    default gen_random_uuid(),

  sequence_id uuid not null
    references public.listing_email_sequences(id)
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

  contact_id uuid
    references public.contacts(id)
    on delete set null,

  realtor_match_id uuid
    references public.listing_realtor_matches(id)
    on delete set null,

  email text not null,
  email_normalized text not null,

  first_name text,
  last_name text,
  display_name text,
  company text,

  status text not null
    default 'queued',

  current_step_order integer not null
    default 1,

  next_send_at timestamptz,
  last_sent_at timestamptz,

  last_campaign_id uuid
    references public.email_campaigns(id)
    on delete set null,

  last_recipient_id uuid
    references public.email_campaign_recipients(id)
    on delete set null,

  engagement_score numeric(8,2) not null
    default 0,

  last_engagement_at timestamptz,

  stop_reason text,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint listing_email_enrollments_status_check
    check (
      status in (
        'queued',
        'active',
        'paused',
        'completed',
        'stopped',
        'suppressed'
      )
    ),

  constraint listing_email_enrollments_step_check
    check (
      current_step_order >= 1
    ),

  constraint listing_email_enrollments_score_check
    check (
      engagement_score >= 0
    ),

  constraint listing_email_enrollments_email_check
    check (
      char_length(
        trim(email_normalized)
      ) >= 3
    ),

  constraint listing_email_enrollments_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
    ),

  constraint listing_email_enrollments_unique
    unique (
      sequence_id,
      email_normalized
    )
);

-- ============================================================
-- CONTACT EMAIL PREFERENCES
-- Supports reducing frequency without requiring a full opt-out.
-- ============================================================

create table public.email_contact_preferences (
  id uuid primary key
    default gen_random_uuid(),

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid
    references auth.users(id)
    on delete set null,

  contact_id uuid
    references public.contacts(id)
    on delete set null,

  email text not null,
  email_normalized text not null,

  allow_listing_ads boolean not null
    default true,

  allow_open_house boolean not null
    default true,

  allow_price_changes boolean not null
    default true,

  allow_market_updates boolean not null
    default true,

  allow_newsletters boolean not null
    default true,

  frequency_mode text not null
    default 'normal',

  source text not null
    default 'crm',

  updated_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint email_contact_preferences_frequency_check
    check (
      frequency_mode in (
        'normal',
        'reduced',
        'important_only'
      )
    ),

  constraint email_contact_preferences_source_check
    check (
      source in (
        'crm',
        'recipient',
        'unsubscribe_page',
        'import',
        'system'
      )
    ),

  constraint email_contact_preferences_email_check
    check (
      char_length(
        trim(email_normalized)
      ) >= 3
    ),

  constraint email_contact_preferences_unique
    unique (
      org_id,
      email_normalized
    )
);

-- ============================================================
-- SUBJECT-LINE TESTING
-- ============================================================

create table public.email_subject_tests (
  id uuid primary key
    default gen_random_uuid(),

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  listing_id uuid
    references public.listings(id)
    on delete cascade,

  sequence_step_id uuid
    references public.listing_email_sequence_steps(id)
    on delete set null,

  campaign_id uuid
    references public.email_campaigns(id)
    on delete set null,

  name text not null,

  status text not null
    default 'draft',

  decision_metric text not null
    default 'click',

  sample_percentage integer not null
    default 20,

  started_at timestamptz,
  completed_at timestamptz,

  winning_variant_id uuid,

  settings jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint email_subject_tests_name_check
    check (
      char_length(trim(name))
      between 1 and 200
    ),

  constraint email_subject_tests_status_check
    check (
      status in (
        'draft',
        'running',
        'completed',
        'cancelled'
      )
    ),

  constraint email_subject_tests_metric_check
    check (
      decision_metric in (
        'open',
        'click',
        'reply',
        'conversion'
      )
    ),

  constraint email_subject_tests_sample_check
    check (
      sample_percentage
      between 2 and 100
    ),

  constraint email_subject_tests_settings_check
    check (
      jsonb_typeof(settings) = 'object'
    )
);

create table public.email_subject_variants (
  id uuid primary key
    default gen_random_uuid(),

  subject_test_id uuid not null
    references public.email_subject_tests(id)
    on delete cascade,

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  variant_key text not null,

  subject text not null,
  preview_text text,

  allocation_weight integer not null
    default 50,

  sent_count integer not null
    default 0,

  open_count integer not null
    default 0,

  click_count integer not null
    default 0,

  reply_count integer not null
    default 0,

  conversion_count integer not null
    default 0,

  is_winner boolean not null
    default false,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint email_subject_variants_key_check
    check (
      char_length(trim(variant_key))
      between 1 and 20
    ),

  constraint email_subject_variants_subject_check
    check (
      char_length(trim(subject))
      between 1 and 300
    ),

  constraint email_subject_variants_weight_check
    check (
      allocation_weight
      between 1 and 100
    ),

  constraint email_subject_variants_counts_check
    check (
      sent_count >= 0
      and open_count >= 0
      and click_count >= 0
      and reply_count >= 0
      and conversion_count >= 0
    ),

  constraint email_subject_variants_unique
    unique (
      subject_test_id,
      variant_key
    )
);

alter table public.email_subject_tests
  add constraint email_subject_tests_winning_variant_fkey
  foreign key (winning_variant_id)
  references public.email_subject_variants(id)
  on delete set null;

-- ============================================================
-- RECIPIENT-SPECIFIC TRACKED LINKS
-- ============================================================

create table public.email_recipient_links (
  id uuid primary key
    default gen_random_uuid(),

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  campaign_id uuid not null
    references public.email_campaigns(id)
    on delete cascade,

  recipient_id uuid not null
    references public.email_campaign_recipients(id)
    on delete cascade,

  action_key text not null,

  destination_url text not null,

  tracking_token uuid not null
    default gen_random_uuid(),

  click_count integer not null
    default 0,

  first_clicked_at timestamptz,
  last_clicked_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint email_recipient_links_action_check
    check (
      action_key in (
        'listing_website',
        'property_video',
        'schedule_showing',
        'download_flyer',
        'request_disclosures',
        'contact_agent',
        'preferences',
        'other'
      )
    ),

  constraint email_recipient_links_url_check
    check (
      char_length(
        trim(destination_url)
      ) >= 1
    ),

  constraint email_recipient_links_click_count_check
    check (
      click_count >= 0
    ),

  constraint email_recipient_links_tracking_unique
    unique (
      tracking_token
    )
);

-- ============================================================
-- EXTEND EXISTING CAMPAIGNS
-- ============================================================

alter table public.email_campaigns
  add column if not exists
    campaign_source text not null
    default 'manual',

  add column if not exists
    creative_kind text not null
    default 'luxury_edition',

  add column if not exists
    creative_key text,

  add column if not exists
    audience_source text not null
    default 'manual_filter',

  add column if not exists
    sequence_id uuid,

  add column if not exists
    sequence_step_id uuid,

  add column if not exists
    listing_event_id uuid,

  add column if not exists
    subject_test_id uuid,

  add column if not exists
    send_reason text;

alter table public.email_campaigns
  add constraint email_campaigns_sequence_fkey
  foreign key (sequence_id)
  references public.listing_email_sequences(id)
  on delete set null;

alter table public.email_campaigns
  add constraint email_campaigns_sequence_step_fkey
  foreign key (sequence_step_id)
  references public.listing_email_sequence_steps(id)
  on delete set null;

alter table public.email_campaigns
  add constraint email_campaigns_listing_event_fkey
  foreign key (listing_event_id)
  references public.listing_email_events(id)
  on delete set null;

alter table public.email_campaigns
  add constraint email_campaigns_subject_test_fkey
  foreign key (subject_test_id)
  references public.email_subject_tests(id)
  on delete set null;

alter table public.email_campaigns
  add constraint email_campaigns_campaign_source_check
  check (
    campaign_source in (
      'manual',
      'sequence',
      'listing_event',
      'behavior_followup',
      'reverse_prospecting'
    )
  );

alter table public.email_campaigns
  add constraint email_campaigns_creative_kind_check
  check (
    creative_kind in (
      'luxury_edition',
      'quick_note',
      'micro_feature',
      'listing_event'
    )
  );

alter table public.email_campaigns
  add constraint email_campaigns_audience_source_check
  check (
    audience_source in (
      'manual_filter',
      'reverse_prospecting',
      'all_realtors',
      'engaged_realtors',
      'imported',
      'sequence',
      'listing_event',
      'behavior'
    )
  );

-- ============================================================
-- EXTEND EXISTING RECIPIENT SNAPSHOTS
-- ============================================================

alter table public.email_campaign_recipients
  add column if not exists
    tracking_token uuid not null
    default gen_random_uuid(),

  add column if not exists
    preferences_token uuid not null
    default gen_random_uuid(),

  add column if not exists
    realtor_match_id uuid,

  add column if not exists
    sequence_enrollment_id uuid,

  add column if not exists
    sequence_step_id uuid,

  add column if not exists
    subject_variant_id uuid,

  add column if not exists
    audience_source text,

  add column if not exists
    match_reason text,

  add column if not exists
    last_clicked_action text,

  add column if not exists
    first_replied_at timestamptz,

  add column if not exists
    last_replied_at timestamptz,

  add column if not exists
    reply_count integer not null
    default 0;

alter table public.email_campaign_recipients
  add constraint email_campaign_recipients_match_fkey
  foreign key (realtor_match_id)
  references public.listing_realtor_matches(id)
  on delete set null;

alter table public.email_campaign_recipients
  add constraint email_campaign_recipients_enrollment_fkey
  foreign key (sequence_enrollment_id)
  references public.listing_email_sequence_enrollments(id)
  on delete set null;

alter table public.email_campaign_recipients
  add constraint email_campaign_recipients_sequence_step_fkey
  foreign key (sequence_step_id)
  references public.listing_email_sequence_steps(id)
  on delete set null;

alter table public.email_campaign_recipients
  add constraint email_campaign_recipients_subject_variant_fkey
  foreign key (subject_variant_id)
  references public.email_subject_variants(id)
  on delete set null;

alter table public.email_campaign_recipients
  add constraint email_campaign_recipients_audience_source_check
  check (
    audience_source is null
    or audience_source in (
      'manual_filter',
      'reverse_prospecting',
      'all_realtors',
      'engaged_realtors',
      'imported',
      'sequence',
      'listing_event',
      'behavior'
    )
  );

alter table public.email_campaign_recipients
  add constraint email_campaign_recipients_reply_count_check
  check (
    reply_count >= 0
  );

-- ============================================================
-- INDEXES
-- ============================================================

create index
  mls_reverse_batches_listing_idx
on public.mls_reverse_prospecting_batches (
  listing_id,
  status,
  created_at desc
);

create index
  mls_reverse_batches_profile_idx
on public.mls_reverse_prospecting_batches (
  mls_compliance_profile_id,
  status
);

create index
  listing_realtor_matches_listing_idx
on public.listing_realtor_matches (
  listing_id,
  is_active,
  last_matched_at desc
);

create index
  listing_realtor_matches_contact_idx
on public.listing_realtor_matches (
  contact_id
);

create index
  listing_realtor_matches_email_idx
on public.listing_realtor_matches (
  org_id,
  agent_email_normalized
);

create unique index
  listing_realtor_matches_active_unique
on public.listing_realtor_matches (
  listing_id,
  agent_email_normalized,
  match_source
)
where
  is_active = true;

create index
  listing_email_events_listing_idx
on public.listing_email_events (
  listing_id,
  status,
  effective_at
);

create index
  listing_email_sequences_run_idx
on public.listing_email_sequences (
  status,
  next_run_at
);

create index
  listing_email_sequences_listing_idx
on public.listing_email_sequences (
  listing_id,
  status
);

create index
  listing_email_sequence_steps_sequence_idx
on public.listing_email_sequence_steps (
  sequence_id,
  step_order
);

create index
  listing_email_enrollments_due_idx
on public.listing_email_sequence_enrollments (
  status,
  next_send_at
);

create index
  listing_email_enrollments_listing_idx
on public.listing_email_sequence_enrollments (
  listing_id,
  status
);

create index
  listing_email_enrollments_contact_idx
on public.listing_email_sequence_enrollments (
  contact_id
);

create index
  email_contact_preferences_contact_idx
on public.email_contact_preferences (
  contact_id
);

create index
  email_subject_tests_listing_idx
on public.email_subject_tests (
  listing_id,
  status
);

create index
  email_subject_variants_test_idx
on public.email_subject_variants (
  subject_test_id,
  is_winner
);

create index
  email_recipient_links_recipient_idx
on public.email_recipient_links (
  recipient_id,
  action_key
);

create index
  email_recipient_links_campaign_idx
on public.email_recipient_links (
  campaign_id
);

create unique index
  email_campaign_recipients_tracking_token_unique
on public.email_campaign_recipients (
  tracking_token
);

create unique index
  email_campaign_recipients_preferences_token_unique
on public.email_campaign_recipients (
  preferences_token
);

create index
  email_campaign_recipients_match_idx
on public.email_campaign_recipients (
  realtor_match_id
);

create index
  email_campaign_recipients_enrollment_idx
on public.email_campaign_recipients (
  sequence_enrollment_id
);

create index
  email_campaigns_sequence_idx
on public.email_campaigns (
  sequence_id,
  sequence_step_id
);

create index
  email_campaigns_listing_event_idx
on public.email_campaigns (
  listing_event_id
);

-- ============================================================
-- OWNERSHIP AND PARENT-SCOPE CONSISTENCY
-- ============================================================

-- These listing-scoped records inherit their organization and
-- owner from the listing. This matches the existing Marketing
-- Studio ownership model and prevents cross-organization rows.

create trigger
  mls_reverse_batches_sync_ownership
before insert or update of
  listing_id,
  org_id,
  owner_user_id
on public.mls_reverse_prospecting_batches
for each row
execute function
  public.sync_listing_website_record_ownership();

create trigger
  listing_realtor_matches_sync_ownership
before insert or update of
  listing_id,
  org_id,
  owner_user_id
on public.listing_realtor_matches
for each row
execute function
  public.sync_listing_website_record_ownership();

create trigger
  listing_email_events_sync_ownership
before insert or update of
  listing_id,
  org_id,
  owner_user_id
on public.listing_email_events
for each row
execute function
  public.sync_listing_website_record_ownership();

create trigger
  listing_email_sequences_sync_ownership
before insert or update of
  listing_id,
  org_id,
  owner_user_id
on public.listing_email_sequences
for each row
execute function
  public.sync_listing_website_record_ownership();

-- Child records inherit ownership from their actual parent.
-- A submitted org_id or owner_user_id cannot be used to attach
-- a child record to another organization's parent UUID.

create or replace function
  public.sync_realtor_email_child_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_org_id uuid;
  parent_owner_user_id uuid;
  parent_listing_id uuid;
begin
  case tg_table_name

    when 'listing_email_sequence_steps' then
      select
        sequence_row.org_id,
        sequence_row.owner_user_id,
        sequence_row.listing_id
      into
        parent_org_id,
        parent_owner_user_id,
        parent_listing_id
      from public.listing_email_sequences
        as sequence_row
      where sequence_row.id =
        new.sequence_id;

    when 'listing_email_sequence_enrollments' then
      select
        sequence_row.org_id,
        sequence_row.owner_user_id,
        sequence_row.listing_id
      into
        parent_org_id,
        parent_owner_user_id,
        parent_listing_id
      from public.listing_email_sequences
        as sequence_row
      where sequence_row.id =
        new.sequence_id;

    when 'email_subject_variants' then
      select
        subject_test.org_id,
        subject_test.owner_user_id,
        subject_test.listing_id
      into
        parent_org_id,
        parent_owner_user_id,
        parent_listing_id
      from public.email_subject_tests
        as subject_test
      where subject_test.id =
        new.subject_test_id;

    when 'email_recipient_links' then
      select
        campaign.org_id,
        campaign.owner_user_id,
        campaign.listing_id
      into
        parent_org_id,
        parent_owner_user_id,
        parent_listing_id
      from public.email_campaigns
        as campaign
      where campaign.id =
        new.campaign_id;

    else
      raise exception
        'Unsupported Realtor email child table: %',
        tg_table_name;
  end case;

  if parent_org_id is null then
    raise exception
      'The parent record was not found or has no organization.';
  end if;

  if parent_owner_user_id is null then
    raise exception
      'The parent record has no owner.';
  end if;

  new.org_id :=
    parent_org_id;

  new.owner_user_id :=
    parent_owner_user_id;

  if
    tg_table_name =
      'listing_email_sequence_enrollments'
  then
    new.listing_id :=
      parent_listing_id;

    if new.contact_id is not null then
      perform 1
      from public.contacts
        as contact_row
      where contact_row.id =
          new.contact_id
        and contact_row.org_id =
          parent_org_id;

      if not found then
        raise exception
          'The enrollment contact does not belong to the sequence organization.';
      end if;
    end if;

    if
      new.realtor_match_id
      is not null
    then
      perform 1
      from public.listing_realtor_matches
        as match_row
      where match_row.id =
          new.realtor_match_id
        and match_row.org_id =
          parent_org_id
        and match_row.listing_id =
          parent_listing_id;

      if not found then
        raise exception
          'The Realtor match does not belong to the sequence listing.';
      end if;
    end if;
  end if;

  if
    tg_table_name =
      'email_recipient_links'
  then
    perform 1
    from public.email_campaign_recipients
      as recipient_row
    where recipient_row.id =
        new.recipient_id
      and recipient_row.campaign_id =
        new.campaign_id;

    if not found then
      raise exception
        'The tracked-link recipient does not belong to the campaign.';
    end if;
  end if;

  return new;
end;
$$;

revoke all
on function
  public.sync_realtor_email_child_ownership()
from public;

grant execute
on function
  public.sync_realtor_email_child_ownership()
to authenticated,
   service_role;

create trigger
  listing_email_sequence_steps_sync_ownership
before insert or update of
  sequence_id,
  org_id,
  owner_user_id
on public.listing_email_sequence_steps
for each row
execute function
  public.sync_realtor_email_child_ownership();

create trigger
  listing_email_enrollments_sync_ownership
before insert or update of
  sequence_id,
  listing_id,
  org_id,
  owner_user_id,
  contact_id,
  realtor_match_id
on public.listing_email_sequence_enrollments
for each row
execute function
  public.sync_realtor_email_child_ownership();

create trigger
  email_subject_variants_sync_ownership
before insert or update of
  subject_test_id,
  org_id,
  owner_user_id
on public.email_subject_variants
for each row
execute function
  public.sync_realtor_email_child_ownership();

create trigger
  email_recipient_links_sync_ownership
before insert or update of
  campaign_id,
  recipient_id,
  org_id,
  owner_user_id
on public.email_recipient_links
for each row
execute function
  public.sync_realtor_email_child_ownership();

-- ============================================================
-- UPDATED-AT TRIGGERS
-- ============================================================

create trigger
  mls_reverse_batches_set_updated_at
before update
on public.mls_reverse_prospecting_batches
for each row
execute function
  public.set_marketing_updated_at();

create trigger
  listing_realtor_matches_set_updated_at
before update
on public.listing_realtor_matches
for each row
execute function
  public.set_marketing_updated_at();

create trigger
  listing_email_events_set_updated_at
before update
on public.listing_email_events
for each row
execute function
  public.set_marketing_updated_at();

create trigger
  listing_email_sequences_set_updated_at
before update
on public.listing_email_sequences
for each row
execute function
  public.set_marketing_updated_at();

create trigger
  listing_email_sequence_steps_set_updated_at
before update
on public.listing_email_sequence_steps
for each row
execute function
  public.set_marketing_updated_at();

create trigger
  listing_email_enrollments_set_updated_at
before update
on public.listing_email_sequence_enrollments
for each row
execute function
  public.set_marketing_updated_at();

create trigger
  email_contact_preferences_set_updated_at
before update
on public.email_contact_preferences
for each row
execute function
  public.set_marketing_updated_at();

create trigger
  email_subject_tests_set_updated_at
before update
on public.email_subject_tests
for each row
execute function
  public.set_marketing_updated_at();

create trigger
  email_subject_variants_set_updated_at
before update
on public.email_subject_variants
for each row
execute function
  public.set_marketing_updated_at();

create trigger
  email_recipient_links_set_updated_at
before update
on public.email_recipient_links
for each row
execute function
  public.set_marketing_updated_at();

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table
  public.mls_reverse_prospecting_batches
enable row level security;

alter table
  public.listing_realtor_matches
enable row level security;

alter table
  public.listing_email_events
enable row level security;

alter table
  public.listing_email_sequences
enable row level security;

alter table
  public.listing_email_sequence_steps
enable row level security;

alter table
  public.listing_email_sequence_enrollments
enable row level security;

alter table
  public.email_contact_preferences
enable row level security;

alter table
  public.email_subject_tests
enable row level security;

alter table
  public.email_subject_variants
enable row level security;

alter table
  public.email_recipient_links
enable row level security;

create policy
  mls_reverse_batches_select
on public.mls_reverse_prospecting_batches
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  mls_reverse_batches_insert
on public.mls_reverse_prospecting_batches
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  mls_reverse_batches_update
on public.mls_reverse_prospecting_batches
for update
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
)
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  mls_reverse_batches_delete
on public.mls_reverse_prospecting_batches
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  listing_realtor_matches_select
on public.listing_realtor_matches
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  listing_realtor_matches_insert
on public.listing_realtor_matches
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  listing_realtor_matches_update
on public.listing_realtor_matches
for update
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
)
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  listing_realtor_matches_delete
on public.listing_realtor_matches
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  listing_email_events_manage
on public.listing_email_events
for all
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
)
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  listing_email_sequences_manage
on public.listing_email_sequences
for all
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
)
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  listing_email_sequence_steps_manage
on public.listing_email_sequence_steps
for all
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
)
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  listing_email_enrollments_manage
on public.listing_email_sequence_enrollments
for all
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
)
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  email_contact_preferences_manage
on public.email_contact_preferences
for all
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
)
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  email_subject_tests_manage
on public.email_subject_tests
for all
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
)
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  email_subject_variants_manage
on public.email_subject_variants
for all
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
)
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy
  email_recipient_links_manage
on public.email_recipient_links
for all
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
)
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

-- ============================================================
-- GRANTS
-- Public unsubscribe/tracking routes will use the server-side
-- service role and will not receive anonymous table access.
-- ============================================================

grant
  select,
  insert,
  update,
  delete
on
  public.mls_reverse_prospecting_batches,
  public.listing_realtor_matches,
  public.listing_email_events,
  public.listing_email_sequences,
  public.listing_email_sequence_steps,
  public.listing_email_sequence_enrollments,
  public.email_contact_preferences,
  public.email_subject_tests,
  public.email_subject_variants,
  public.email_recipient_links
to authenticated;

grant all
on
  public.mls_reverse_prospecting_batches,
  public.listing_realtor_matches,
  public.listing_email_events,
  public.listing_email_sequences,
  public.listing_email_sequence_steps,
  public.listing_email_sequence_enrollments,
  public.email_contact_preferences,
  public.email_subject_tests,
  public.email_subject_variants,
  public.email_recipient_links
to service_role;

commit;