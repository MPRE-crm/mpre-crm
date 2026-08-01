-- REUSABLE QR SYSTEM
-- SCAN CONTEXT AMENDMENT
--
-- Adds:
-- - Marketing source
-- - Approximate city, region, and country
-- - General device category
-- - Referring host when available
-- - Probable-bot filtering
-- - Anonymous HMAC hash for estimated unique/repeat scans
--
-- Does not store:
-- - Raw IP addresses
-- - Full user-agent strings
-- - Precise locations
-- - Names, email addresses, or phone numbers

begin;

alter table public.reusable_qr_scan_events
  add column marketing_source text,
  add column city text,
  add column region text,
  add column country_code text,
  add column device_category text not null
    default 'unknown',
  add column referrer_host text,
  add column is_probable_bot boolean not null
    default false,
  add column anonymous_scanner_hash text;

alter table public.reusable_qr_scan_events
  add constraint reusable_qr_scan_events_marketing_source_check
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

  add constraint reusable_qr_scan_events_city_check
    check (
      city is null
      or char_length(
        trim(city)
      ) between 1 and 120
    ),

  add constraint reusable_qr_scan_events_region_check
    check (
      region is null
      or char_length(
        trim(region)
      ) between 1 and 120
    ),

  add constraint reusable_qr_scan_events_country_check
    check (
      country_code is null
      or (
        country_code =
          upper(country_code)
        and country_code ~
          '^[A-Z]{2}$'
      )
    ),

  add constraint reusable_qr_scan_events_device_check
    check (
      device_category in (
        'mobile',
        'tablet',
        'desktop',
        'other',
        'unknown'
      )
    ),

  add constraint reusable_qr_scan_events_referrer_check
    check (
      referrer_host is null
      or char_length(
        trim(referrer_host)
      ) between 1 and 255
    ),

  add constraint reusable_qr_scan_events_scanner_hash_check
    check (
      anonymous_scanner_hash is null
      or anonymous_scanner_hash ~
        '^[0-9a-f]{64}$'
    );

create index reusable_qr_scan_assignment_human_time_idx
  on public.reusable_qr_scan_events (
    assignment_id,
    scanned_at desc
  )
  where scan_context = 'public'
    and not is_probable_bot;

create index reusable_qr_scan_assignment_scanner_idx
  on public.reusable_qr_scan_events (
    assignment_id,
    anonymous_scanner_hash,
    scanned_at desc
  )
  where anonymous_scanner_hash is not null
    and scan_context = 'public'
    and not is_probable_bot;

create index reusable_qr_scan_listing_source_idx
  on public.reusable_qr_scan_events (
    listing_id,
    marketing_source,
    scanned_at desc
  )
  where marketing_source is not null
    and scan_context = 'public'
    and not is_probable_bot;

create index reusable_qr_scan_listing_location_idx
  on public.reusable_qr_scan_events (
    listing_id,
    city,
    region,
    scanned_at desc
  )
  where city is not null
    and scan_context = 'public'
    and not is_probable_bot;

