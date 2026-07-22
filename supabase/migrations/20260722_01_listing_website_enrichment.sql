begin;

-- ============================================================
-- Listing website enrichment
-- Samantha drafts, agent review, approval, and map positioning.
-- ============================================================

create table public.listing_website_enrichment (
  id uuid primary key default gen_random_uuid(),

  listing_id uuid not null unique
    references public.listings(id)
    on delete cascade,

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'researching',
        'needs_review',
        'approved',
        'failed',
        'stale'
      )
    ),

  research_version integer not null default 1
    check (research_version > 0),

  input_hash text,

  map_center_lat numeric(10, 7),
  map_center_lng numeric(10, 7),

  map_zoom smallint not null default 12
    check (
      map_zoom between 1 and 20
    ),

  samantha_summary text,
  research_notes text,
  research_error text,
  generation_model text,

  source_last_refreshed_at timestamptz,
  researched_at timestamptz,

  approved_at timestamptz,

  approved_by uuid
    references auth.users(id)
    on delete set null,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint listing_website_enrichment_map_coordinates_check
    check (
      (
        map_center_lat is null
        and map_center_lng is null
      )
      or
      (
        map_center_lat between -90 and 90
        and map_center_lng between -180 and 180
      )
    ),

  constraint listing_website_enrichment_approval_check
    check (
      status <> 'approved'
      or (
        approved_at is not null
        and approved_by is not null
      )
    )
);

comment on table public.listing_website_enrichment is
  'Samantha-generated listing website research and agent approval state.';


-- ============================================================
-- Curated property highlights
-- ============================================================

create table public.listing_website_highlights (
  id uuid primary key default gen_random_uuid(),

  listing_id uuid not null
    references public.listings(id)
    on delete cascade,

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  photo_media_id uuid
    references public.listing_media(id)
    on delete set null,

  headline text not null,
  summary text not null,

  bullet_points text[] not null
    default '{}'::text[],

  source_facts jsonb not null
    default '[]'::jsonb,

  sort_order integer not null default 0
    check (sort_order >= 0),

  is_visible boolean not null default true,
  manual_override boolean not null default false,

  created_by uuid
    references auth.users(id)
    on delete set null,

  updated_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint listing_website_highlights_headline_check
    check (
      char_length(trim(headline))
      between 1 and 120
    ),

  constraint listing_website_highlights_summary_check
    check (
      char_length(trim(summary))
      between 1 and 600
    ),

  constraint listing_website_highlights_bullet_count_check
    check (
      cardinality(bullet_points)
      between 0 and 4
    ),

  constraint listing_website_highlights_source_facts_check
    check (
      jsonb_typeof(source_facts) = 'array'
    )
);

comment on table public.listing_website_highlights is
  'Curated photo-backed feature cards shown on approved property websites.';


-- ============================================================
-- Nearby destinations and travel times
-- ============================================================

create table public.listing_website_destinations (
  id uuid primary key default gen_random_uuid(),

  listing_id uuid not null
    references public.listings(id)
    on delete cascade,

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  destination_type text not null
    check (
      destination_type in (
        'warehouse_club',
        'grocery',
        'shopping',
        'park_recreation',
        'freeway_access',
        'downtown',
        'airport',
        'healthcare',
        'dining',
        'other'
      )
    ),

  name text not null,
  address text,

  google_place_id text,

  latitude numeric(10, 7),
  longitude numeric(10, 7),

  distance_meters integer
    check (
      distance_meters is null
      or distance_meters >= 0
    ),

  duration_seconds integer
    check (
      duration_seconds is null
      or duration_seconds >= 0
    ),

  distance_text text,
  duration_text text,

  google_maps_url text,
  website_url text,
  source_url text,

  source_data jsonb not null
    default '{}'::jsonb,

  sort_order integer not null default 0
    check (sort_order >= 0),

  is_visible boolean not null default true,
  manual_override boolean not null default false,

  verified_at timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null,

  updated_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint listing_website_destinations_name_check
    check (
      char_length(trim(name))
      between 1 and 180
    ),

  constraint listing_website_destinations_coordinates_check
    check (
      (
        latitude is null
        and longitude is null
      )
      or
      (
        latitude between -90 and 90
        and longitude between -180 and 180
      )
    ),

  constraint listing_website_destinations_source_data_check
    check (
      jsonb_typeof(source_data) = 'object'
    )
);

comment on table public.listing_website_destinations is
  'Nearby shopping, groceries, recreation, transportation, and other listing-relevant destinations.';


