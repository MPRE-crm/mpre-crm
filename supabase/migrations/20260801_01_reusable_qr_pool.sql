-- REUSABLE QR POOL PHASE 1
-- Database foundation:
-- - 50 reusable QR codes per organization
-- - Assignment and release history
-- - Scan tracking by listing assignment
-- - Seller-report scan metrics
-- - Automatic release when a listing is sold, withdrawn, expired, cancelled, or deleted
-- - No visitor identity or personal data stored

begin;

create table public.reusable_qr_codes (
  id uuid primary key
    default gen_random_uuid(),

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  code_number smallint not null,

  public_token text not null,

  is_enabled boolean not null
    default true,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint reusable_qr_codes_number_check
    check (
      code_number between 1 and 50
    ),

  constraint reusable_qr_codes_token_check
    check (
      char_length(public_token)
        between 5 and 140
      and public_token =
        lower(public_token)
      and public_token ~
        '^[a-z0-9]+(-[a-z0-9]+)*-[0-9]{3}$'
    ),

  constraint reusable_qr_codes_org_number_key
    unique (
      org_id,
      code_number
    ),

  constraint reusable_qr_codes_public_token_key
    unique (
      public_token
    )
);

create table public.reusable_qr_assignments (
  id uuid primary key
    default gen_random_uuid(),

  qr_code_id uuid not null
    references public.reusable_qr_codes(id)
    on delete restrict,

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  listing_id uuid
    references public.listings(id)
    on delete set null,

  owner_user_id uuid not null
    references auth.users(id)
    on delete restrict,

  destination_mode text not null
    default 'property_website',

  manual_destination_url text,

  listing_title_snapshot text not null,

  listing_address_snapshot text not null,

  assigned_at timestamptz not null
    default now(),

  assigned_by uuid
    references auth.users(id)
    on delete set null,

  released_at timestamptz,

  released_by uuid
    references auth.users(id)
    on delete set null,

  release_reason text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint reusable_qr_assignments_mode_check
    check (
      destination_mode in (
        'property_website',
        'manual'
      )
    ),

  constraint reusable_qr_assignments_manual_url_check
    check (
      manual_destination_url is null
      or (
        char_length(
          trim(manual_destination_url)
        ) between 8 and 2000
        and trim(manual_destination_url)
          ~* '^https://[^[:space:]]+$'
      )
    ),

  constraint reusable_qr_assignments_destination_check
    check (
      (
        destination_mode =
          'property_website'
        and manual_destination_url is null
      )
      or
      (
        destination_mode =
          'manual'
        and manual_destination_url is not null
      )
    ),

  constraint reusable_qr_assignments_active_listing_check
    check (
      listing_id is not null
      or released_at is not null
    ),

  constraint reusable_qr_assignments_release_time_check
    check (
      released_at is null
      or released_at >= assigned_at
    ),

  constraint reusable_qr_assignments_reason_check
    check (
      release_reason is null
      or char_length(
        trim(release_reason)
      ) between 1 and 240
    )
);

create table public.reusable_qr_scan_events (
  id bigint generated always as identity
    primary key,

  qr_code_id uuid not null
    references public.reusable_qr_codes(id)
    on delete restrict,

  assignment_id uuid
    references public.reusable_qr_assignments(id)
    on delete restrict,

  org_id uuid not null
    references public.organizations(id)
    on delete cascade,

  listing_id uuid
    references public.listings(id)
    on delete set null,

  owner_user_id uuid
    references auth.users(id)
    on delete set null,

  scanned_at timestamptz not null
    default now(),

  scan_context text not null
    default 'public',

  resolved_destination_url text,

  constraint reusable_qr_scan_events_context_check
    check (
      scan_context in (
        'public',
        'internal_test'
      )
    ),

  constraint reusable_qr_scan_events_url_check
    check (
      resolved_destination_url is null
      or char_length(
        trim(resolved_destination_url)
      ) between 1 and 2000
    )
);

create unique index reusable_qr_active_code_unique
  on public.reusable_qr_assignments (
    qr_code_id
  )
  where released_at is null;

create unique index reusable_qr_active_listing_unique
  on public.reusable_qr_assignments (
    listing_id
  )
  where released_at is null;

create index reusable_qr_codes_org_number_idx
  on public.reusable_qr_codes (
    org_id,
    code_number
  );

