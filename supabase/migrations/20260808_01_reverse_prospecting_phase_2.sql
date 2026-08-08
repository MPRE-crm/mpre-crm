-- REVERSE PROSPECTING - PHASE 2 DATABASE MIGRATION
-- Final corrected independent-hardened SQL gate, prepared 2026-08-08.
-- REVIEW GATE: Mike must review and run this manually in Supabase SQL Editor.
-- CODEX MUST NOT EXECUTE THIS FILE.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- ============================================================
-- 00. FAIL-CLOSED LIVE-SCHEMA AND INSTALLATION PREFLIGHT
-- ============================================================

do $phase_2_preflight$
declare
  v_missing text[];
  v_mismatches text[];
  v_conflicts text[];
  v_legacy_count bigint;
begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'Phase 2 requires PostgreSQL 15 or newer.';
  end if;

  select array_agg(required_name order by required_name)
  into v_missing
  from (
    values
      ('public.contacts'),
      ('public.email_campaign_recipients'),
      ('public.listing_realtor_matches'),
      ('public.listing_website_engagement_events'),
      ('public.listings'),
      ('public.profiles')
  ) as required(required_name)
  where pg_catalog.to_regclass(required.required_name) is null;

  if v_missing is not null then
    raise exception 'Phase 2 required tables are missing: %',
      pg_catalog.array_to_string(v_missing, ', ');
  end if;

  with required_columns(table_name, column_name, data_type, is_nullable) as (
    values
      ('listing_realtor_matches', 'id', 'uuid', 'NO'),
      ('listing_realtor_matches', 'listing_id', 'uuid', 'NO'),
      ('listing_realtor_matches', 'contact_id', 'uuid', 'YES'),
      ('listing_realtor_matches', 'is_active', 'boolean', 'NO'),
      ('contacts', 'id', 'uuid', 'NO'),
      ('contacts', 'org_id', 'uuid', 'NO'),
      ('contacts', 'phone', 'text', 'YES'),
      ('contacts', 'sms_marketing_status', 'text', 'NO'),
      ('contacts', 'do_not_contact', 'boolean', 'NO'),
      ('contacts', 'is_archived', 'boolean', 'NO'),
      ('listings', 'id', 'uuid', 'NO'),
      ('listings', 'org_id', 'uuid', 'NO'),
      ('listings', 'owner_user_id', 'uuid', 'YES'),
      ('listings', 'website_slug', 'text', 'YES'),
      ('listings', 'website_status', 'text', 'NO'),
      ('listings', 'website_published_at', 'timestamp with time zone', 'YES'),
      ('listing_website_engagement_events', 'listing_id', 'uuid', 'NO'),
      ('listing_website_engagement_events', 'event_at', 'timestamp with time zone', 'NO'),
      ('listing_website_engagement_events', 'marketing_source', 'text', 'YES'),
      ('listing_website_engagement_events', 'utm_source', 'text', 'YES'),
      ('listing_website_engagement_events', 'utm_medium', 'text', 'YES'),
      ('listing_website_engagement_events', 'utm_campaign', 'text', 'YES')
  )
  select pg_catalog.array_agg(
    required_columns.table_name || '.' || required_columns.column_name
    order by required_columns.table_name, required_columns.column_name
  )
  into v_mismatches
  from required_columns
  left join information_schema.columns as c
    on c.table_schema = 'public'
   and c.table_name = required_columns.table_name
   and c.column_name = required_columns.column_name
  where c.column_name is null
     or c.data_type <> required_columns.data_type
     or c.is_nullable <> required_columns.is_nullable;

  if v_mismatches is not null then
    raise exception 'Phase 2 required columns changed: %',
      pg_catalog.array_to_string(v_mismatches, ', ');
  end if;

  select pg_catalog.array_agg(c.relname order by c.relname)
  into v_mismatches
  from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'contacts',
      'listing_realtor_matches',
      'listing_website_engagement_events',
      'listings'
    )
    and (
      c.relkind <> 'r'
      or not c.relrowsecurity
      or c.relforcerowsecurity
    );

  if v_mismatches is not null then
    raise exception 'Phase 2 required RLS table state changed: %',
      pg_catalog.array_to_string(v_mismatches, ', ');
  end if;

  if pg_catalog.to_regprocedure(
       'public.marketing_can_manage_owned_record(uuid,uuid)'
     ) is null
     or pg_catalog.to_regprocedure(
       'public.set_marketing_updated_at()'
     ) is null then
    raise exception 'Phase 2 required ownership/timestamp helpers are missing.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as p
    where p.oid =
      'public.marketing_can_manage_owned_record(uuid,uuid)'::pg_catalog.regprocedure
      and p.prosecdef
      and p.provolatile = 's'
  ) then
    raise exception 'The inspected ownership helper no longer matches.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index as i
    join pg_catalog.pg_class as c on c.oid = i.indexrelid
    where i.indrelid = 'public.listing_realtor_matches'::pg_catalog.regclass
      and c.relname = 'listing_realtor_matches_source_unique'
      and i.indisunique
      and i.indisvalid
  ) then
    raise exception 'The inspected Realtor-match upsert index is missing or invalid.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as t
    where t.tgrelid =
      'public.listing_website_engagement_events'::pg_catalog.regclass
      and t.tgname = 'listing_website_engagement_classify_context'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) then
    raise exception 'The inspected website-engagement classifier trigger is unavailable.';
  end if;

  select array_agg(conflict_name order by conflict_name)
  into v_conflicts
  from (
    select object_name as conflict_name
    from (
      values
        ('public.listing_realtor_initial_outreaches'),
        ('public.listing_realtor_initial_outreach_matches'),
        ('public.listing_realtor_manual_send_attempts'),
        ('public.listing_realtor_outreach_actions'),
        ('public.listing_realtor_outreach_audit_events')
    ) as target_table(object_name)
    where pg_catalog.to_regclass(target_table.object_name) is not null

    union all

    select 'public.listing_realtor_matches.' || c.column_name
    from information_schema.columns as c
    where c.table_schema = 'public'
      and c.table_name = 'listing_realtor_matches'
      and c.column_name in (
        'realtor_disposition',
        'disposition_changed_at',
        'disposition_changed_by',
        'follow_up_at'
      )

    union all

    select 'public.listing_website_engagement_events.' || c.column_name
    from information_schema.columns as c
    where c.table_schema = 'public'
      and c.table_name = 'listing_website_engagement_events'
      and c.column_name = 'realtor_initial_outreach_id'

    union all

    select p.oid::pg_catalog.regprocedure::text
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'protect_listing_realtor_initial_outreach_identity',
        'protect_listing_realtor_outreach_match_identity',
        'protect_listing_realtor_manual_send_attempt',
        'prevent_listing_realtor_history_mutation',
        'bind_listing_website_engagement_outreach',
        'set_listing_realtor_match_disposition',
        'ensure_listing_realtor_initial_outreach',
        'save_listing_realtor_initial_outreach_draft',
        'authorize_listing_realtor_manual_send',
        'confirm_listing_realtor_manual_send'
      )
  ) as conflicts;

  if v_conflicts is not null then
    raise exception 'Phase 2 target objects already exist: %',
      pg_catalog.array_to_string(v_conflicts, ', ');
  end if;

  select pg_catalog.count(*)
  into v_legacy_count
  from public.listing_realtor_matches;

  if v_legacy_count <> 28 then
    raise exception
      'Phase 2 expected exactly 28 pre-install Realtor matches; found %.',
      v_legacy_count;
  end if;

  if not pg_catalog.has_table_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'INSERT'
     )
     or not pg_catalog.has_table_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'UPDATE'
     ) then
    raise exception 'The inspected service-role import privileges changed.';
  end if;
end;
$phase_2_preflight$;

-- ============================================================
-- 01. MATCH DISPOSITION FOUNDATION AND LEGACY INSTALLATION
-- ============================================================

alter table public.listing_realtor_matches
  add column realtor_disposition text,
  add column disposition_changed_at timestamptz,
  add column disposition_changed_by uuid,
  add column follow_up_at timestamptz;

