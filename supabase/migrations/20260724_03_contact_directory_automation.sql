begin;

-- ============================================================
-- CONTACT DIRECTORY FIELDS
-- ============================================================

alter table public.contacts
  add column if not exists
    company_normalized text
    generated always as (
      nullif(
        lower(
          btrim(company)
        ),
        ''
      )
    ) stored,

  add column if not exists
    mls_agent_id text,

  add column if not exists
    mls_office_id text,

  add column if not exists
    license_number text,

  add column if not exists
    contact_review_status text not null
    default 'unreviewed',

  add column if not exists
    last_enriched_at timestamptz,

  add column if not exists
    last_enrichment_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'contacts_review_status_check'
      and conrelid =
        'public.contacts'::regclass
  ) then
    alter table public.contacts
      add constraint
        contacts_review_status_check
      check (
        contact_review_status in (
          'unreviewed',
          'ready',
          'needs_review'
        )
      );
  end if;
end;
$$;

comment on column
  public.contacts.company_normalized
is
  'Normalized brokerage/company value used for grouping and filtering.';

comment on column
  public.contacts.mls_agent_id
is
  'Realtor MLS user or member identifier used as a fallback when email matching is unavailable.';

comment on column
  public.contacts.mls_office_id
is
  'MLS office identifier associated with the contact.';

comment on column
  public.contacts.contact_review_status
is
  'Indicates whether Samantha has found missing or conflicting contact information.';

-- ============================================================
-- NORMALIZE CONTACT DIRECTORY VALUES
-- ============================================================

create or replace function
  public.normalize_contact_directory_fields()
returns trigger
language plpgsql
as $$
begin
  new.company :=
    nullif(
      regexp_replace(
        btrim(
          coalesce(
            new.company,
            ''
          )
        ),
        '\s+',
        ' ',
        'g'
      ),
      ''
    );

  new.mls_agent_id :=
    nullif(
      btrim(
        coalesce(
          new.mls_agent_id,
          ''
        )
      ),
      ''
    );

  new.mls_office_id :=
    nullif(
      btrim(
        coalesce(
          new.mls_office_id,
          ''
        )
      ),
      ''
    );

  new.license_number :=
    nullif(
      btrim(
        coalesce(
          new.license_number,
          ''
        )
      ),
      ''
    );

  return new;
end;
$$;

drop trigger if exists
  contacts_normalize_directory_fields
on public.contacts;

create trigger
  contacts_normalize_directory_fields
before insert or update of
  company,
  mls_agent_id,
  mls_office_id,
  license_number
on public.contacts
for each row
execute function
  public.normalize_contact_directory_fields();

-- ============================================================
-- LEGACY DEFAULT BROKERAGE CLEANUP
-- ============================================================

-- The original 839-contact import received Homes of Idaho from
-- the old UI default. Keep that brokerage only when an active
-- Realtor match independently confirms it.

update public.contacts
  as contact_row

set
  company =
    null,

  tags =
    array_remove(
      coalesce(
        contact_row.tags,
        '{}'::text[]
      ),
      'Homes of Idaho'
    ),

  contact_review_status =
    'needs_review',

  last_enriched_at =
    now(),

  last_enrichment_source =
    'legacy_default_brokerage_cleanup'

where contact_row.source =
    'Contact import: homes_of_idaho_realtors_import_ready.csv'

  and lower(
    btrim(
      coalesce(
        contact_row.company,
        ''
      )
    )
  ) =
    'homes of idaho'

  and not exists (
    select 1

    from public.listing_realtor_matches
      as match_row

    where match_row.contact_id =
        contact_row.id

      and match_row.is_active =
        true

      and lower(
        btrim(
          coalesce(
            match_row.agent_company,
            ''
          )
        )
      ) =
        'homes of idaho'
  );


-- Remove the old automatic Homes of Idaho tag from imported
-- contacts whose actual brokerage is different or unknown.

update public.contacts
  as contact_row

set tags =
  array_remove(
    coalesce(
      contact_row.tags,
      '{}'::text[]
    ),
    'Homes of Idaho'
  )

where coalesce(
    contact_row.source,
    ''
  ) like
    'Contact import:%'

  and (
    contact_row.company is null

    or lower(
      btrim(
        contact_row.company
      )
    ) <>
      'homes of idaho'
  )

  and 'Homes of Idaho' =
    any(
      coalesce(
        contact_row.tags,
        '{}'::text[]
      )
    );