create index reusable_qr_assignments_listing_history_idx
  on public.reusable_qr_assignments (
    listing_id,
    assigned_at desc
  );

create index reusable_qr_assignments_org_active_idx
  on public.reusable_qr_assignments (
    org_id,
    released_at,
    assigned_at desc
  );

create index reusable_qr_scan_assignment_time_idx
  on public.reusable_qr_scan_events (
    assignment_id,
    scanned_at desc
  );

create index reusable_qr_scan_listing_time_idx
  on public.reusable_qr_scan_events (
    listing_id,
    scanned_at desc
  );

create index reusable_qr_scan_code_time_idx
  on public.reusable_qr_scan_events (
    qr_code_id,
    scanned_at desc
  );

create or replace function public.set_reusable_qr_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger reusable_qr_codes_updated_at
before update
on public.reusable_qr_codes
for each row
execute function
  public.set_reusable_qr_updated_at();

create trigger reusable_qr_assignments_updated_at
before update
on public.reusable_qr_assignments
for each row
execute function
  public.set_reusable_qr_updated_at();

create or replace function public.ensure_reusable_qr_pool(
  target_org_id uuid
)
returns integer
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  base_token text;
  inserted_count integer;
begin
  select
    left(
      trim(
        both '-'
        from lower(
          regexp_replace(
            coalesce(
              nullif(
                trim(organizations.slug),
                ''
              ),
              'org-' ||
                left(
                  organizations.id::text,
                  8
                )
            ),
            '[^a-z0-9]+',
            '-',
            'g'
          )
        )
      ),
      120
    )
  into base_token
  from public.organizations
  where organizations.id =
    target_org_id;

  if not found then
    raise exception
      'The selected organization does not exist.';
  end if;

  if base_token is null
     or base_token = '' then
    base_token :=
      'org-' ||
      left(
        target_org_id::text,
        8
      );
  end if;

  insert into public.reusable_qr_codes (
    org_id,
    code_number,
    public_token
  )
  select
    target_org_id,
    generated_number,
    base_token ||
      '-' ||
      lpad(
        generated_number::text,
        3,
        '0'
      )
  from generate_series(
    1,
    50
  ) as generated_number
  on conflict (
    org_id,
    code_number
  )
  do nothing;

  get diagnostics
    inserted_count = row_count;

  return inserted_count;
end;
$function$;

revoke all
on function public.ensure_reusable_qr_pool(uuid)
from public;

create or replace function public.seed_reusable_qr_pool_after_org_insert()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
begin
  perform
    public.ensure_reusable_qr_pool(
      new.id
    );

  return new;
end;
$function$;

create trigger organizations_seed_reusable_qr_pool
after insert
on public.organizations
for each row
execute function
  public.seed_reusable_qr_pool_after_org_insert();

do $block$
declare
  selected_org record;
begin
  for selected_org in
    select organizations.id
    from public.organizations
  loop
    perform
      public.ensure_reusable_qr_pool(
        selected_org.id
      );
  end loop;
end;
$block$;

create or replace function public.sync_reusable_qr_assignment_ownership()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  selected_listing record;
  selected_code record;
begin
  if new.listing_id is null then
    if new.released_at is null then
      raise exception
        'An active QR assignment must reference a listing.';
    end if;

    return new;
  end if;

  select
    listings.org_id,
    listings.owner_user_id,
    listings.title,
    listings.property_address
  into selected_listing
  from public.listings
  where listings.id =
    new.listing_id;

  if not found then
    raise exception
      'The selected listing does not exist.';
  end if;

  if selected_listing.owner_user_id
     is null then
    raise exception
      'The selected listing must have an assigned owner.';
  end if;

  select
    reusable_qr_codes.org_id
  into selected_code
  from public.reusable_qr_codes
  where reusable_qr_codes.id =
    new.qr_code_id;

  if not found then
    raise exception
      'The selected reusable QR code does not exist.';
  end if;

  if selected_code.org_id <>
     selected_listing.org_id then
    raise exception
      'The QR code and listing must belong to the same organization.';
  end if;

  new.org_id :=
    selected_listing.org_id;

  new.owner_user_id :=
    selected_listing.owner_user_id;

  new.listing_title_snapshot :=
    coalesce(
      nullif(
        trim(
          selected_listing.title
        ),
        ''
      ),
      selected_listing.property_address
    );

  new.listing_address_snapshot :=
    selected_listing.property_address;

  return new;
