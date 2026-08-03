-- PROPERTY WEBSITE MEDIA ENGAGEMENT
-- PHASE 1 â€” DATABASE CAPTURE FOUNDATION
--
-- Source-control copy of the migration applied manually and
-- verified on 2026-08-02.
--
-- This migration is not intended to be rerun against the
-- current database.

begin;


-- ============================================================
-- PREFLIGHT
-- ============================================================

do $preflight$
begin
  if to_regclass(
    'public.listing_website_engagement_events'
  ) is not null then
    raise exception
      'Preflight failed: public.listing_website_engagement_events already exists.';
  end if;

  if to_regprocedure(
    'public.sync_listing_website_record_ownership()'
  ) is null then
    raise exception
      'Preflight failed: public.sync_listing_website_record_ownership() was not found.';
  end if;

  if to_regprocedure(
    'public.marketing_can_manage_owned_record(uuid,uuid)'
  ) is null then
    raise exception
      'Preflight failed: public.marketing_can_manage_owned_record(uuid, uuid) was not found.';
  end if;
end;
$preflight$;


-- ============================================================
-- APPEND-ONLY EVENT TABLE
-- ============================================================

create table
  public.listing_website_engagement_events
(
  id bigint
    generated always as identity
    primary key,

  client_event_id uuid
    not null,

  listing_id uuid
    not null
    references public.listings(id)
    on delete cascade,

  org_id uuid
    not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid
    references auth.users(id)
    on delete set null,

  event_type text
    not null,

  event_context text
    not null
    default 'public',

  event_at timestamptz
    not null
    default now(),

  page_path text
    not null,

  marketing_source text,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,

  referrer_host text,

  device_category text
    not null
    default 'unknown',

  city text,
  region text,
  country_code text,

  is_probable_bot boolean
    not null
    default false,

  anonymous_visitor_hash text,
  anonymous_session_hash text,

  media_provider text,
  media_resource_key text,

  progress_percent smallint,

  event_metadata jsonb
    not null
    default '{}'::jsonb,

  constraint
    listing_website_engagement_client_event_unique
    unique (client_event_id),

  constraint
    listing_website_engagement_event_type_check
    check (
      event_type in (
        'page_view',
        'video_play',
        'video_progress_25',
        'video_progress_50',
        'video_progress_75',
        'video_complete',
        'video_external_click',
        'virtual_tour_click',
        'showing_request_click',
        'phone_click',
        'email_click'
      )
    ),

  constraint
    listing_website_engagement_context_check
    check (
      event_context in (
        'public',
        'internal_test'
      )
    ),

  constraint
    listing_website_engagement_page_path_check
    check (
      char_length(
        trim(page_path)
      ) between 10 and 500

      and trim(page_path) ~
        '^/property/[A-Za-z0-9][A-Za-z0-9_-]*$'
    ),

  constraint
    listing_website_engagement_source_check
    check (
      marketing_source is null

      or (
        char_length(
          trim(marketing_source)
        ) between 1 and 80

        and marketing_source =
          lower(
            trim(marketing_source)
          )

        and marketing_source ~
          '^[a-z0-9]+([_-][a-z0-9]+)*$'
      )
    ),

  constraint
    listing_website_engagement_utm_source_check
    check (
      utm_source is null

      or char_length(
        trim(utm_source)
      ) between 1 and 160
    ),

  constraint
    listing_website_engagement_utm_medium_check
    check (
      utm_medium is null

      or char_length(
        trim(utm_medium)
      ) between 1 and 160
    ),

  constraint
    listing_website_engagement_utm_campaign_check
    check (
      utm_campaign is null

      or char_length(
        trim(utm_campaign)
      ) between 1 and 200
    ),

  constraint
    listing_website_engagement_utm_content_check
    check (
      utm_content is null

      or char_length(
        trim(utm_content)
      ) between 1 and 200
    ),

  constraint
    listing_website_engagement_referrer_check
    check (
      referrer_host is null

      or char_length(
        trim(referrer_host)
      ) between 1 and 255
    ),

  constraint
    listing_website_engagement_device_check
    check (
      device_category in (
        'mobile',
        'tablet',
        'desktop',
        'other',
        'unknown'
      )
    ),

  constraint
    listing_website_engagement_city_check
    check (
      city is null

      or char_length(
        trim(city)
      ) between 1 and 120
    ),

  constraint
    listing_website_engagement_region_check
    check (
      region is null

      or char_length(
        trim(region)
      ) between 1 and 120
    ),

  constraint
    listing_website_engagement_country_check
    check (
      country_code is null

      or (
        country_code =
          upper(country_code)

        and country_code ~
          '^[A-Z]{2}$'
      )
    ),

  constraint
    listing_website_engagement_visitor_hash_check
    check (
      anonymous_visitor_hash is null

      or anonymous_visitor_hash ~
        '^[0-9a-f]{64}$'
    ),

  constraint
    listing_website_engagement_session_hash_check
    check (
      anonymous_session_hash is null

      or anonymous_session_hash ~
        '^[0-9a-f]{64}$'
    ),

  constraint
    listing_website_engagement_media_provider_check
    check (
      media_provider is null

      or (
        char_length(
          trim(media_provider)
        ) between 1 and 40

        and media_provider =
          lower(
            trim(media_provider)
          )

        and media_provider ~
          '^[a-z0-9]+([_-][a-z0-9]+)*$'
      )
    ),

  constraint
    listing_website_engagement_media_key_check
    check (
      media_resource_key is null

      or char_length(
        trim(media_resource_key)
      ) between 1 and 240
    ),

  constraint
    listing_website_engagement_progress_check
    check (
      (
        event_type =
          'video_progress_25'

        and progress_percent =
          25
      )

      or (
        event_type =
          'video_progress_50'

        and progress_percent =
          50
      )

      or (
        event_type =
          'video_progress_75'

        and progress_percent =
          75
      )

      or (
        event_type =
          'video_complete'

        and progress_percent =
          100
      )

      or (
        event_type not in (
          'video_progress_25',
          'video_progress_50',
          'video_progress_75',
          'video_complete'
        )

        and progress_percent is null
      )
    ),

  constraint
    listing_website_engagement_metadata_check
    check (
      jsonb_typeof(
        event_metadata
      ) = 'object'

      and octet_length(
        event_metadata::text
      ) <= 4096
    )
);