update public.listing_realtor_matches
set realtor_disposition = 'review_required'
where realtor_disposition is null;

do $phase_2_legacy_backfill$
declare
  v_review_required_count bigint;
begin
  select pg_catalog.count(*)
  into v_review_required_count
  from public.listing_realtor_matches
  where realtor_disposition = 'review_required';

  if v_review_required_count <> 28 then
    raise exception
      'Phase 2 legacy backfill expected 28 review-required rows; found %.',
      v_review_required_count;
  end if;
end;
$phase_2_legacy_backfill$;

alter table public.listing_realtor_matches
  alter column realtor_disposition set not null,
  alter column realtor_disposition set default 'ready_to_contact',
  add constraint listing_realtor_matches_disposition_check
    check (
      realtor_disposition in (
        'review_required',
        'ready_to_contact',
        'already_contacted',
        'replied',
        'already_saw_property',
        'not_interested',
        'follow_up_later',
        'do_not_contact'
      )
    ),
  add constraint listing_realtor_matches_follow_up_check
    check (
      (
        realtor_disposition = 'follow_up_later'
        and follow_up_at is not null
      )
      or (
        realtor_disposition <> 'follow_up_later'
        and follow_up_at is null
      )
    );

create index listing_realtor_matches_disposition_idx
on public.listing_realtor_matches (
  listing_id,
  realtor_disposition,
  follow_up_at
);

-- Reset the non-owner privilege surface completely. Then restore only SELECT
-- where required and the exact 23 import columns from reverseProspectingImport.ts.
revoke all privileges
on table public.listing_realtor_matches
from anon, authenticated, service_role;

grant select
on table public.listing_realtor_matches
to authenticated, service_role;

grant insert (
  org_id,
  owner_user_id,
  listing_id,
  batch_id,
  mls_compliance_profile_id,
  contact_id,
  external_agent_id,
  external_office_id,
  external_match_id,
  agent_email,
  agent_email_normalized,
  agent_first_name,
  agent_last_name,
  agent_display_name,
  agent_company,
  match_source,
  buyer_match_count,
  match_reasons,
  criteria_summary,
  match_score,
  is_active,
  last_matched_at,
  source_payload
)
on public.listing_realtor_matches
to service_role;

grant update (
  org_id,
  owner_user_id,
  listing_id,
  batch_id,
  mls_compliance_profile_id,
  contact_id,
  external_agent_id,
  external_office_id,
  external_match_id,
  agent_email,
  agent_email_normalized,
  agent_first_name,
  agent_last_name,
  agent_display_name,
  agent_company,
  match_source,
  buyer_match_count,
  match_reasons,
  criteria_summary,
  match_score,
  is_active,
  last_matched_at,
  source_payload
)
on public.listing_realtor_matches
to service_role;

-- ============================================================
-- 02. NORMALIZED OUTREACH, MATCH LINKS, SEND ATTEMPTS, AND HISTORY
-- ============================================================

create table public.listing_realtor_initial_outreaches (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  canonical_listing_id uuid not null,
  listing_id uuid
    constraint lr_initial_outreaches_listing_fk
    references public.listings(id)
    on delete set null,
  canonical_contact_id uuid not null,
  contact_id uuid
    constraint lr_initial_outreaches_contact_fk
    references public.contacts(id)
    on delete set null,
  org_id_snapshot uuid not null,
  tracking_token uuid not null default pg_catalog.gen_random_uuid(),
  tracking_status text not null default 'active',
  tracking_revoked_at timestamptz,
  tracking_revoked_by_snapshot uuid,
  outreach_state text not null default 'not_started',
  draft_message text,
  draft_revision integer not null default 0,
  draft_saved_at timestamptz,
  draft_saved_by_snapshot uuid,
  confirmed_send_attempt_id uuid,
  confirmed_message_snapshot text,
  confirmed_sent_at timestamptz,
  reported_sent_at timestamptz,
  confirmed_by_snapshot uuid,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),

  constraint listing_realtor_initial_outreaches_canonical_unique
    unique (canonical_listing_id, canonical_contact_id),
  constraint listing_realtor_initial_outreaches_tracking_unique
    unique (tracking_token),
  constraint listing_realtor_initial_outreaches_tracking_check
    check (
      (
        tracking_status = 'active'
        and tracking_revoked_at is null
        and tracking_revoked_by_snapshot is null
      )
      or (
        tracking_status = 'revoked'
        and tracking_revoked_at is not null
        and tracking_revoked_by_snapshot is not null
      )
    ),
  constraint listing_realtor_initial_outreaches_draft_check
    check (
      draft_revision >= 0
      and (
        (
          outreach_state = 'not_started'
          and draft_revision = 0
          and draft_message is null
          and draft_saved_at is null
          and draft_saved_by_snapshot is null
        )
        or (
          outreach_state in ('drafted', 'manual_sent')
          and draft_revision > 0
          and draft_message is not null
          and pg_catalog.length(pg_catalog.btrim(draft_message)) > 0
          and pg_catalog.length(draft_message) <= 2000
          and draft_saved_at is not null
          and draft_saved_by_snapshot is not null
        )
      )
    ),
  constraint listing_realtor_initial_outreaches_sent_check
    check (
      (
        outreach_state in ('not_started', 'drafted')
        and confirmed_send_attempt_id is null
        and confirmed_message_snapshot is null
        and confirmed_sent_at is null
        and reported_sent_at is null
        and confirmed_by_snapshot is null
      )
      or (
        outreach_state = 'manual_sent'
        and confirmed_send_attempt_id is not null
        and confirmed_message_snapshot is not null
        and pg_catalog.length(
          pg_catalog.btrim(confirmed_message_snapshot)
        ) > 0
        and confirmed_sent_at is not null
        and confirmed_by_snapshot is not null
      )
    )
);

revoke all
on table public.listing_realtor_initial_outreaches
from public, anon, authenticated, service_role;

create table public.listing_realtor_initial_outreach_matches (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  outreach_id uuid not null
    constraint lr_initial_outreach_matches_outreach_fk
    references public.listing_realtor_initial_outreaches(id)
    on delete restrict,
  realtor_match_id_snapshot uuid not null,
  realtor_match_id uuid
    constraint lr_initial_outreach_matches_match_fk
    references public.listing_realtor_matches(id)
    on delete set null,
  canonical_listing_id uuid not null,
  canonical_contact_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),

  constraint listing_realtor_initial_outreach_matches_pair_unique
    unique (outreach_id, realtor_match_id_snapshot),
  constraint listing_realtor_initial_outreach_matches_match_unique
    unique (realtor_match_id_snapshot)
);

revoke all
on table public.listing_realtor_initial_outreach_matches
from public, anon, authenticated, service_role;

create table public.listing_realtor_manual_send_attempts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  outreach_id uuid not null
    constraint lr_manual_send_attempts_outreach_fk
    references public.listing_realtor_initial_outreaches(id)
    on delete restrict,
  canonical_listing_id uuid not null,
  canonical_contact_id uuid not null,
  realtor_match_id_snapshot uuid not null,
  draft_revision integer not null,
  authorized_message_snapshot text not null,
  authorized_at timestamptz not null default pg_catalog.clock_timestamp(),
  authorized_by_snapshot uuid not null,
  confirmed_at timestamptz,
  reported_sent_at timestamptz,
  confirmed_message_snapshot text,
  confirmed_by_snapshot uuid,

  constraint listing_realtor_manual_send_attempts_revision_unique
    unique (outreach_id, draft_revision),
  constraint listing_realtor_manual_send_attempts_identity_unique
    unique (id, outreach_id),
  constraint listing_realtor_manual_send_attempts_message_check
    check (
      draft_revision > 0
      and pg_catalog.length(
        pg_catalog.btrim(authorized_message_snapshot)
      ) > 0
      and pg_catalog.length(authorized_message_snapshot) <= 2000
    ),
  constraint listing_realtor_manual_send_attempts_confirmation_check
    check (
      (
        confirmed_at is null
        and reported_sent_at is null
        and confirmed_message_snapshot is null
        and confirmed_by_snapshot is null
      )
      or (
        confirmed_at is not null
        and confirmed_at >= authorized_at
        and confirmed_message_snapshot is not null
        and pg_catalog.length(
          pg_catalog.btrim(confirmed_message_snapshot)
        ) > 0
        and confirmed_message_snapshot = authorized_message_snapshot
        and confirmed_by_snapshot is not null
        and (
          reported_sent_at is null
          or (
            reported_sent_at >= authorized_at
            and reported_sent_at <= confirmed_at + interval '5 minutes'
          )
        )
      )
    )
);