end;
$function$;

create trigger reusable_qr_assignments_sync_ownership
before insert or update of
  qr_code_id,
  listing_id,
  org_id,
  owner_user_id,
  listing_title_snapshot,
  listing_address_snapshot
on public.reusable_qr_assignments
for each row
execute function
  public.sync_reusable_qr_assignment_ownership();

create or replace function public.auto_release_reusable_qr_for_listing_status()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
begin
  if new.listing_status in (
    'sold',
    'withdrawn',
    'expired',
    'cancelled'
  )
  and new.listing_status is distinct from
      old.listing_status then

    update public.reusable_qr_assignments
    set
      released_at =
        coalesce(
          released_at,
          now()
        ),
      release_reason =
        coalesce(
          release_reason,
          'Listing status changed to ' ||
            new.listing_status
        )
    where listing_id =
      new.id
      and released_at is null;
  end if;

  return new;
end;
$function$;

create trigger listings_auto_release_reusable_qr
after update of listing_status
on public.listings
for each row
execute function
  public.auto_release_reusable_qr_for_listing_status();

create or replace function public.auto_release_reusable_qr_before_listing_delete()
returns trigger
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
begin
  update public.reusable_qr_assignments
  set
    released_at =
      coalesce(
        released_at,
        now()
      ),
    release_reason =
      coalesce(
        release_reason,
        'Listing deleted'
      )
  where listing_id =
    old.id
    and released_at is null;

  return old;
end;
$function$;

create trigger listings_release_reusable_qr_before_delete
before delete
on public.listings
for each row
execute function
  public.auto_release_reusable_qr_before_listing_delete();

alter table public.reusable_qr_codes
  enable row level security;

alter table public.reusable_qr_assignments
  enable row level security;

alter table public.reusable_qr_scan_events
  enable row level security;

create policy reusable_qr_codes_select
on public.reusable_qr_codes
for select
to authenticated
using (
  public.is_platform_admin()
  or org_id =
    public.current_org()
);

create policy reusable_qr_assignments_select
on public.reusable_qr_assignments
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

create policy reusable_qr_scan_events_select
on public.reusable_qr_scan_events
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_org_admin(
    org_id
  )
  or owner_user_id =
    auth.uid()
);

grant select
on public.reusable_qr_codes
to authenticated;

grant select
on public.reusable_qr_assignments
to authenticated;

grant select
on public.reusable_qr_scan_events
to authenticated;

grant select, insert, update, delete
on public.reusable_qr_codes
to service_role;

grant select, insert, update, delete
on public.reusable_qr_assignments
to service_role;

grant select, insert, update, delete
on public.reusable_qr_scan_events
to service_role;

grant usage, select
on sequence
  public.reusable_qr_scan_events_id_seq
to service_role;

create or replace function public.assign_reusable_qr_code(
  p_listing_id uuid,
  p_qr_code_id uuid default null,
  p_destination_mode text
    default 'property_website',
  p_manual_destination_url text
    default null
)
returns public.reusable_qr_assignments
language plpgsql
security definer
set search_path to
  'public',
  'auth',
  'pg_temp'
