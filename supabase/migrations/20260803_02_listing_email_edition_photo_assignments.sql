begin;

do $$
declare
  existing_unique_definition text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name =
        'listing_marketing_photo_assignments'
      and column_name = 'edition_key'
  ) then
    raise exception
      'Preflight failed: edition_key already exists on listing_marketing_photo_assignments.';
  end if;

  select
    pg_catalog.pg_get_constraintdef(
      constraint_row.oid,
      true
    )
  into existing_unique_definition
  from pg_catalog.pg_constraint
    constraint_row
  where constraint_row.conrelid =
      'public.listing_marketing_photo_assignments'::regclass
    and constraint_row.conname =
      'listing_marketing_photo_assignments_unique'
    and constraint_row.contype = 'u';

  if existing_unique_definition is distinct from
    'UNIQUE (listing_id, section_key, slot_key, sort_order)'
  then
    raise exception
      'Preflight failed: unexpected assignment unique constraint: %',
      coalesce(
        existing_unique_definition,
        '<missing>'
      );
  end if;
end
$$;

alter table
  public.listing_marketing_photo_assignments
add column edition_key text;

update
  public.listing_marketing_photo_assignments
  as assignment
set edition_key =
  case
    when assignment.section_key = 'email'
      then coalesce(
        (
          select
            case
              when
                email_section.content
                  ->> 'luxury_edition'
                in (
                  'launch',
                  'views_lifestyle',
                  'design_interiors',
                  'property_in_motion',
                  'closer_look',
                  'agent_spotlight',
                  'fresh_opportunity'
                )
              then
                email_section.content
                  ->> 'luxury_edition'
              else null
            end
          from
            public.listing_marketing_sections
              as email_section
          where
            email_section.listing_id =
              assignment.listing_id
            and email_section.section_key =
              'email'
          limit 1
        ),
        'launch'
      )
    else 'shared'
  end;

do $$
begin
  if exists (
    select 1
    from
      public.listing_marketing_photo_assignments
    where edition_key is null
  ) then
    raise exception
      'Backfill failed: one or more assignment rows have no edition_key.';
  end if;

  if exists (
    select 1
    from
      public.listing_marketing_photo_assignments
    where
      section_key = 'email'
      and edition_key not in (
        'launch',
        'views_lifestyle',
        'design_interiors',
        'property_in_motion',
        'closer_look',
        'agent_spotlight',
        'fresh_opportunity'
      )
  ) then
    raise exception
      'Backfill failed: an Email assignment has an invalid edition_key.';
  end if;

  if exists (
    select 1
    from
      public.listing_marketing_photo_assignments
    where
      section_key <> 'email'
      and edition_key <> 'shared'
  ) then
    raise exception
      'Backfill failed: a non-Email assignment does not use the shared edition key.';
  end if;
end
$$;

alter table
  public.listing_marketing_photo_assignments
alter column edition_key
  set default 'shared';

alter table
  public.listing_marketing_photo_assignments
alter column edition_key
  set not null;

alter table
  public.listing_marketing_photo_assignments
drop constraint
  listing_marketing_photo_assignments_unique;

alter table
  public.listing_marketing_photo_assignments
add constraint
  listing_marketing_photo_assignments_unique
unique (
  listing_id,
  section_key,
  edition_key,
  slot_key,
  sort_order
);

alter table
  public.listing_marketing_photo_assignments
add constraint
  listing_marketing_photo_assignments_edition_key_check
check (
  (
    section_key = 'email'
    and edition_key in (
      'launch',
      'views_lifestyle',
      'design_interiors',
      'property_in_motion',
      'closer_look',
      'agent_spotlight',
      'fresh_opportunity'
    )
  )
  or
  (
    section_key <> 'email'
    and edition_key = 'shared'
  )
);

comment on column
  public.listing_marketing_photo_assignments
    .edition_key
is
  'Email edition owning the photo slot. Non-Email assignments use shared.';

commit;