-- ============================================================
-- Nearby public, charter, and private schools
-- ============================================================

create table public.listing_website_schools (
  id uuid primary key default gen_random_uuid(),

  listing_id uuid not null
    references public.listings(id)
    on delete cascade,

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  school_type text not null
    check (
      school_type in (
        'public_district',
        'public_charter',
        'private'
      )
    ),

  relationship_basis text not null default 'nearby'
    check (
      relationship_basis in (
        'nearby',
        'listing_reported',
        'both'
      )
    ),

  name text not null,
  grades_text text,
  district_name text,
  address text,

  google_place_id text,

  latitude numeric(10, 7),
  longitude numeric(10, 7),

  distance_meters integer
    check (
      distance_meters is null
      or distance_meters >= 0
    ),

  duration_seconds integer
    check (
      duration_seconds is null
      or duration_seconds >= 0
    ),

  distance_text text,
  duration_text text,

  greatschools_url text,
  official_url text,
  google_maps_url text,
  source_url text,

  assignment_note text,

  source_data jsonb not null
    default '{}'::jsonb,

  sort_order integer not null default 0
    check (sort_order >= 0),

  is_visible boolean not null default true,
  manual_override boolean not null default false,

  verified_at timestamptz,

  created_by uuid
    references auth.users(id)
    on delete set null,

  updated_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint listing_website_schools_name_check
    check (
      char_length(trim(name))
      between 1 and 180
    ),

  constraint listing_website_schools_coordinates_check
    check (
      (
        latitude is null
        and longitude is null
      )
      or
      (
        latitude between -90 and 90
        and longitude between -180 and 180
      )
    ),

  constraint listing_website_schools_source_data_check
    check (
      jsonb_typeof(source_data) = 'object'
    )
);

comment on table public.listing_website_schools is
  'Nearby district public, public charter, and private schools with neutral factual links and travel information.';


-- ============================================================
-- Research source log
-- ============================================================

create table public.listing_website_sources (
  id uuid primary key default gen_random_uuid(),

  listing_id uuid not null
    references public.listings(id)
    on delete cascade,

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  source_type text not null
    check (
      source_type in (
        'listing_record',
        'listing_document',
        'listing_media',
        'google_places',
        'google_routes',
        'greatschools',
        'official_school',
        'official_district',
        'manual',
        'other'
      )
    ),

  source_label text not null,
  source_url text,
  source_identifier text,

  verification_status text not null default 'unverified'
    check (
      verification_status in (
        'unverified',
        'verified',
        'unavailable',
        'manual_review'
      )
    ),

  source_metadata jsonb not null
    default '{}'::jsonb,

  retrieved_at timestamptz not null default now(),

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  constraint listing_website_sources_label_check
    check (
      char_length(trim(source_label))
      between 1 and 240
    ),

  constraint listing_website_sources_metadata_check
    check (
      jsonb_typeof(source_metadata) = 'object'
    )
);

comment on table public.listing_website_sources is
  'Source and verification log supporting Samantha listing website research.';


-- ============================================================
-- Ownership synchronization
-- Prevent org or owner spoofing in child records.
-- ============================================================

create or replace function public.sync_listing_website_record_ownership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_org_id uuid;
  selected_owner_user_id uuid;
begin
  select
    listings.org_id,
    listings.owner_user_id
  into
    selected_org_id,
    selected_owner_user_id
  from public.listings
  where listings.id = new.listing_id;

  if not found then
    raise exception
      'The selected listing does not exist.';
  end if;

  if selected_owner_user_id is null then
    raise exception
      'The listing must have an assigned owner before website research can be saved.';
  end if;

  new.org_id :=
    selected_org_id;

  new.owner_user_id :=
    selected_owner_user_id;

  return new;
end;
$$;


-- ============================================================
-- Shared updated_at trigger
-- ============================================================

create or replace function public.set_listing_website_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at :=
    now();

  return new;
end;
$$;


-- ============================================================
-- Ownership triggers
-- ============================================================

create trigger listing_website_enrichment_sync_ownership
before insert or update of listing_id
on public.listing_website_enrichment
for each row
execute function public.sync_listing_website_record_ownership();

create trigger listing_website_highlights_sync_ownership
before insert or update of listing_id
on public.listing_website_highlights
for each row
execute function public.sync_listing_website_record_ownership();

create trigger listing_website_destinations_sync_ownership
before insert or update of listing_id
on public.listing_website_destinations
for each row
execute function public.sync_listing_website_record_ownership();

create trigger listing_website_schools_sync_ownership
before insert or update of listing_id
on public.listing_website_schools
for each row
execute function public.sync_listing_website_record_ownership();