as $function$
declare
  selected_listing
    public.listings%rowtype;

  selected_code
    public.reusable_qr_codes%rowtype;

  inserted_assignment
    public.reusable_qr_assignments%rowtype;

  normalized_mode text;
  normalized_manual_url text;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;

  select listings.*
  into selected_listing
  from public.listings
  where listings.id =
    p_listing_id
  for update;

  if not found then
    raise exception
      'The selected listing does not exist.';
  end if;

  if selected_listing.owner_user_id
     is null then
    raise exception
      'The selected listing must have an assigned owner.';
  end if;

  if not public.marketing_can_manage_owned_record(
    selected_listing.org_id,
    selected_listing.owner_user_id
  ) then
    raise exception
      'You do not have permission to assign a QR code to this listing.';
  end if;

  perform 1
  from public.reusable_qr_assignments
  where listing_id =
      p_listing_id
    and released_at is null
  for update;

  if found then
    raise exception
      'This listing already has an active reusable QR code.';
  end if;

  if p_qr_code_id is null then
    select reusable_qr_codes.*
    into selected_code
    from public.reusable_qr_codes
    where reusable_qr_codes.org_id =
          selected_listing.org_id
      and reusable_qr_codes.is_enabled
      and not exists (
        select 1
        from public.reusable_qr_assignments
        where reusable_qr_assignments.qr_code_id =
              reusable_qr_codes.id
          and reusable_qr_assignments.released_at
              is null
      )
    order by
      reusable_qr_codes.code_number
    for update
      skip locked
    limit 1;
  else
    select reusable_qr_codes.*
    into selected_code
    from public.reusable_qr_codes
    where reusable_qr_codes.id =
      p_qr_code_id
    for update;

    if not found then
      raise exception
        'The selected reusable QR code does not exist.';
    end if;

    if selected_code.org_id <>
       selected_listing.org_id then
      raise exception
        'The QR code and listing must belong to the same organization.';
    end if;

    if not selected_code.is_enabled then
      raise exception
        'The selected reusable QR code is disabled.';
    end if;

    perform 1
    from public.reusable_qr_assignments
    where qr_code_id =
        selected_code.id
      and released_at is null
    for update;

    if found then
      raise exception
        'The selected reusable QR code is already assigned.';
    end if;
  end if;

  if selected_code.id is null then
    raise exception
      'No reusable QR codes are currently available.';
  end if;

  normalized_mode :=
    lower(
      trim(
        coalesce(
          p_destination_mode,
          ''
        )
      )
    );

  if normalized_mode not in (
    'property_website',
    'manual'
  ) then
    raise exception
      'Choose property_website or manual as the QR destination mode.';
  end if;

  normalized_manual_url :=
    nullif(
      trim(
        p_manual_destination_url
      ),
      ''
    );

  if normalized_mode =
       'property_website' then
    normalized_manual_url := null;
  elsif normalized_manual_url is null
        or normalized_manual_url
          !~* '^https://[^[:space:]]+$' then
    raise exception
      'A manual QR destination must be a valid HTTPS URL.';
  end if;

  insert into public.reusable_qr_assignments (
    qr_code_id,
    org_id,
    listing_id,
    owner_user_id,
    destination_mode,
    manual_destination_url,
    listing_title_snapshot,
    listing_address_snapshot,
    assigned_by
  )
  values (
    selected_code.id,
    selected_listing.org_id,
    selected_listing.id,
    selected_listing.owner_user_id,
    normalized_mode,
    normalized_manual_url,
    selected_listing.title,
    selected_listing.property_address,
    auth.uid()
  )
  returning *
  into inserted_assignment;

  return inserted_assignment;
end;
$function$;

revoke all
on function public.assign_reusable_qr_code(
  uuid,
  uuid,
  text,
  text
)
from public;

grant execute
on function public.assign_reusable_qr_code(
  uuid,
  uuid,
  text,
  text
)
to authenticated;

create or replace function public.release_reusable_qr_code(
  p_assignment_id uuid,
  p_release_reason text
    default 'manual release'
)
returns public.reusable_qr_assignments
language plpgsql
security definer
set search_path to
  'public',
  'auth',
  'pg_temp'
as $function$
declare
  selected_assignment
    public.reusable_qr_assignments%rowtype;

  released_assignment
    public.reusable_qr_assignments%rowtype;

  normalized_reason text;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;

  select reusable_qr_assignments.*
  into selected_assignment
  from public.reusable_qr_assignments
  where reusable_qr_assignments.id =
    p_assignment_id
  for update;

  if not found then
    raise exception
      'The selected QR assignment does not exist.';
  end if;

  if selected_assignment.released_at
     is not null then
    raise exception
      'This reusable QR code has already been released.';
  end if;

  if not public.marketing_can_manage_owned_record(
    selected_assignment.org_id,
    selected_assignment.owner_user_id
  ) then
    raise exception
      'You do not have permission to release this QR assignment.';
  end if;

  normalized_reason :=
    coalesce(
      nullif(
        trim(
          p_release_reason
        ),
        ''
      ),
      'manual release'
    );

  if char_length(
    normalized_reason
  ) > 240 then
    raise exception
      'The release reason cannot exceed 240 characters.';
  end if;

  update public.reusable_qr_assignments
  set
    released_at = now(),
    released_by = auth.uid(),
    release_reason =
      normalized_reason
  where id =
    selected_assignment.id
  returning *
  into released_assignment;

  return released_assignment;