revoke all
on table public.listing_realtor_manual_send_attempts
from public, anon, authenticated, service_role;

alter table public.listing_realtor_initial_outreaches
  add constraint listing_realtor_initial_outreaches_confirmed_attempt_fk
  foreign key (confirmed_send_attempt_id, id)
  references public.listing_realtor_manual_send_attempts(id, outreach_id)
  on delete restrict,
  add constraint listing_realtor_initial_outreaches_confirmed_attempt_unique
  unique (confirmed_send_attempt_id);

create table public.listing_realtor_outreach_actions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  actor_user_id_snapshot uuid not null,
  idempotency_key uuid not null,
  action_type text not null,
  outreach_id uuid
    constraint lr_outreach_actions_outreach_fk
    references public.listing_realtor_initial_outreaches(id)
    on delete restrict,
  realtor_match_id_snapshot uuid not null,
  canonical_listing_id uuid not null,
  canonical_contact_id uuid,
  request_fingerprint jsonb not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),

  constraint listing_realtor_outreach_actions_idempotency_unique
    unique (actor_user_id_snapshot, idempotency_key),
  constraint listing_realtor_outreach_actions_type_check
    check (
      action_type in (
        'set_disposition',
        'ensure_outreach',
        'save_draft',
        'authorize_manual_send',
        'confirm_manual_send'
      )
    ),
  constraint listing_realtor_outreach_actions_json_check
    check (
      pg_catalog.jsonb_typeof(request_fingerprint) = 'object'
      and pg_catalog.jsonb_typeof(result_snapshot) = 'object'
    )
);

revoke all
on table public.listing_realtor_outreach_actions
from public, anon, authenticated, service_role;

create table public.listing_realtor_outreach_audit_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  outreach_id uuid
    constraint lr_outreach_audit_events_outreach_fk
    references public.listing_realtor_initial_outreaches(id)
    on delete restrict,
  realtor_match_id_snapshot uuid not null,
  canonical_listing_id uuid not null,
  canonical_contact_id uuid,
  actor_user_id_snapshot uuid not null,
  event_type text not null,
  event_at timestamptz not null default pg_catalog.clock_timestamp(),
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,

  constraint listing_realtor_outreach_audit_events_type_check
    check (
      event_type in (
        'disposition_changed',
        'draft_saved',
        'manual_send_authorized',
        'manual_send_confirmed'
      )
    ),
  constraint listing_realtor_outreach_audit_events_json_check
    check (
      pg_catalog.jsonb_typeof(old_values) = 'object'
      and pg_catalog.jsonb_typeof(new_values) = 'object'
    )
);

revoke all
on table public.listing_realtor_outreach_audit_events
from public, anon, authenticated, service_role;

create index listing_realtor_initial_outreaches_listing_state_idx
on public.listing_realtor_initial_outreaches (
  canonical_listing_id,
  outreach_state,
  updated_at desc
);

create index listing_realtor_initial_outreach_matches_outreach_idx
on public.listing_realtor_initial_outreach_matches (outreach_id);

create index listing_realtor_manual_send_attempts_outreach_idx
on public.listing_realtor_manual_send_attempts (
  outreach_id,
  authorized_at desc
);

create index listing_realtor_outreach_actions_outreach_idx
on public.listing_realtor_outreach_actions (
  outreach_id,
  created_at desc
);

create index listing_realtor_outreach_audit_events_outreach_idx
on public.listing_realtor_outreach_audit_events (
  outreach_id,
  event_at desc
);

-- ============================================================
-- 03. PHASE 3-COMPATIBLE WEBSITE-ENGAGEMENT ATTRIBUTION
-- ============================================================

alter table public.listing_website_engagement_events
  add column realtor_initial_outreach_id uuid,
  add constraint listing_website_engagement_outreach_fk
    foreign key (realtor_initial_outreach_id)
    references public.listing_realtor_initial_outreaches(id)
    on delete restrict;

create index listing_website_engagement_outreach_event_idx
on public.listing_website_engagement_events (
  realtor_initial_outreach_id,
  event_at desc
)
where realtor_initial_outreach_id is not null;

-- ============================================================
-- 04. IMMUTABILITY AND ATTRIBUTION TRIGGERS
-- ============================================================

create function public.protect_listing_realtor_initial_outreach_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.canonical_listing_id is distinct from old.canonical_listing_id
     or new.canonical_contact_id is distinct from old.canonical_contact_id
     or new.org_id_snapshot is distinct from old.org_id_snapshot
     or new.tracking_token is distinct from old.tracking_token
     or new.created_at is distinct from old.created_at then
    raise exception 'The canonical outreach identity is immutable.';
  end if;

  if (
       old.listing_id is null
       and new.listing_id is not null
     )
     or (
       old.listing_id is not null
       and new.listing_id is not null
       and new.listing_id is distinct from old.listing_id
     )
     or (
       old.contact_id is null
       and new.contact_id is not null
     )
     or (
       old.contact_id is not null
       and new.contact_id is not null
       and new.contact_id is distinct from old.contact_id
     ) then
    raise exception 'A live outreach relationship cannot be reassigned.';
  end if;

  if old.confirmed_sent_at is not null
     and (
       new.outreach_state is distinct from old.outreach_state
       or new.draft_message is distinct from old.draft_message
       or new.draft_revision is distinct from old.draft_revision
       or new.draft_saved_at is distinct from old.draft_saved_at
       or new.draft_saved_by_snapshot is distinct from old.draft_saved_by_snapshot
       or new.confirmed_send_attempt_id is distinct from old.confirmed_send_attempt_id
       or new.confirmed_message_snapshot is distinct from old.confirmed_message_snapshot
       or new.confirmed_sent_at is distinct from old.confirmed_sent_at
       or new.reported_sent_at is distinct from old.reported_sent_at
       or new.confirmed_by_snapshot is distinct from old.confirmed_by_snapshot
     ) then
    raise exception 'A confirmed outreach snapshot is immutable.';
  end if;

  return new;
end;
$function$;

revoke all
on function public.protect_listing_realtor_initial_outreach_identity()
from public, anon, authenticated, service_role;

create function public.protect_listing_realtor_outreach_match_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.outreach_id is distinct from old.outreach_id
     or new.realtor_match_id_snapshot is distinct from old.realtor_match_id_snapshot
     or new.canonical_listing_id is distinct from old.canonical_listing_id
     or new.canonical_contact_id is distinct from old.canonical_contact_id
     or new.created_at is distinct from old.created_at then
    raise exception 'The outreach-to-match identity is immutable.';
  end if;

  if (
       old.realtor_match_id is null
       and new.realtor_match_id is not null
     )
     or (
       old.realtor_match_id is not null
       and new.realtor_match_id is not null
       and new.realtor_match_id is distinct from old.realtor_match_id
     ) then
    raise exception 'A live Realtor-match relationship cannot be reassigned.';
  end if;

  return new;
end;
$function$;

revoke all
on function public.protect_listing_realtor_outreach_match_identity()
from public, anon, authenticated, service_role;