create trigger listing_website_sources_sync_ownership
before insert or update of listing_id
on public.listing_website_sources
for each row
execute function public.sync_listing_website_record_ownership();


-- ============================================================
-- updated_at triggers
-- ============================================================

create trigger listing_website_enrichment_set_updated_at
before update
on public.listing_website_enrichment
for each row
execute function public.set_listing_website_updated_at();

create trigger listing_website_highlights_set_updated_at
before update
on public.listing_website_highlights
for each row
execute function public.set_listing_website_updated_at();

create trigger listing_website_destinations_set_updated_at
before update
on public.listing_website_destinations
for each row
execute function public.set_listing_website_updated_at();

create trigger listing_website_schools_set_updated_at
before update
on public.listing_website_schools
for each row
execute function public.set_listing_website_updated_at();


-- ============================================================
-- Indexes
-- ============================================================

create index listing_website_enrichment_status_idx
  on public.listing_website_enrichment (
    listing_id,
    status
  );

create index listing_website_highlights_listing_sort_idx
  on public.listing_website_highlights (
    listing_id,
    is_visible,
    sort_order
  );

create index listing_website_destinations_listing_sort_idx
  on public.listing_website_destinations (
    listing_id,
    is_visible,
    destination_type,
    sort_order
  );

create index listing_website_schools_listing_sort_idx
  on public.listing_website_schools (
    listing_id,
    is_visible,
    school_type,
    sort_order
  );

create index listing_website_sources_listing_idx
  on public.listing_website_sources (
    listing_id,
    source_type,
    retrieved_at desc
  );

create unique index listing_website_destinations_place_unique
  on public.listing_website_destinations (
    listing_id,
    google_place_id
  )
  where google_place_id is not null;


-- ============================================================
-- Row-level security
-- Reuse the established marketing ownership policy.
-- ============================================================

alter table public.listing_website_enrichment
  enable row level security;

alter table public.listing_website_highlights
  enable row level security;

alter table public.listing_website_destinations
  enable row level security;

alter table public.listing_website_schools
  enable row level security;

alter table public.listing_website_sources
  enable row level security;


create policy listing_website_enrichment_select
on public.listing_website_enrichment
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_website_enrichment_insert
on public.listing_website_enrichment
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_website_enrichment_update
on public.listing_website_enrichment
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

create policy listing_website_enrichment_delete
on public.listing_website_enrichment
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);


create policy listing_website_highlights_select
on public.listing_website_highlights
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_website_highlights_insert
on public.listing_website_highlights
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_website_highlights_update
on public.listing_website_highlights
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

create policy listing_website_highlights_delete
on public.listing_website_highlights
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);


create policy listing_website_destinations_select
on public.listing_website_destinations
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_website_destinations_insert
on public.listing_website_destinations
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_website_destinations_update
on public.listing_website_destinations
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

create policy listing_website_destinations_delete
on public.listing_website_destinations
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);


create policy listing_website_schools_select
on public.listing_website_schools
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_website_schools_insert
on public.listing_website_schools
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_website_schools_update
on public.listing_website_schools
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

create policy listing_website_schools_delete
on public.listing_website_schools
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);


create policy listing_website_sources_select
on public.listing_website_sources
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_website_sources_insert
on public.listing_website_sources
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_website_sources_update
on public.listing_website_sources
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

create policy listing_website_sources_delete
on public.listing_website_sources
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);


-- ============================================================
-- Privileges
-- No anonymous direct access. Public pages load through the
-- protected server-side property page.
-- ============================================================

revoke all
on public.listing_website_enrichment
from anon;

revoke all
on public.listing_website_highlights
from anon;

revoke all
on public.listing_website_destinations
from anon;

revoke all
on public.listing_website_schools
from anon;

revoke all
on public.listing_website_sources
from anon;


grant select, insert, update, delete
on public.listing_website_enrichment
to authenticated;

grant select, insert, update, delete
on public.listing_website_highlights
to authenticated;

grant select, insert, update, delete
on public.listing_website_destinations
to authenticated;

grant select, insert, update, delete
on public.listing_website_schools
to authenticated;

grant select, insert, update, delete
on public.listing_website_sources
to authenticated;


grant all
on public.listing_website_enrichment
to service_role;

grant all
on public.listing_website_highlights
to service_role;

grant all
on public.listing_website_destinations
to service_role;

grant all
on public.listing_website_schools
to service_role;

grant all
on public.listing_website_sources
to service_role;

commit;