end;
$function$;

revoke all
on function public.release_reusable_qr_code(
  uuid,
  text
)
from public;

grant execute
on function public.release_reusable_qr_code(
  uuid,
  text
)
to authenticated;

create or replace function public.set_reusable_qr_destination(
  p_assignment_id uuid,
  p_destination_mode text,
  p_manual_destination_url text
    default null
)
returns public.reusable_qr_assignments
language plpgsql
security definer
set search_path to
  'public',
  'auth',
  'pg_temp'
as $function$
declare
  selected_assignment
    public.reusable_qr_assignments%rowtype;

  updated_assignment
    public.reusable_qr_assignments%rowtype;

  normalized_mode text;
  normalized_manual_url text;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;

  select reusable_qr_assignments.*
  into selected_assignment
  from public.reusable_qr_assignments
  where reusable_qr_assignments.id =
    p_assignment_id
  for update;

  if not found then
    raise exception
      'The selected QR assignment does not exist.';
  end if;

  if selected_assignment.released_at
     is not null then
    raise exception
      'A released QR assignment cannot be changed.';
  end if;

  if not public.marketing_can_manage_owned_record(
    selected_assignment.org_id,
    selected_assignment.owner_user_id
  ) then
    raise exception
      'You do not have permission to change this QR destination.';
  end if;

  normalized_mode :=
    lower(
      trim(
        coalesce(
          p_destination_mode,
          ''
        )
      )
    );

  normalized_manual_url :=
    nullif(
      trim(
        p_manual_destination_url
      ),
      ''
    );

  if normalized_mode =
       'property_website' then
    normalized_manual_url := null;
  elsif normalized_mode =
        'manual'
        and normalized_manual_url
          ~* '^https://[^[:space:]]+$' then
    null;
  else
    raise exception
      'Choose the property website or provide a valid manual HTTPS URL.';
  end if;

  update public.reusable_qr_assignments
  set
    destination_mode =
      normalized_mode,
    manual_destination_url =
      normalized_manual_url
  where id =
    selected_assignment.id
  returning *
  into updated_assignment;

  return updated_assignment;
end;
$function$;

revoke all
on function public.set_reusable_qr_destination(
  uuid,
  text,
  text
)
from public;

grant execute
on function public.set_reusable_qr_destination(
  uuid,
  text,
  text
)
to authenticated;

create or replace function public.record_reusable_qr_scan(
  p_public_token text,
  p_scan_context text
    default 'public'
)
returns table (
  qr_code_id uuid,
  qr_assignment_id uuid,
  qr_listing_id uuid,
  qr_org_id uuid,
  qr_code_number smallint,
  qr_public_token text,
  destination_url text,
  assignment_active boolean
)
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  normalized_token text;
  normalized_context text;

  selected_code
    public.reusable_qr_codes%rowtype;

  selected_assignment
    public.reusable_qr_assignments%rowtype;

  selected_listing
    public.listings%rowtype;

  resolved_url text;