create or replace function public.record_reusable_qr_scan_with_context(
  p_public_token text,
  p_scan_context text
    default 'public',
  p_marketing_source text
    default null,
  p_city text
    default null,
  p_region text
    default null,
  p_country_code text
    default null,
  p_device_category text
    default 'unknown',
  p_referrer_host text
    default null,
  p_is_probable_bot boolean
    default false,
  p_anonymous_scanner_hash text
    default null
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
  normalized_source text;
  normalized_city text;
  normalized_region text;
  normalized_country text;
  normalized_device text;
  normalized_referrer text;
  normalized_scanner_hash text;

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

  normalized_source :=
    nullif(
      lower(
        trim(
          coalesce(
            p_marketing_source,
            ''
          )
        )
      ),
      ''
    );

  if normalized_source is not null
     and (
       char_length(
         normalized_source
       ) > 80
       or normalized_source !~
         '^[a-z0-9]+([_-][a-z0-9]+)*$'
     ) then
    raise exception
      'Invalid QR marketing source.';
  end if;

  normalized_city :=
    nullif(
      trim(
        coalesce(
          p_city,
          ''
        )
      ),
      ''
    );

  if normalized_city is not null
     and char_length(
       normalized_city
     ) > 120 then
    raise exception
      'QR city value is too long.';
  end if;

  normalized_region :=
    nullif(
      trim(
        coalesce(
          p_region,
          ''
        )
      ),
      ''
    );

  if normalized_region is not null
     and char_length(
       normalized_region
     ) > 120 then
    raise exception
      'QR region value is too long.';
  end if;

  normalized_country :=
    nullif(
      upper(
        trim(
          coalesce(
            p_country_code,
            ''
          )
        )
      ),
      ''
    );

  if normalized_country is not null
     and normalized_country !~
       '^[A-Z]{2}$' then
    raise exception
      'Invalid QR country code.';
  end if;

  normalized_device :=
    lower(
      trim(
        coalesce(
          p_device_category,
          'unknown'
        )
      )
    );

  if normalized_device not in (
    'mobile',
    'tablet',
    'desktop',
    'other',
    'unknown'
  ) then
    normalized_device :=
      'unknown';
  end if;

  normalized_referrer :=
    nullif(
      lower(
        trim(
          coalesce(
            p_referrer_host,
            ''
          )
        )
      ),
      ''
    );

  if normalized_referrer is not null
     and char_length(
       normalized_referrer
     ) > 255 then
    raise exception
      'QR referrer host is too long.';
  end if;

  normalized_scanner_hash :=
    nullif(
      lower(
        trim(
          coalesce(
            p_anonymous_scanner_hash,
            ''
          )
        )
      ),
      ''
    );

  if normalized_scanner_hash is not null
     and normalized_scanner_hash !~
       '^[0-9a-f]{64}$' then
    raise exception
      'Invalid anonymous QR scanner hash.';
  end if;

  select
    reusable_qr_codes.*
  into selected_code
  from public.reusable_qr_codes
  where reusable_qr_codes.public_token =
        normalized_token
    and reusable_qr_codes.is_enabled
  limit 1;

  if not found then
    return;
  end if;

  select
    reusable_qr_assignments.*
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

    select
      listings.*
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
    resolved_destination_url,
    marketing_source,
    city,
    region,
    country_code,
    device_category,
    referrer_host,
    is_probable_bot,
    anonymous_scanner_hash
  )
  values (
    selected_code.id,
    selected_assignment.id,
    selected_code.org_id,
    selected_assignment.listing_id,
    selected_assignment.owner_user_id,
    normalized_context,
    resolved_url,
    normalized_source,
    normalized_city,
    normalized_region,
    normalized_country,
    normalized_device,
    normalized_referrer,
    coalesce(
      p_is_probable_bot,
      false
    ),
    normalized_scanner_hash
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
on function public.record_reusable_qr_scan_with_context(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
)
from public;

revoke all
on function public.record_reusable_qr_scan_with_context(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
)
from anon;

revoke all
on function public.record_reusable_qr_scan_with_context(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
)
from authenticated;

grant execute
on function public.record_reusable_qr_scan_with_context(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text
)
to service_role;

comment on column
  public.reusable_qr_scan_events.marketing_source
is
  'Approved source tag such as flyer, yard-sign, postcard, open-house, or social.';

comment on column
  public.reusable_qr_scan_events.city
is
  'Approximate IP-derived city supplied by the hosting platform; not precise GPS.';

comment on column
  public.reusable_qr_scan_events.region
is
  'Approximate IP-derived state or region supplied by the hosting platform.';

comment on column
  public.reusable_qr_scan_events.anonymous_scanner_hash
is
  'Server-generated HMAC hash for estimated unique and repeat scans; raw IP is not stored.';

commit;