comment on table
  public.listing_website_engagement_events
is
  'Append-only, privacy-safe engagement events from published property websites. Public browsers submit through a validated server route; authenticated listing owners and administrators may read authorized records.';


comment on column
  public.listing_website_engagement_events
    .anonymous_visitor_hash
is
  'Server-generated SHA-256 hash of an anonymous browser identifier. The raw identifier and raw IP address are never stored.';


comment on column
  public.listing_website_engagement_events
    .anonymous_session_hash
is
  'Server-generated SHA-256 hash of the anonymous browser session identifier. The raw session identifier is never stored.';


comment on column
  public.listing_website_engagement_events
    .client_event_id
is
  'Client-generated UUID used to make event submission idempotent during retries.';


-- ============================================================
-- OWNERSHIP SYNCHRONIZATION
-- ============================================================

create trigger
  listing_website_engagement_sync_ownership

before insert
on public.listing_website_engagement_events

for each row

execute function
  public.sync_listing_website_record_ownership();


-- ============================================================
-- REPORTING INDEXES
-- ============================================================

create index
  listing_website_engagement_listing_time_idx

on public.listing_website_engagement_events
  (
    listing_id,
    event_at desc
  );


create index
  listing_website_engagement_listing_type_time_idx

on public.listing_website_engagement_events
  (
    listing_id,
    event_type,
    event_at desc
  )

where event_context =
      'public'

  and not is_probable_bot;


create index
  listing_website_engagement_visitor_time_idx

on public.listing_website_engagement_events
  (
    listing_id,
    anonymous_visitor_hash,
    event_at desc
  )

where anonymous_visitor_hash
      is not null

  and event_context =
      'public'

  and not is_probable_bot;


create index
  listing_website_engagement_session_time_idx

on public.listing_website_engagement_events
  (
    listing_id,
    anonymous_session_hash,
    event_at desc
  )

where anonymous_session_hash
      is not null

  and event_context =
      'public'

  and not is_probable_bot;


create index
  listing_website_engagement_source_time_idx

on public.listing_website_engagement_events
  (
    listing_id,
    marketing_source,
    event_at desc
  )

where marketing_source
      is not null

  and event_context =
      'public'

  and not is_probable_bot;


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table
  public.listing_website_engagement_events
enable row level security;


create policy
  listing_website_engagement_select

on public.listing_website_engagement_events

for select

to authenticated

using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);


-- No anonymous or authenticated browser inserts are allowed.
-- The future server route will use the protected service role.

revoke all
on table
  public.listing_website_engagement_events
from
  anon,
  authenticated;


grant select
on table
  public.listing_website_engagement_events
to authenticated;


revoke all
on sequence
  public.listing_website_engagement_events_id_seq
from
  anon,
  authenticated;


commit;