create function public.protect_listing_realtor_manual_send_attempt()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.outreach_id is distinct from old.outreach_id
     or new.canonical_listing_id is distinct from old.canonical_listing_id
     or new.canonical_contact_id is distinct from old.canonical_contact_id
     or new.realtor_match_id_snapshot is distinct from old.realtor_match_id_snapshot
     or new.draft_revision is distinct from old.draft_revision
     or new.authorized_message_snapshot is distinct from old.authorized_message_snapshot
     or new.authorized_at is distinct from old.authorized_at
     or new.authorized_by_snapshot is distinct from old.authorized_by_snapshot then
    raise exception 'The manual-send authorization identity is immutable.';
  end if;

  if old.confirmed_at is not null and new is distinct from old then
    raise exception 'A confirmed manual-send attempt is immutable.';
  end if;

  return new;
end;
$function$;

revoke all
on function public.protect_listing_realtor_manual_send_attempt()
from public, anon, authenticated, service_role;

create function public.prevent_listing_realtor_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Reverse Prospecting history is append-only.';
end;
$function$;

revoke all
on function public.prevent_listing_realtor_history_mutation()
from public, anon, authenticated, service_role;

create function public.bind_listing_website_engagement_outreach()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_listing_id uuid;
  v_tracking_status text;
begin
  if tg_op = 'UPDATE'
     and old.realtor_initial_outreach_id is not null
     and new.realtor_initial_outreach_id is distinct from
         old.realtor_initial_outreach_id then
    raise exception 'Realtor outreach attribution is immutable.';
  end if;

  if tg_op = 'UPDATE'
     and old.realtor_initial_outreach_id is null
     and new.realtor_initial_outreach_id is not null then
    raise exception 'Realtor outreach attribution is insert-only.';
  end if;

  if new.realtor_initial_outreach_id is null then
    return new;
  end if;

  select
    o.canonical_listing_id,
    o.tracking_status
  into
    v_listing_id,
    v_tracking_status
  from public.listing_realtor_initial_outreaches as o
  where o.id = new.realtor_initial_outreach_id;

  if not found then
    raise exception 'The Realtor outreach attribution does not exist.';
  end if;

  if v_listing_id is distinct from new.listing_id then
    raise exception 'The Realtor outreach does not belong to this listing.';
  end if;

  if v_tracking_status <> 'active' then
    raise exception 'The Realtor outreach tracking link is not active.';
  end if;

  new.marketing_source := 'reverse_prospecting';
  new.utm_source := 'reverse_prospecting';
  new.utm_medium := 'manual_sms';
  new.utm_campaign := 'realtor_initial_outreach';

  return new;
end;
$function$;

revoke all
on function public.bind_listing_website_engagement_outreach()
from public, anon, authenticated, service_role;

create trigger listing_realtor_initial_outreaches_10_protect_identity
before update on public.listing_realtor_initial_outreaches
for each row
execute function public.protect_listing_realtor_initial_outreach_identity();

create trigger listing_realtor_initial_outreaches_90_set_updated_at
before update on public.listing_realtor_initial_outreaches
for each row
execute function public.set_marketing_updated_at();

create trigger listing_realtor_initial_outreach_matches_protect_identity
before update on public.listing_realtor_initial_outreach_matches
for each row
execute function public.protect_listing_realtor_outreach_match_identity();

create trigger listing_realtor_manual_send_attempts_protect_identity
before update on public.listing_realtor_manual_send_attempts
for each row
execute function public.protect_listing_realtor_manual_send_attempt();

create trigger listing_realtor_outreach_actions_append_only
before update or delete on public.listing_realtor_outreach_actions
for each row
execute function public.prevent_listing_realtor_history_mutation();

create trigger listing_realtor_outreach_audit_events_append_only
before update or delete on public.listing_realtor_outreach_audit_events
for each row
execute function public.prevent_listing_realtor_history_mutation();

-- Alphabetically precedes the existing classifier trigger so the classifier
-- sees the server-bound marketing source on INSERT.
create trigger listing_website_engagement_00_bind_realtor_outreach
before insert or update of
  realtor_initial_outreach_id,
  listing_id,
  marketing_source,
  utm_source,
  utm_medium,
  utm_campaign,
  event_context
on public.listing_website_engagement_events
for each row
execute function public.bind_listing_website_engagement_outreach();

-- ============================================================
-- 05. ROW-LEVEL SECURITY AND READ SURFACES
-- ============================================================

alter table public.listing_realtor_initial_outreaches enable row level security;
alter table public.listing_realtor_initial_outreach_matches enable row level security;
alter table public.listing_realtor_manual_send_attempts enable row level security;
alter table public.listing_realtor_outreach_actions enable row level security;
alter table public.listing_realtor_outreach_audit_events enable row level security;

create policy listing_realtor_initial_outreaches_select
on public.listing_realtor_initial_outreaches
for select
to authenticated
using (
  exists (
    select 1
    from public.listings as l
    where l.id = canonical_listing_id
      and public.marketing_can_manage_owned_record(
        l.org_id,
        l.owner_user_id
      )
  )
);

create policy listing_realtor_initial_outreach_matches_select
on public.listing_realtor_initial_outreach_matches
for select
to authenticated
using (
  exists (
    select 1
    from public.listings as l
    where l.id = canonical_listing_id
      and public.marketing_can_manage_owned_record(
        l.org_id,
        l.owner_user_id
      )
  )
);

create policy listing_realtor_manual_send_attempts_select
on public.listing_realtor_manual_send_attempts
for select
to authenticated
using (
  exists (
    select 1
    from public.listings as l
    where l.id = canonical_listing_id
      and public.marketing_can_manage_owned_record(
        l.org_id,
        l.owner_user_id
      )
  )
);

create policy listing_realtor_outreach_actions_select
on public.listing_realtor_outreach_actions
for select
to authenticated
using (
  exists (
    select 1
    from public.listings as l
    where l.id = canonical_listing_id
      and public.marketing_can_manage_owned_record(
        l.org_id,
        l.owner_user_id
      )
  )
);

create policy listing_realtor_outreach_audit_events_select
on public.listing_realtor_outreach_audit_events
for select
to authenticated
using (
  exists (
    select 1
    from public.listings as l
    where l.id = canonical_listing_id
      and public.marketing_can_manage_owned_record(
        l.org_id,
        l.owner_user_id
      )
  )
);

grant select
on table
  public.listing_realtor_initial_outreaches,
  public.listing_realtor_initial_outreach_matches,
  public.listing_realtor_manual_send_attempts,
  public.listing_realtor_outreach_actions,
  public.listing_realtor_outreach_audit_events
to authenticated;

-- Reserved for the later server-side /rp/[token] resolver. No anonymous table
-- access is granted, and the Phase 2 migration creates no public redirect RPC.
grant select (
  id,
  canonical_listing_id,
  listing_id,
  tracking_token,
  tracking_status
)
on public.listing_realtor_initial_outreaches
to service_role;

-- ============================================================
-- 06. DISPOSITION RPC
-- ============================================================