-- Normalize harmless spacing in existing company values.

update public.contacts
set company =
  nullif(
    regexp_replace(
      btrim(
        coalesce(
          company,
          ''
        )
      ),
      '\s+',
      ' ',
      'g'
    ),
    ''
  )
where company is distinct from
  nullif(
    regexp_replace(
      btrim(
        coalesce(
          company,
          ''
        )
      ),
      '\s+',
      ' ',
      'g'
    ),
    ''
  );

-- ============================================================
-- SAMANTHA CONTACT-ENRICHMENT REVIEW QUEUE
-- ============================================================

create table if not exists
  public.contact_enrichment_reviews (
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
      on delete cascade,

    listing_id uuid
      references public.listings(id)
      on delete cascade,

    realtor_match_id uuid
      references public.listing_realtor_matches(id)
      on delete cascade,

    issue_type text not null,

    field_name text,

    current_value text,
    proposed_value text,

    source text not null
      default 'system',

    status text not null
      default 'pending',

    confidence numeric(5,2),

    details jsonb not null
      default '{}'::jsonb,

    created_by uuid
      references auth.users(id)
      on delete set null,

    resolved_by uuid
      references auth.users(id)
      on delete set null,

    resolved_at timestamptz,

    created_at timestamptz not null
      default now(),

    updated_at timestamptz not null
      default now(),

    constraint
      contact_enrichment_reviews_target_check
      check (
        contact_id is not null
        or realtor_match_id is not null
      ),

    constraint
      contact_enrichment_reviews_issue_check
      check (
        issue_type in (
          'missing_phone',
          'missing_brokerage',
          'brokerage_conflict',
          'email_conflict',
          'mls_id_conflict',
          'possible_duplicate',
          'unlinked_match',
          'stale_data',
          'other'
        )
      ),

    constraint
      contact_enrichment_reviews_status_check
      check (
        status in (
          'pending',
          'approved',
          'rejected',
          'resolved',
          'ignored'
        )
      ),

    constraint
      contact_enrichment_reviews_confidence_check
      check (
        confidence is null
        or (
          confidence >= 0
          and confidence <= 100
        )
      ),

    constraint
      contact_enrichment_reviews_details_check
      check (
        jsonb_typeof(details) = 'object'
      )
  );

comment on table
  public.contact_enrichment_reviews
is
  'Samantha review queue for missing, conflicting, duplicate, or stale Realtor contact information.';

-- ============================================================
-- REVIEW OWNERSHIP AND TENANT SAFETY
-- ============================================================

create or replace function
  public.sync_contact_enrichment_review_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org_id uuid;
  target_owner_user_id uuid;

  match_org_id uuid;
  match_owner_user_id uuid;
  match_listing_id uuid;
  match_contact_id uuid;

  listing_org_id uuid;
begin
  if new.contact_id is not null then
    select
      contact_row.org_id,
      contact_row.owner_user_id
    into
      target_org_id,
      target_owner_user_id
    from public.contacts
      as contact_row
    where contact_row.id =
      new.contact_id;

    if not found then
      raise exception
        'Contact enrichment review contact was not found.';
    end if;
  end if;

  if new.realtor_match_id is not null then
    select
      match_row.org_id,
      match_row.owner_user_id,
      match_row.listing_id,
      match_row.contact_id
    into
      match_org_id,
      match_owner_user_id,
      match_listing_id,
      match_contact_id
    from public.listing_realtor_matches
      as match_row
    where match_row.id =
      new.realtor_match_id;

    if not found then
      raise exception
        'Contact enrichment review Realtor match was not found.';
    end if;

    if
      target_org_id is not null
      and target_org_id <> match_org_id
    then
      raise exception
        'Contact and Realtor match belong to different organizations.';
    end if;

    if
      new.contact_id is not null
      and match_contact_id is not null
      and new.contact_id <> match_contact_id
    then
      raise exception
        'Realtor match is linked to a different contact.';
    end if;

    target_org_id :=
      match_org_id;

    target_owner_user_id :=
      match_owner_user_id;

    new.listing_id :=
      coalesce(
        new.listing_id,
        match_listing_id
      );
  end if;

  if target_org_id is null then
    raise exception
      'A contact or Realtor match is required.';
  end if;

  if new.listing_id is not null then
    select
      listing_row.org_id
    into
      listing_org_id
    from public.listings
      as listing_row
    where listing_row.id =
      new.listing_id;

    if not found then
      raise exception
        'Contact enrichment review listing was not found.';
    end if;

    if listing_org_id <> target_org_id then
      raise exception
        'The listing belongs to a different organization.';
    end if;
  end if;

  new.org_id :=
    target_org_id;

  new.owner_user_id :=
    target_owner_user_id;

  return new;