begin
  normalized_token :=
    lower(
      trim(
        coalesce(
          p_public_token,
          ''
        )
      )
    );

  normalized_context :=
    lower(
      trim(
        coalesce(
          p_scan_context,
          'public'
        )
      )
    );

  if normalized_context not in (
    'public',
    'internal_test'
  ) then
    raise exception
      'Invalid QR scan context.';
  end if;

  select reusable_qr_codes.*
  into selected_code
  from public.reusable_qr_codes
  where reusable_qr_codes.public_token =
        normalized_token
    and reusable_qr_codes.is_enabled
  limit 1;

  if not found then
    return;
  end if;

  select reusable_qr_assignments.*
  into selected_assignment
  from public.reusable_qr_assignments
  where reusable_qr_assignments.qr_code_id =
        selected_code.id
    and reusable_qr_assignments.released_at
        is null
  order by
    reusable_qr_assignments.assigned_at desc
  limit 1;

  if selected_assignment.id
     is not null then

    select listings.*
    into selected_listing
    from public.listings
    where listings.id =
      selected_assignment.listing_id;

    if selected_assignment.destination_mode =
       'manual' then
      resolved_url :=
        selected_assignment.manual_destination_url;

    elsif selected_listing.id
          is not null
          and selected_listing.website_status =
              'published'
          and nullif(
                trim(
                  selected_listing.public_url
                ),
                ''
              )
              is not null then

      resolved_url :=
        trim(
          selected_listing.public_url
        );
    end if;
  end if;

  insert into public.reusable_qr_scan_events (
    qr_code_id,
    assignment_id,
    org_id,
    listing_id,
    owner_user_id,
    scan_context,
    resolved_destination_url
  )
  values (
    selected_code.id,
    selected_assignment.id,
    selected_code.org_id,
    selected_assignment.listing_id,
    selected_assignment.owner_user_id,
    normalized_context,
    resolved_url
  );

  return query
  select
    selected_code.id,
    selected_assignment.id,
    selected_assignment.listing_id,
    selected_code.org_id,
    selected_code.code_number,
    selected_code.public_token,
    resolved_url,
    selected_assignment.id
      is not null;
end;
$function$;

revoke all
on function public.record_reusable_qr_scan(
  text,
  text
)
from public;

revoke all
on function public.record_reusable_qr_scan(
  text,
  text
)
from anon;

revoke all
on function public.record_reusable_qr_scan(
  text,
  text
)
from authenticated;

grant execute
on function public.record_reusable_qr_scan(
  text,
  text
)
to service_role;

create or replace function public.get_listing_qr_scan_metrics(
  p_listing_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns table (
  assignment_count bigint,
  total_scans bigint,
  period_scans bigint,
  previous_period_scans bigint,
  first_scan_at timestamptz,
  last_scan_at timestamptz
)
language plpgsql
security definer
set search_path to
  'public',
  'auth',
  'pg_temp'
as $function$
declare
  selected_listing
    public.listings%rowtype;

  previous_period_start
    timestamptz;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.';
  end if;

  if p_period_start is null
     or p_period_end is null
     or p_period_end <=
        p_period_start then
    raise exception
      'Choose a valid seller-report period.';
  end if;

  select listings.*
  into selected_listing
  from public.listings
  where listings.id =
    p_listing_id;

  if not found then
    raise exception
      'The selected listing does not exist.';
  end if;

  if selected_listing.owner_user_id
     is null
     or not public.marketing_can_manage_owned_record(
       selected_listing.org_id,
       selected_listing.owner_user_id
     ) then
    raise exception
      'You do not have permission to view QR statistics for this listing.';
  end if;

  previous_period_start :=
    p_period_start -
    (
      p_period_end -
      p_period_start
    );

  return query
  select
    (
      select count(*)::bigint
      from public.reusable_qr_assignments
      where listing_id =
        p_listing_id
    ) as assignment_count,

    count(
      reusable_qr_scan_events.id
    )::bigint as total_scans,

    count(
      reusable_qr_scan_events.id
    ) filter (
      where scanned_at >=
            p_period_start
        and scanned_at <
            p_period_end
    )::bigint as period_scans,

    count(
      reusable_qr_scan_events.id
    ) filter (
      where scanned_at >=
            previous_period_start
        and scanned_at <
            p_period_start
    )::bigint as previous_period_scans,

    min(
      reusable_qr_scan_events.scanned_at
    ) as first_scan_at,

    max(
      reusable_qr_scan_events.scanned_at
    ) as last_scan_at

  from public.reusable_qr_scan_events
  where listing_id =
        p_listing_id
    and assignment_id
        is not null
    and scan_context =
        'public';
end;
$function$;

revoke all
on function public.get_listing_qr_scan_metrics(
  uuid,
  timestamptz,
  timestamptz
)
from public;

grant execute
on function public.get_listing_qr_scan_metrics(
  uuid,
  timestamptz,
  timestamptz
)
to authenticated;

comment on table public.reusable_qr_codes is
  'Permanent organization-scoped reusable QR codes numbered 001 through 050.';

comment on table public.reusable_qr_assignments is
  'Historical assignment periods connecting reusable QR codes to listings.';

comment on table public.reusable_qr_scan_events is
  'Individual QR scans used for listing-specific reporting without visitor identity data.';

commit;
