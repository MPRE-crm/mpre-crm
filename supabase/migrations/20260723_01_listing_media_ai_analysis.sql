begin;

create table public.listing_media_ai_analysis (
  id uuid primary key
    default gen_random_uuid(),

  listing_id uuid not null
    references public.listings(id)
    on delete cascade,

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  owner_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  media_id uuid not null
    references public.listing_media(id)
    on delete cascade,

  analysis_status text not null
    default 'complete'
    check (
      analysis_status in (
        'complete',
        'failed',
        'needs_review'
      )
    ),

  primary_category text not null
    default 'other'
    check (
      primary_category in (
        'front_exterior',
        'exterior',
        'kitchen',
        'living_room',
        'dining_room',
        'primary_bedroom',
        'bedroom',
        'primary_bathroom',
        'bathroom',
        'office',
        'bonus_room',
        'hallway',
        'foyer',
        'laundry',
        'garage',
        'shop',
        'backyard',
        'patio',
        'view',
        'pool',
        'community',
        'detail',
        'floor_plan',
        'other'
      )
    ),

  room_label text,

  feature_tags text[] not null
    default '{}'::text[],

  quality_score smallint not null
    default 0
    check (
      quality_score between 0 and 100
    ),

  marketing_score smallint not null
    default 0
    check (
      marketing_score between 0 and 100
    ),

  confidence numeric(5,4) not null
    default 0
    check (
      confidence between 0 and 1
    ),

  is_usable boolean not null
    default true,

  rejection_reason text,

  duplicate_group text,

  visual_summary text,

  source_url text,

  analysis_payload jsonb not null
    default '{}'::jsonb
    check (
      jsonb_typeof(analysis_payload) =
      'object'
    ),

  analysis_model text not null,

  analysis_version integer not null
    default 1
    check (
      analysis_version >= 1
    ),

  analyzed_at timestamptz not null
    default now(),

  created_by uuid
    references auth.users(id)
    on delete set null,

  updated_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint listing_media_ai_analysis_media_unique
    unique (media_id)
);

comment on table public.listing_media_ai_analysis is
  'Reusable Samantha visual classifications and marketing scores for listing photographs.';

create index listing_media_ai_analysis_listing_idx
  on public.listing_media_ai_analysis (
    listing_id,
    primary_category,
    marketing_score desc
  );

create index listing_media_ai_analysis_media_idx
  on public.listing_media_ai_analysis (
    media_id
  );

create index listing_media_ai_analysis_duplicate_idx
  on public.listing_media_ai_analysis (
    listing_id,
    duplicate_group
  )
  where duplicate_group is not null;

create trigger listing_media_ai_analysis_sync_ownership
before insert or update of
  listing_id,
  org_id,
  owner_user_id
on public.listing_media_ai_analysis
for each row
execute function public.sync_listing_website_record_ownership();

create trigger listing_media_ai_analysis_updated_at
before update
on public.listing_media_ai_analysis
for each row
execute function public.set_listing_website_updated_at();

alter table public.listing_media_ai_analysis
  enable row level security;

create policy listing_media_ai_analysis_select
on public.listing_media_ai_analysis
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_media_ai_analysis_insert
on public.listing_media_ai_analysis
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_media_ai_analysis_update
on public.listing_media_ai_analysis
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

create policy listing_media_ai_analysis_delete
on public.listing_media_ai_analysis
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

revoke all
on public.listing_media_ai_analysis
from anon;

grant
  select,
  insert,
  update,
  delete
on public.listing_media_ai_analysis
to authenticated;

grant all
on public.listing_media_ai_analysis
to service_role;

commit;