end;
$$;

revoke all
on function
  public.sync_contact_enrichment_review_scope()
from public;

grant execute
on function
  public.sync_contact_enrichment_review_scope()
to authenticated,
   service_role;

drop trigger if exists
  contact_enrichment_reviews_sync_scope
on public.contact_enrichment_reviews;

create trigger
  contact_enrichment_reviews_sync_scope
before insert or update of
  org_id,
  owner_user_id,
  contact_id,
  listing_id,
  realtor_match_id
on public.contact_enrichment_reviews
for each row
execute function
  public.sync_contact_enrichment_review_scope();

drop trigger if exists
  contact_enrichment_reviews_set_updated_at
on public.contact_enrichment_reviews;

create trigger
  contact_enrichment_reviews_set_updated_at
before update
on public.contact_enrichment_reviews
for each row
execute function
  public.set_marketing_updated_at();

-- ============================================================
-- LEGACY BROKERAGE REVIEW ITEMS
-- ============================================================

-- These are valid Realtor contacts whose old brokerage value
-- came only from the former import default. Samantha can enrich
-- them later without silently inventing or overwriting data.

insert into public.contact_enrichment_reviews (
  org_id,
  owner_user_id,
  contact_id,
  listing_id,
  realtor_match_id,
  issue_type,
  field_name,
  current_value,
  proposed_value,
  source,
  confidence,
  details,
  created_by
)

select
  contact_row.org_id,
  contact_row.owner_user_id,
  contact_row.id,
  null,
  null,
  'missing_brokerage',
  'company',
  null,
  null,
  'legacy_import_cleanup',
  100,

  jsonb_build_object(
    'reason',
    'The former Homes of Idaho value came from an import default and was not independently verified.',

    'former_default',
    'Homes of Idaho'
  ),

  coalesce(
    contact_row.created_by,
    contact_row.owner_user_id
  )

from public.contacts
  as contact_row

where contact_row.source =
    'Contact import: homes_of_idaho_realtors_import_ready.csv'

  and contact_row.company is null

  and contact_row.last_enrichment_source =
    'legacy_default_brokerage_cleanup'

  and not exists (
    select 1

    from public.listing_realtor_matches
      as match_row

    where match_row.contact_id =
        contact_row.id

      and match_row.is_active =
        true

      and nullif(
        btrim(
          coalesce(
            match_row.agent_company,
            ''
          )
        ),
        ''
      ) is not null
  )

on conflict do nothing;


-- ============================================================
-- BACKFILL DIRECTORY DATA FROM CURRENT STUDIO MATCHES
-- ============================================================

with latest_match as (
  select distinct on (
    match_row.contact_id
  )
    match_row.contact_id,

    nullif(
      regexp_replace(
        btrim(
          coalesce(
            match_row.agent_company,
            ''
          )
        ),
        '\s+',
        ' ',
        'g'
      ),
      ''
    ) as agent_company,

    nullif(
      btrim(
        match_row.external_agent_id
      ),
      ''
    ) as mls_agent_id,

    nullif(
      btrim(
        match_row.external_office_id
      ),
      ''
    ) as mls_office_id

  from public.listing_realtor_matches
    as match_row

  where match_row.contact_id is not null
    and match_row.is_active = true

  order by
    match_row.contact_id,
    match_row.last_matched_at desc nulls last,
    match_row.created_at desc
)

update public.contacts
  as contact_row

set
  company =
    case
      when contact_row.company is null then
        latest_match.agent_company

      else
        contact_row.company
    end,

  mls_agent_id =
    coalesce(
      contact_row.mls_agent_id,
      latest_match.mls_agent_id
    ),

  mls_office_id =
    coalesce(
      contact_row.mls_office_id,
      latest_match.mls_office_id
    ),

  last_enriched_at =
    now(),

  last_enrichment_source =
    'reverse_prospecting_backfill'

from latest_match

