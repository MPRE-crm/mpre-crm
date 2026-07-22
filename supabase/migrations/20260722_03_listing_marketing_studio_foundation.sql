begin;

create table public.listing_marketing_sections (
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

  section_key text not null
    check (
      section_key in (
        'property_website',
        'email',
        'social',
        'flyer',
        'video',
        'seller_report'
      )
    ),

  status text not null
    default 'not_prepared'
    check (
      status in (
        'not_prepared',
        'preparing',
        'needs_review',
        'approved',
        'needs_refresh',
        'failed'
      )
    ),

  template_key text not null,

  template_locked boolean not null
    default false,

  content jsonb not null
    default '{}'::jsonb,

  manual_override boolean not null
    default false,

  generation_version integer not null
    default 0
    check (
      generation_version >= 0
    ),

  generation_model text,
  input_hash text,

  prepared_at timestamptz,
  approved_at timestamptz,

  approved_by uuid
    references auth.users(id)
    on delete set null,

  last_error text,

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

  constraint listing_marketing_sections_unique
    unique (
      listing_id,
      section_key
    ),

  constraint listing_marketing_sections_template_check
    check (
      char_length(
        trim(template_key)
      )
      between 1 and 100
    ),

  constraint listing_marketing_sections_content_check
    check (
      jsonb_typeof(content) =
      'object'
    )
);

comment on table public.listing_marketing_sections is
  'Prepared, editable and approvable marketing sections for each listing.';


create table public.listing_marketing_photo_assignments (
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

  section_key text not null
    check (
      section_key in (
        'property_website',
        'email',
        'social',
        'flyer',
        'video',
        'seller_report'
      )
    ),

  slot_key text not null,

  sort_order integer not null
    default 0
    check (
      sort_order >= 0
    ),

  media_id uuid not null
    references public.listing_media(id)
    on delete cascade,

  selected_by text not null
    default 'samantha'
    check (
      selected_by in (
        'samantha',
        'agent'
      )
    ),

  is_locked boolean not null
    default false,

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

  constraint listing_marketing_photo_assignments_unique
    unique (
      listing_id,
      section_key,
      slot_key,
      sort_order
    ),

  constraint listing_marketing_photo_assignments_slot_check
    check (
      char_length(
        trim(slot_key)
      )
      between 1 and 100
    )
);

comment on table public.listing_marketing_photo_assignments is
  'Photo choices for website, email, social, flyer, video and seller-report slots.';


create index listing_marketing_sections_listing_status_idx
  on public.listing_marketing_sections (
    listing_id,
    status
  );

create index listing_marketing_photo_assignments_listing_section_idx
  on public.listing_marketing_photo_assignments (
    listing_id,
    section_key,
    sort_order
  );

create index listing_marketing_photo_assignments_media_idx
  on public.listing_marketing_photo_assignments (
    media_id
  );


create trigger listing_marketing_sections_sync_ownership
before insert or update of
  listing_id,
  org_id,
  owner_user_id
on public.listing_marketing_sections
for each row
execute function public.sync_listing_website_record_ownership();


create trigger listing_marketing_photo_assignments_sync_ownership
before insert or update of
  listing_id,
  org_id,
  owner_user_id
on public.listing_marketing_photo_assignments
for each row
execute function public.sync_listing_website_record_ownership();


create trigger listing_marketing_sections_updated_at
before update
on public.listing_marketing_sections
for each row
execute function public.set_listing_website_updated_at();


create trigger listing_marketing_photo_assignments_updated_at
before update
on public.listing_marketing_photo_assignments
for each row
execute function public.set_listing_website_updated_at();


alter table public.listing_marketing_sections
  enable row level security;

alter table public.listing_marketing_photo_assignments
  enable row level security;


create policy listing_marketing_sections_select
on public.listing_marketing_sections
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_marketing_sections_insert
on public.listing_marketing_sections
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_marketing_sections_update
on public.listing_marketing_sections
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

create policy listing_marketing_sections_delete
on public.listing_marketing_sections
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);


create policy listing_marketing_photo_assignments_select
on public.listing_marketing_photo_assignments
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_marketing_photo_assignments_insert
on public.listing_marketing_photo_assignments
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy listing_marketing_photo_assignments_update
on public.listing_marketing_photo_assignments
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

create policy listing_marketing_photo_assignments_delete
on public.listing_marketing_photo_assignments
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);


revoke all
on public.listing_marketing_sections
from anon;

revoke all
on public.listing_marketing_photo_assignments
from anon;

grant
  select,
  insert,
  update,
  delete
on public.listing_marketing_sections
to authenticated;

grant
  select,
  insert,
  update,
  delete
on public.listing_marketing_photo_assignments
to authenticated;

grant all
on public.listing_marketing_sections
to service_role;

grant all
on public.listing_marketing_photo_assignments
to service_role;

commit;