create function public.set_listing_realtor_match_disposition(
  p_match_id uuid,
  p_disposition text,
  p_follow_up_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_match record;
  v_outreach_id uuid;
  v_request jsonb;
  v_existing record;
  v_result jsonb;
  v_now timestamptz;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_match_id is null or p_idempotency_key is null then
    raise exception 'Match ID and idempotency key are required.';
  end if;

  if p_disposition is null or p_disposition not in (
    'review_required',
    'ready_to_contact',
    'already_contacted',
    'replied',
    'already_saw_property',
    'not_interested',
    'follow_up_later',
    'do_not_contact'
  ) then
    raise exception 'Unsupported Realtor disposition.';
  end if;

  select
    m.id,
    m.listing_id,
    m.contact_id,
    m.realtor_disposition,
    m.follow_up_at,
    l.org_id as current_org_id,
    l.owner_user_id as current_owner_user_id
  into v_match
  from public.listing_realtor_matches as m
  join public.listings as l on l.id = m.listing_id
  where m.id = p_match_id
  for update of m, l;

  if not found then
    raise exception 'The Realtor match was not found.';
  end if;

  if not public.marketing_can_manage_owned_record(
       v_match.current_org_id,
       v_match.current_owner_user_id
     ) then
    raise exception 'You cannot manage this listing.' using errcode = '42501';
  end if;

  v_request := pg_catalog.jsonb_build_object(
    'match_id', p_match_id,
    'disposition', p_disposition,
    'follow_up_at', p_follow_up_at
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select a.*
  into v_existing
  from public.listing_realtor_outreach_actions as a
  where a.actor_user_id_snapshot = v_actor_id
    and a.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.action_type <> 'set_disposition'
       or v_existing.request_fingerprint <> v_request then
      raise exception 'Idempotency key was already used for a different request.';
    end if;
    return v_existing.result_snapshot;
  end if;

  -- Time-relative validation occurs only for a new logical action. A replay of
  -- the exact committed idempotency key remains stable after time advances.
  v_now := pg_catalog.clock_timestamp();

  if p_disposition = 'follow_up_later' then
    if p_follow_up_at is null
       or p_follow_up_at <= v_now + interval '5 minutes' then
      raise exception 'Follow-up time must be more than five minutes in the future.';
    end if;
  elsif p_follow_up_at is not null then
    raise exception 'Follow-up time is only valid for follow_up_later.';
  end if;

  if v_match.contact_id is not null then
    select o.id
    into v_outreach_id
    from public.listing_realtor_initial_outreaches as o
    where o.canonical_listing_id = v_match.listing_id
      and o.canonical_contact_id = v_match.contact_id;
  end if;

  if v_match.realtor_disposition is not distinct from p_disposition
     and v_match.follow_up_at is not distinct from p_follow_up_at then
    v_result := pg_catalog.jsonb_build_object(
      'match_id', p_match_id,
      'disposition', v_match.realtor_disposition,
      'follow_up_at', v_match.follow_up_at,
      'changed', false
    );
  else
    update public.listing_realtor_matches
    set
      realtor_disposition = p_disposition,
      follow_up_at = case
        when p_disposition = 'follow_up_later' then p_follow_up_at
        else null
      end,
      disposition_changed_at = v_now,
      disposition_changed_by = v_actor_id
    where id = p_match_id;

    insert into public.listing_realtor_outreach_audit_events (
      outreach_id,
      realtor_match_id_snapshot,
      canonical_listing_id,
      canonical_contact_id,
      actor_user_id_snapshot,
      event_type,
      event_at,
      old_values,
      new_values
    ) values (
      v_outreach_id,
      p_match_id,
      v_match.listing_id,
      v_match.contact_id,
      v_actor_id,
      'disposition_changed',
      v_now,
      pg_catalog.jsonb_build_object(
        'disposition', v_match.realtor_disposition,
        'follow_up_at', v_match.follow_up_at
      ),
      pg_catalog.jsonb_build_object(
        'disposition', p_disposition,
        'follow_up_at', p_follow_up_at
      )
    );

    v_result := pg_catalog.jsonb_build_object(
      'match_id', p_match_id,
      'disposition', p_disposition,
      'follow_up_at', p_follow_up_at,
      'changed_at', v_now,
      'changed', true
    );
  end if;

  insert into public.listing_realtor_outreach_actions (
    actor_user_id_snapshot,
    idempotency_key,
    action_type,
    outreach_id,
    realtor_match_id_snapshot,
    canonical_listing_id,
    canonical_contact_id,
    request_fingerprint,
    result_snapshot
  ) values (
    v_actor_id,
    p_idempotency_key,
    'set_disposition',
    v_outreach_id,
    p_match_id,
    v_match.listing_id,
    v_match.contact_id,
    v_request,
    v_result
  );

  return v_result;
end;
$function$;

revoke all
on function public.set_listing_realtor_match_disposition(
  uuid, text, timestamptz, uuid
)
from public, anon, authenticated, service_role;

grant execute
on function public.set_listing_realtor_match_disposition(
  uuid, text, timestamptz, uuid
)
to authenticated;

-- ============================================================
-- 07. ENSURE STABLE CANONICAL OUTREACH AND TRACKING TOKEN
-- ============================================================

create function public.ensure_listing_realtor_initial_outreach(
  p_match_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_match record;
  v_request jsonb;
  v_existing record;
  v_outreach public.listing_realtor_initial_outreaches%rowtype;
  v_result jsonb;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_match_id is null or p_idempotency_key is null then
    raise exception 'Match ID and idempotency key are required.';
  end if;

  select
    m.id,
    m.listing_id,
    m.contact_id,
    m.is_active,
    m.realtor_disposition,
    l.org_id as current_org_id,
    l.owner_user_id as current_owner_user_id,
    l.website_status,
    l.website_slug,
    l.website_published_at,
    c.org_id as contact_org_id,
    c.phone,
    c.sms_marketing_status,
    c.do_not_contact,
    c.is_archived
  into v_match
  from public.listing_realtor_matches as m
  join public.listings as l on l.id = m.listing_id
  join public.contacts as c on c.id = m.contact_id
  where m.id = p_match_id
  for share of m, l, c;

  if not found then
    raise exception 'The Realtor match, listing, or linked contact was not found.';
  end if;

  if not public.marketing_can_manage_owned_record(
       v_match.current_org_id,
       v_match.current_owner_user_id
     ) then
    raise exception 'You cannot manage this listing.' using errcode = '42501';
  end if;

  v_request := pg_catalog.jsonb_build_object('match_id', p_match_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select a.*
  into v_existing
  from public.listing_realtor_outreach_actions as a
  where a.actor_user_id_snapshot = v_actor_id
    and a.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.action_type <> 'ensure_outreach'
       or v_existing.request_fingerprint <> v_request then
      raise exception 'Idempotency key was already used for a different request.';
    end if;
    return v_existing.result_snapshot;
  end if;

  if not v_match.is_active
     or v_match.realtor_disposition <> 'ready_to_contact' then
    raise exception 'The Realtor match is not active and ready to contact.';
  end if;

  if v_match.contact_id is null
     or v_match.contact_org_id is distinct from v_match.current_org_id then
    raise exception 'The Realtor match has no valid linked contact relationship.';
  end if;

  if v_match.do_not_contact then
    raise exception 'The linked contact is globally blocked from contact.';
  end if;

  if v_match.is_archived then
    raise exception 'The linked contact is archived.';
  end if;

  if v_match.sms_marketing_status in ('revoked', 'suppressed') then
    raise exception 'The linked contact is revoked or suppressed for SMS.';
  end if;

  if nullif(pg_catalog.btrim(v_match.phone), '') is null then
    raise exception 'The linked contact has no usable phone number.';
  end if;

  if v_match.website_status <> 'published'
     or v_match.website_published_at is null
     or nullif(pg_catalog.btrim(v_match.website_slug), '') is null then
    raise exception 'The listing website is not currently published.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_match.listing_id::text || ':' || v_match.contact_id::text,
      1
    )
  );

  insert into public.listing_realtor_initial_outreaches (
    canonical_listing_id,
    listing_id,
    canonical_contact_id,
    contact_id,
    org_id_snapshot
  ) values (
    v_match.listing_id,
    v_match.listing_id,
    v_match.contact_id,
    v_match.contact_id,
    v_match.current_org_id
  )
  on conflict (canonical_listing_id, canonical_contact_id) do nothing
  returning * into v_outreach;

  if not found then
    select o.*
    into v_outreach
    from public.listing_realtor_initial_outreaches as o
    where o.canonical_listing_id = v_match.listing_id
      and o.canonical_contact_id = v_match.contact_id
    for update;
  end if;

  insert into public.listing_realtor_initial_outreach_matches (
    outreach_id,
    realtor_match_id_snapshot,
    realtor_match_id,
    canonical_listing_id,
    canonical_contact_id
  ) values (
    v_outreach.id,
    p_match_id,
    p_match_id,
    v_match.listing_id,
    v_match.contact_id
  )
  on conflict (realtor_match_id_snapshot) do nothing;

  if not exists (
    select 1
    from public.listing_realtor_initial_outreach_matches as om
    where om.outreach_id = v_outreach.id
      and om.realtor_match_id_snapshot = p_match_id
      and om.canonical_listing_id = v_match.listing_id
      and om.canonical_contact_id = v_match.contact_id
  ) then
    raise exception 'The Realtor match is already bound to another outreach identity.';
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'outreach_id', v_outreach.id,
    'outreach_state', v_outreach.outreach_state,
    'tracking_token', v_outreach.tracking_token,
    'tracking_path', '/rp/' || v_outreach.tracking_token::text
  );

  insert into public.listing_realtor_outreach_actions (
    actor_user_id_snapshot,
    idempotency_key,
    action_type,
    outreach_id,
    realtor_match_id_snapshot,
    canonical_listing_id,
    canonical_contact_id,
    request_fingerprint,
    result_snapshot
  ) values (
    v_actor_id,
    p_idempotency_key,
    'ensure_outreach',
    v_outreach.id,
    p_match_id,
    v_match.listing_id,
    v_match.contact_id,
    v_request,
    v_result
  );

  return v_result;
end;
$function$;

revoke all
on function public.ensure_listing_realtor_initial_outreach(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute
on function public.ensure_listing_realtor_initial_outreach(uuid, uuid)
to authenticated;

-- ============================================================
-- 08. SAVE SAMANTHA'S EDITABLE DRAFT WITH OPTIMISTIC REVISION
-- ============================================================

create function public.save_listing_realtor_initial_outreach_draft(
  p_outreach_id uuid,
  p_match_id uuid,
  p_expected_revision integer,
  p_message text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_outreach public.listing_realtor_initial_outreaches%rowtype;
  v_match record;
  v_request jsonb;
  v_existing record;
  v_result jsonb;
  v_now timestamptz;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_outreach_id is null
     or p_match_id is null
     or p_expected_revision is null
     or p_idempotency_key is null then
    raise exception 'Outreach, match, expected revision, and idempotency key are required.';
  end if;

  if p_message is null
     or pg_catalog.length(pg_catalog.btrim(p_message)) = 0
     or pg_catalog.length(p_message) > 2000 then
    raise exception 'Draft message must contain 1 to 2000 characters.';
  end if;

  select o.*
  into v_outreach
  from public.listing_realtor_initial_outreaches as o
  where o.id = p_outreach_id
  for update;

  if not found then
    raise exception 'The initial outreach was not found.';
  end if;

  select
    m.id,
    m.listing_id,
    m.contact_id,
    m.is_active,
    m.realtor_disposition,
    l.org_id as current_org_id,
    l.owner_user_id as current_owner_user_id,
    l.website_status,
    l.website_slug,
    l.website_published_at,
    c.org_id as contact_org_id,
    c.phone,
    c.sms_marketing_status,
    c.do_not_contact,
    c.is_archived
  into v_match
  from public.listing_realtor_initial_outreach_matches as om
  join public.listing_realtor_matches as m
    on m.id = om.realtor_match_id
  join public.listings as l on l.id = m.listing_id
  join public.contacts as c on c.id = m.contact_id
  where om.outreach_id = p_outreach_id
    and om.realtor_match_id_snapshot = p_match_id
  for share of m, l, c;

  if not found then
    raise exception 'The selected Realtor match is not linked to this outreach.';
  end if;

  if v_match.listing_id is distinct from v_outreach.canonical_listing_id
     or v_match.contact_id is distinct from v_outreach.canonical_contact_id then
    raise exception 'The live Realtor relationship no longer matches the canonical outreach.';
  end if;

  if not public.marketing_can_manage_owned_record(
       v_match.current_org_id,
       v_match.current_owner_user_id
     ) then
    raise exception 'You cannot manage this listing.' using errcode = '42501';
  end if;

  v_request := pg_catalog.jsonb_build_object(
    'outreach_id', p_outreach_id,
    'match_id', p_match_id,
    'expected_revision', p_expected_revision,
    'message', p_message
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select a.*
  into v_existing
  from public.listing_realtor_outreach_actions as a
  where a.actor_user_id_snapshot = v_actor_id
    and a.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.action_type <> 'save_draft'
       or v_existing.request_fingerprint <> v_request then
      raise exception 'Idempotency key was already used for a different request.';
    end if;
    return v_existing.result_snapshot;
  end if;

  if v_outreach.outreach_state = 'manual_sent' then
    raise exception 'A confirmed sent outreach cannot be redrafted.';
  end if;

  if p_expected_revision <> v_outreach.draft_revision then
    raise exception 'Draft revision conflict; reload the current draft.';
  end if;

  if not v_match.is_active
     or v_match.realtor_disposition <> 'ready_to_contact' then
    raise exception 'The Realtor match is not active and ready to contact.';
  end if;

  if v_match.contact_id is null
     or v_match.contact_org_id is distinct from v_match.current_org_id then
    raise exception 'The Realtor match has no valid linked contact relationship.';
  end if;

  if v_match.do_not_contact
     or v_match.is_archived
     or v_match.sms_marketing_status in ('revoked', 'suppressed')
     or nullif(pg_catalog.btrim(v_match.phone), '') is null then
    raise exception 'The linked contact is not currently eligible for manual SMS outreach.';
  end if;

  if v_match.website_status <> 'published'
     or v_match.website_published_at is null
     or nullif(pg_catalog.btrim(v_match.website_slug), '') is null then
    raise exception 'The listing website is not currently published.';
  end if;

  if v_outreach.tracking_status <> 'active' then
    raise exception 'The outreach tracking link is not active.';
  end if;

  v_now := pg_catalog.clock_timestamp();

  update public.listing_realtor_initial_outreaches
  set
    outreach_state = 'drafted',
    draft_message = p_message,
    draft_revision = draft_revision + 1,
    draft_saved_at = v_now,
    draft_saved_by_snapshot = v_actor_id
  where id = p_outreach_id
  returning * into v_outreach;

  insert into public.listing_realtor_outreach_audit_events (
    outreach_id,
    realtor_match_id_snapshot,
    canonical_listing_id,
    canonical_contact_id,
    actor_user_id_snapshot,
    event_type,
    event_at,
    old_values,
    new_values
  ) values (
    v_outreach.id,
    p_match_id,
    v_outreach.canonical_listing_id,
    v_outreach.canonical_contact_id,
    v_actor_id,
    'draft_saved',
    v_now,
    pg_catalog.jsonb_build_object(
      'draft_revision', p_expected_revision
    ),
    pg_catalog.jsonb_build_object(
      'draft_revision', v_outreach.draft_revision,
      'message_length', pg_catalog.length(p_message),
      'message_md5', pg_catalog.md5(p_message)
    )
  );

  v_result := pg_catalog.jsonb_build_object(
    'outreach_id', v_outreach.id,
    'outreach_state', v_outreach.outreach_state,
    'draft_revision', v_outreach.draft_revision,
    'draft_message', v_outreach.draft_message,
    'draft_saved_at', v_outreach.draft_saved_at
  );

  insert into public.listing_realtor_outreach_actions (
    actor_user_id_snapshot,
    idempotency_key,
    action_type,
    outreach_id,
    realtor_match_id_snapshot,
    canonical_listing_id,
    canonical_contact_id,
    request_fingerprint,
    result_snapshot
  ) values (
    v_actor_id,
    p_idempotency_key,
    'save_draft',
    v_outreach.id,
    p_match_id,
    v_outreach.canonical_listing_id,
    v_outreach.canonical_contact_id,
    v_request,
    v_result
  );

  return v_result;
end;
$function$;

revoke all
on function public.save_listing_realtor_initial_outreach_draft(
  uuid, uuid, integer, text, uuid
)
from public, anon, authenticated, service_role;

grant execute
on function public.save_listing_realtor_initial_outreach_draft(
  uuid, uuid, integer, text, uuid
)
to authenticated;

-- ============================================================
-- 09. DURABLE MANUAL-SEND AUTHORIZATION HANDSHAKE
-- ============================================================

create function public.authorize_listing_realtor_manual_send(
  p_outreach_id uuid,
  p_match_id uuid,
  p_expected_draft_revision integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_outreach public.listing_realtor_initial_outreaches%rowtype;
  v_match record;
  v_attempt public.listing_realtor_manual_send_attempts%rowtype;
  v_request jsonb;
  v_existing record;
  v_result jsonb;
  v_now timestamptz;
  v_attempt_created boolean := false;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_outreach_id is null
     or p_match_id is null
     or p_expected_draft_revision is null
     or p_idempotency_key is null then
    raise exception 'Outreach, match, draft revision, and idempotency key are required.';
  end if;

  select o.*
  into v_outreach
  from public.listing_realtor_initial_outreaches as o
  where o.id = p_outreach_id
  for update;

  if not found then
    raise exception 'The initial outreach was not found.';
  end if;

  select
    m.id,
    m.listing_id,
    m.contact_id,
    m.is_active,
    m.realtor_disposition,
    l.org_id as current_org_id,
    l.owner_user_id as current_owner_user_id,
    l.website_status,
    l.website_slug,
    l.website_published_at,
    c.org_id as contact_org_id,
    c.phone,
    c.sms_marketing_status,
    c.do_not_contact,
    c.is_archived
  into v_match
  from public.listing_realtor_initial_outreach_matches as om
  join public.listing_realtor_matches as m
    on m.id = om.realtor_match_id
  join public.listings as l on l.id = m.listing_id
  join public.contacts as c on c.id = m.contact_id
  where om.outreach_id = p_outreach_id
    and om.realtor_match_id_snapshot = p_match_id
  for share of m, l, c;

  if not found then
    raise exception 'The selected Realtor match is not linked to this outreach.';
  end if;

  if not public.marketing_can_manage_owned_record(
       v_match.current_org_id,
       v_match.current_owner_user_id
     ) then
    raise exception 'You cannot manage this listing.' using errcode = '42501';
  end if;

  v_request := pg_catalog.jsonb_build_object(
    'outreach_id', p_outreach_id,
    'match_id', p_match_id,
    'expected_draft_revision', p_expected_draft_revision
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select a.*
  into v_existing
  from public.listing_realtor_outreach_actions as a
  where a.actor_user_id_snapshot = v_actor_id
    and a.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.action_type <> 'authorize_manual_send'
       or v_existing.request_fingerprint <> v_request then
      raise exception 'Idempotency key was already used for a different request.';
    end if;
    return v_existing.result_snapshot;
  end if;

  if v_outreach.outreach_state <> 'drafted'
     or v_outreach.draft_revision <> p_expected_draft_revision
     or v_outreach.draft_message is null then
    raise exception 'The exact current drafted revision is required.';
  end if;

  if v_match.listing_id is distinct from v_outreach.canonical_listing_id
     or v_match.contact_id is distinct from v_outreach.canonical_contact_id then
    raise exception 'The live Realtor relationship no longer matches the canonical outreach.';
  end if;

  if not v_match.is_active
     or v_match.realtor_disposition <> 'ready_to_contact' then
    raise exception 'The Realtor match is not active and ready to contact.';
  end if;

  if v_match.contact_id is null
     or v_match.contact_org_id is distinct from v_match.current_org_id then
    raise exception 'The Realtor match has no valid linked contact relationship.';
  end if;

  if v_match.do_not_contact then
    raise exception 'The linked contact is globally blocked from contact.';
  end if;

  if v_match.is_archived then
    raise exception 'The linked contact is archived.';
  end if;

  if v_match.sms_marketing_status in ('revoked', 'suppressed') then
    raise exception 'The linked contact is revoked or suppressed for SMS.';
  end if;

  if nullif(pg_catalog.btrim(v_match.phone), '') is null then
    raise exception 'The linked contact has no usable phone number.';
  end if;

  if v_match.website_status <> 'published'
     or v_match.website_published_at is null
     or nullif(pg_catalog.btrim(v_match.website_slug), '') is null then
    raise exception 'The listing website is not currently published.';
  end if;

  if v_outreach.tracking_status <> 'active' then
    raise exception 'The outreach tracking link is not active.';
  end if;

  v_now := pg_catalog.clock_timestamp();

  insert into public.listing_realtor_manual_send_attempts (
    outreach_id,
    canonical_listing_id,
    canonical_contact_id,
    realtor_match_id_snapshot,
    draft_revision,
    authorized_message_snapshot,
    authorized_at,
    authorized_by_snapshot
  ) values (
    v_outreach.id,
    v_outreach.canonical_listing_id,
    v_outreach.canonical_contact_id,
    p_match_id,
    v_outreach.draft_revision,
    v_outreach.draft_message,
    v_now,
    v_actor_id
  )
  on conflict (outreach_id, draft_revision) do nothing
  returning * into v_attempt;

  if found then
    v_attempt_created := true;
  else
    select a.*
    into v_attempt
    from public.listing_realtor_manual_send_attempts as a
    where a.outreach_id = v_outreach.id
      and a.draft_revision = v_outreach.draft_revision;
  end if;

  if v_attempt.authorized_message_snapshot is distinct from
       v_outreach.draft_message then
    raise exception 'The existing authorization is not bound to the current draft.';
  end if;

  if v_attempt_created then
    insert into public.listing_realtor_outreach_audit_events (
      outreach_id,
      realtor_match_id_snapshot,
      canonical_listing_id,
      canonical_contact_id,
      actor_user_id_snapshot,
      event_type,
      event_at,
      new_values
    ) values (
      v_outreach.id,
      p_match_id,
      v_outreach.canonical_listing_id,
      v_outreach.canonical_contact_id,
      v_actor_id,
      'manual_send_authorized',
      v_attempt.authorized_at,
      pg_catalog.jsonb_build_object(
        'send_attempt_id', v_attempt.id,
        'draft_revision', v_attempt.draft_revision,
        'message_length', pg_catalog.length(v_attempt.authorized_message_snapshot),
        'message_md5', pg_catalog.md5(v_attempt.authorized_message_snapshot)
      )
    );
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'send_attempt_id', v_attempt.id,
    'outreach_id', v_attempt.outreach_id,
    'draft_revision', v_attempt.draft_revision,
    'authorized_message', v_attempt.authorized_message_snapshot,
    'authorized_at', v_attempt.authorized_at,
    'outreach_state', v_outreach.outreach_state
  );

  insert into public.listing_realtor_outreach_actions (
    actor_user_id_snapshot,
    idempotency_key,
    action_type,
    outreach_id,
    realtor_match_id_snapshot,
    canonical_listing_id,
    canonical_contact_id,
    request_fingerprint,
    result_snapshot
  ) values (
    v_actor_id,
    p_idempotency_key,
    'authorize_manual_send',
    v_outreach.id,
    p_match_id,
    v_outreach.canonical_listing_id,
    v_outreach.canonical_contact_id,
    v_request,
    v_result
  );

  return v_result;
end;
$function$;

revoke all
on function public.authorize_listing_realtor_manual_send(
  uuid, uuid, integer, uuid
)
from public, anon, authenticated, service_role;

grant execute
on function public.authorize_listing_realtor_manual_send(
  uuid, uuid, integer, uuid
)
to authenticated;

-- ============================================================
-- 10. CONFIRM THE EXACT AUTHORIZED EXTERNAL MANUAL SEND
-- ============================================================

create function public.confirm_listing_realtor_manual_send(
  p_send_attempt_id uuid,
  p_message text,
  p_reported_sent_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_attempt public.listing_realtor_manual_send_attempts%rowtype;
  v_outreach public.listing_realtor_initial_outreaches%rowtype;
  v_outreach_id uuid;
  v_listing record;
  v_request jsonb;
  v_existing record;
  v_result jsonb;
  v_now timestamptz;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_send_attempt_id is null
     or p_message is null
     or p_idempotency_key is null then
    raise exception 'Send attempt, exact message, and idempotency key are required.';
  end if;

  select a.outreach_id
  into v_outreach_id
  from public.listing_realtor_manual_send_attempts as a
  where a.id = p_send_attempt_id;

  if not found then
    raise exception 'The manual-send authorization was not found.';
  end if;

  select o.*
  into v_outreach
  from public.listing_realtor_initial_outreaches as o
  where o.id = v_outreach_id
  for update;

  if not found then
    raise exception 'The initial outreach for this authorization was not found.';
  end if;

  select a.*
  into v_attempt
  from public.listing_realtor_manual_send_attempts as a
  where a.id = p_send_attempt_id
    and a.outreach_id = v_outreach.id
  for update;

  if not found then
    raise exception 'The manual-send authorization changed during confirmation.';
  end if;

  select l.org_id, l.owner_user_id
  into v_listing
  from public.listings as l
  where l.id = v_attempt.canonical_listing_id
  for share;

  if not found
     or not public.marketing_can_manage_owned_record(
       v_listing.org_id,
       v_listing.owner_user_id
     ) then
    raise exception 'You cannot manage this listing.' using errcode = '42501';
  end if;

  v_request := pg_catalog.jsonb_build_object(
    'send_attempt_id', p_send_attempt_id,
    'message', p_message,
    'reported_sent_at', p_reported_sent_at
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select a.*
  into v_existing
  from public.listing_realtor_outreach_actions as a
  where a.actor_user_id_snapshot = v_actor_id
    and a.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.action_type <> 'confirm_manual_send'
       or v_existing.request_fingerprint <> v_request then
      raise exception 'Idempotency key was already used for a different request.';
    end if;
    return v_existing.result_snapshot;
  end if;

  if v_attempt.confirmed_at is not null then
    raise exception 'This manual-send authorization is already confirmed.';
  end if;

  if v_outreach.outreach_state <> 'drafted'
     or v_outreach.draft_revision <> v_attempt.draft_revision
     or v_outreach.draft_message is distinct from
        v_attempt.authorized_message_snapshot then
    raise exception 'The authorized draft is no longer the exact current draft.';
  end if;

  if p_message is distinct from v_attempt.authorized_message_snapshot then
    raise exception 'The confirmed message does not match the authorized message.';
  end if;

  v_now := pg_catalog.clock_timestamp();

  if p_reported_sent_at is not null
     and (
       p_reported_sent_at < v_attempt.authorized_at
       or p_reported_sent_at > v_now + interval '5 minutes'
     ) then
    raise exception 'Reported sent time is outside the authorized send window.';
  end if;

  update public.listing_realtor_manual_send_attempts
  set
    confirmed_at = v_now,
    reported_sent_at = p_reported_sent_at,
    confirmed_message_snapshot = p_message,
    confirmed_by_snapshot = v_actor_id
  where id = p_send_attempt_id
  returning * into v_attempt;

  update public.listing_realtor_initial_outreaches
  set
    outreach_state = 'manual_sent',
    confirmed_send_attempt_id = v_attempt.id,
    confirmed_message_snapshot = v_attempt.confirmed_message_snapshot,
    confirmed_sent_at = v_attempt.confirmed_at,
    reported_sent_at = v_attempt.reported_sent_at,
    confirmed_by_snapshot = v_attempt.confirmed_by_snapshot
  where id = v_attempt.outreach_id
  returning * into v_outreach;

  insert into public.listing_realtor_outreach_audit_events (
    outreach_id,
    realtor_match_id_snapshot,
    canonical_listing_id,
    canonical_contact_id,
    actor_user_id_snapshot,
    event_type,
    event_at,
    new_values
  ) values (
    v_outreach.id,
    v_attempt.realtor_match_id_snapshot,
    v_outreach.canonical_listing_id,
    v_outreach.canonical_contact_id,
    v_actor_id,
    'manual_send_confirmed',
    v_attempt.confirmed_at,
    pg_catalog.jsonb_build_object(
      'send_attempt_id', v_attempt.id,
      'draft_revision', v_attempt.draft_revision,
      'confirmed_sent_at', v_attempt.confirmed_at,
      'reported_sent_at', v_attempt.reported_sent_at,
      'message_length', pg_catalog.length(v_attempt.confirmed_message_snapshot),
      'message_md5', pg_catalog.md5(v_attempt.confirmed_message_snapshot)
    )
  );

  v_result := pg_catalog.jsonb_build_object(
    'send_attempt_id', v_attempt.id,
    'outreach_id', v_outreach.id,
    'outreach_state', v_outreach.outreach_state,
    'confirmed_sent_at', v_attempt.confirmed_at,
    'reported_sent_at', v_attempt.reported_sent_at
  );

  insert into public.listing_realtor_outreach_actions (
    actor_user_id_snapshot,
    idempotency_key,
    action_type,
    outreach_id,
    realtor_match_id_snapshot,
    canonical_listing_id,
    canonical_contact_id,
    request_fingerprint,
    result_snapshot
  ) values (
    v_actor_id,
    p_idempotency_key,
    'confirm_manual_send',
    v_outreach.id,
    v_attempt.realtor_match_id_snapshot,
    v_outreach.canonical_listing_id,
    v_outreach.canonical_contact_id,
    v_request,
    v_result
  );

  return v_result;
end;
$function$;

revoke all
on function public.confirm_listing_realtor_manual_send(
  uuid, text, timestamptz, uuid
)
from public, anon, authenticated, service_role;

grant execute
on function public.confirm_listing_realtor_manual_send(
  uuid, text, timestamptz, uuid
)
to authenticated;

-- ============================================================
-- 11. FINAL IN-TRANSACTION ASSERTIONS
-- ============================================================

do $phase_2_final_assertions$
declare
  v_bad_count bigint;
begin
  select pg_catalog.count(*)
  into v_bad_count
  from public.listing_realtor_matches
  where realtor_disposition <> 'review_required'
     or follow_up_at is not null
     or disposition_changed_at is not null
     or disposition_changed_by is not null;

  if v_bad_count <> 0 then
    raise exception 'Legacy installation invariant failed for % rows.', v_bad_count;
  end if;

  if pg_catalog.has_table_privilege(
       'anon',
       'public.listing_realtor_matches',
       'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'anon',
       'public.listing_realtor_matches',
       'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'anon',
       'public.listing_realtor_matches',
       'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'anon',
       'public.listing_realtor_matches',
       'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'anon',
       'public.listing_realtor_matches',
       'TRUNCATE'
     )
     or pg_catalog.has_table_privilege(
       'anon',
       'public.listing_realtor_matches',
       'TRIGGER'
     )
     or pg_catalog.has_table_privilege(
       'anon',
       'public.listing_realtor_matches',
       'REFERENCES'
     )
     or not pg_catalog.has_table_privilege(
       'authenticated',
       'public.listing_realtor_matches',
       'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'public.listing_realtor_matches',
       'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'public.listing_realtor_matches',
       'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'public.listing_realtor_matches',
       'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'public.listing_realtor_matches',
       'TRUNCATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'public.listing_realtor_matches',
       'TRIGGER'
     )
     or pg_catalog.has_table_privilege(
       'authenticated',
       'public.listing_realtor_matches',
       'REFERENCES'
     )
     or not pg_catalog.has_table_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'TRUNCATE'
     )
     or pg_catalog.has_table_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'TRIGGER'
     )
     or pg_catalog.has_table_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'REFERENCES'
     )
     or pg_catalog.has_column_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'realtor_disposition',
       'UPDATE'
     )
     or not pg_catalog.has_column_privilege(
       'service_role',
       'public.listing_realtor_matches',
       'source_payload',
       'UPDATE'
     ) then
    raise exception 'Column-level import privilege hardening failed.';
  end if;

  if not pg_catalog.has_function_privilege(
       'authenticated',
       'public.authorize_listing_realtor_manual_send(uuid,uuid,integer,uuid)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.authorize_listing_realtor_manual_send(uuid,uuid,integer,uuid)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'public.authorize_listing_realtor_manual_send(uuid,uuid,integer,uuid)',
       'EXECUTE'
     ) then
    raise exception 'Manual-send authorization function privileges are incorrect.';
  end if;
end;
$phase_2_final_assertions$;

-- Ask PostgREST to refresh only its schema cache after this transaction
-- commits. This does not invoke a provider or send user communication.
notify pgrst, 'reload schema';

commit;

-- END: no SQL in this file invokes a messaging provider or sends a message.