where contact_row.id =
    latest_match.contact_id

  and (
    (
      contact_row.company is null
      and latest_match.agent_company is not null
    )

    or (
      contact_row.mls_agent_id is null
      and latest_match.mls_agent_id is not null
    )

    or (
      contact_row.mls_office_id is null
      and latest_match.mls_office_id is not null
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists
  contacts_company_filter_idx
on public.contacts (
  org_id,
  owner_user_id,
  contact_type,
  company_normalized
);

create unique index if not exists
  contacts_org_mls_agent_unique
on public.contacts (
  org_id,
  mls_agent_id
)
where
  mls_agent_id is not null
  and btrim(mls_agent_id) <> '';

create index if not exists
  contacts_org_mls_office_idx
on public.contacts (
  org_id,
  mls_office_id
)
where
  mls_office_id is not null
  and btrim(mls_office_id) <> '';

create index if not exists
  contacts_review_status_idx
on public.contacts (
  org_id,
  owner_user_id,
  contact_review_status,
  contact_type
);

create index if not exists
  contact_enrichment_reviews_queue_idx
on public.contact_enrichment_reviews (
  org_id,
  owner_user_id,
  status,
  issue_type,
  created_at desc
);

create unique index if not exists
  contact_enrichment_reviews_pending_unique
on public.contact_enrichment_reviews (
  org_id,

  coalesce(
    contact_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),

  coalesce(
    realtor_match_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),

  issue_type,

  coalesce(
    field_name,
    ''
  )
)
where status = 'pending';

-- ============================================================
-- CREATE CURRENT REVIEW ITEMS
-- ============================================================

insert into public.contact_enrichment_reviews (
  org_id,
  owner_user_id,
  contact_id,
  listing_id,
  realtor_match_id,
  issue_type,
  field_name,
  current_value,
  proposed_value,
  source,
  confidence,
  details,
  created_by
)

select
  match_row.org_id,
  match_row.owner_user_id,
  contact_row.id,
  match_row.listing_id,
  match_row.id,
  'missing_phone',
  'phone',
  contact_row.phone,
  null,
  'reverse_prospecting',
  100,
  jsonb_build_object(
    'reason',
    'The linked Realtor contact has no cell or home phone stored.'
  ),
  match_row.owner_user_id

from public.listing_realtor_matches
  as match_row

join public.contacts
  as contact_row
  on contact_row.id =
    match_row.contact_id

where match_row.is_active = true
  and nullif(
    btrim(
      coalesce(
        contact_row.phone,
        ''
      )
    ),
    ''
  ) is null

on conflict do nothing;


insert into public.contact_enrichment_reviews (
  org_id,
  owner_user_id,
  contact_id,
  listing_id,
  realtor_match_id,
  issue_type,
  field_name,
  current_value,
  proposed_value,
  source,
  confidence,
  details,
  created_by
)

select
  match_row.org_id,
  match_row.owner_user_id,
  contact_row.id,
  match_row.listing_id,
  match_row.id,
  'missing_brokerage',
  'company',
  contact_row.company,
  match_row.agent_company,
  'reverse_prospecting',
  100,
  jsonb_build_object(
    'reason',
    'The CRM contact has no brokerage but the Realtor match may contain one.'
  ),
  match_row.owner_user_id

from public.listing_realtor_matches
  as match_row

join public.contacts
  as contact_row
  on contact_row.id =
    match_row.contact_id

where match_row.is_active = true

  and nullif(
    btrim(
      coalesce(
        contact_row.company,
        ''
      )
    ),
    ''
  ) is null

on conflict do nothing;


insert into public.contact_enrichment_reviews (
  org_id,
  owner_user_id,
  contact_id,
  listing_id,
  realtor_match_id,
  issue_type,
  field_name,
  current_value,
  proposed_value,
  source,
  confidence,
  details,
  created_by
)

select
  match_row.org_id,
  match_row.owner_user_id,
  contact_row.id,
  match_row.listing_id,
  match_row.id,
  'brokerage_conflict',
  'company',
  contact_row.company,
  match_row.agent_company,
  'reverse_prospecting',
  100,
  jsonb_build_object(
    'reason',
    'The CRM brokerage differs from the imported Realtor-match brokerage.'
  ),
  match_row.owner_user_id

from public.listing_realtor_matches
  as match_row

join public.contacts
  as contact_row
  on contact_row.id =
    match_row.contact_id

where match_row.is_active = true

  and nullif(
    btrim(
      coalesce(
        match_row.agent_company,
        ''
      )
    ),
    ''
  ) is not null

  and contact_row.company_normalized is not null

  and lower(
    btrim(
      match_row.agent_company
    )
  ) <>
    contact_row.company_normalized

on conflict do nothing;


insert into public.contact_enrichment_reviews (
  org_id,
  owner_user_id,
  contact_id,
  listing_id,
  realtor_match_id,
  issue_type,
  field_name,
  current_value,
  proposed_value,
  source,
  confidence,
  details,
  created_by
)

select
  match_row.org_id,
  match_row.owner_user_id,
  contact_row.id,
  match_row.listing_id,
  match_row.id,
  'mls_id_conflict',
  'mls_agent_id',
  contact_row.mls_agent_id,
  match_row.external_agent_id,
  'reverse_prospecting',
  100,
  jsonb_build_object(
    'reason',
    'The stored MLS user code differs from the imported Realtor-match code.'
  ),
  match_row.owner_user_id

from public.listing_realtor_matches
  as match_row

join public.contacts
  as contact_row
  on contact_row.id =
    match_row.contact_id

where match_row.is_active = true

  and nullif(
    btrim(
      coalesce(
        match_row.external_agent_id,
        ''
      )
    ),
    ''
  ) is not null

  and nullif(
    btrim(
      coalesce(
        contact_row.mls_agent_id,
        ''
      )
    ),
    ''
  ) is not null

  and btrim(
    contact_row.mls_agent_id
  ) <>
    btrim(
      match_row.external_agent_id
    )

on conflict do nothing;


insert into public.contact_enrichment_reviews (
  org_id,
  owner_user_id,
  contact_id,
  listing_id,
  realtor_match_id,
  issue_type,
  field_name,
  current_value,
  proposed_value,
  source,
  confidence,
  details,
  created_by
)

select
  match_row.org_id,
  match_row.owner_user_id,
  null,
  match_row.listing_id,
  match_row.id,
  'unlinked_match',
  'contact_id',
  null,
  match_row.agent_email,
  'reverse_prospecting',
  100,
  jsonb_build_object(
    'agent_email',
    match_row.agent_email,
    'agent_name',
    match_row.agent_display_name,
    'agent_company',
    match_row.agent_company
  ),
  match_row.owner_user_id

from public.listing_realtor_matches
  as match_row

where match_row.is_active = true
  and match_row.contact_id is null

on conflict do nothing;

-- Mark contacts with pending problems.

update public.contacts
  as contact_row

set contact_review_status =
  'needs_review'

where exists (
  select 1
  from public.contact_enrichment_reviews
    as review_row
  where review_row.contact_id =
      contact_row.id
    and review_row.status =
      'pending'
);

-- Mark successfully linked Realtors ready when no review is pending.

update public.contacts
  as contact_row

set contact_review_status =
  'ready'

where exists (
    select 1
    from public.listing_realtor_matches
      as match_row
    where match_row.contact_id =
        contact_row.id
      and match_row.is_active =
        true
  )

  and not exists (
    select 1
    from public.contact_enrichment_reviews
      as review_row
    where review_row.contact_id =
        contact_row.id
      and review_row.status =
        'pending'
  );

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table
  public.contact_enrichment_reviews
enable row level security;

drop policy if exists
  contact_enrichment_reviews_select
on public.contact_enrichment_reviews;

create policy
  contact_enrichment_reviews_select
on public.contact_enrichment_reviews
for select
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

drop policy if exists
  contact_enrichment_reviews_insert
on public.contact_enrichment_reviews;

create policy
  contact_enrichment_reviews_insert
on public.contact_enrichment_reviews
for insert
to authenticated
with check (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

drop policy if exists
  contact_enrichment_reviews_update
on public.contact_enrichment_reviews;

create policy
  contact_enrichment_reviews_update
on public.contact_enrichment_reviews
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

drop policy if exists
  contact_enrichment_reviews_delete
on public.contact_enrichment_reviews;

create policy
  contact_enrichment_reviews_delete
on public.contact_enrichment_reviews
for delete
to authenticated
using (
  public.marketing_can_manage_owned_record(
    org_id,
    owner_user_id
  )
);

revoke all
on public.contact_enrichment_reviews
from anon;

grant
  select,
  insert,
  update,
  delete
on public.contact_enrichment_reviews
to authenticated;

grant all
on public.contact_enrichment_reviews
to service_role;

commit;