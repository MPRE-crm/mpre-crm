-- REUSABLE QR SYSTEM
-- SELLER-REPORT METRICS
--
-- Source-control copy of the already-applied reporting function.
-- This migration is not intended to be rerun against the current database.

begin;

create or replace function public.get_listing_qr_scan_report_metrics(
  p_listing_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns table (
  assignment_count bigint,
  total_human_scans bigint,
  period_human_scans bigint,
  previous_period_human_scans bigint,
  estimated_unique_scanners bigint,
  estimated_repeat_scans bigint,
  unclassified_scans bigint,
  first_scan_at timestamptz,
  last_scan_at timestamptz,
  top_city text,
  top_region text,
  top_country_code text,
  top_marketing_source text,
  top_device_category text
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

  select
    listings.*
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

  with human_scans as (
    select
      scan_events.id,
      scan_events.assignment_id,
      scan_events.scanned_at,
      scan_events.marketing_source,
      scan_events.city,
      scan_events.region,
      scan_events.country_code,
      scan_events.device_category,
      scan_events.anonymous_scanner_hash
    from public.reusable_qr_scan_events
      as scan_events
    where scan_events.listing_id =
          p_listing_id
      and scan_events.assignment_id
          is not null
      and scan_events.scan_context =
          'public'
      and not scan_events.is_probable_bot
  ),

  selected_period_scans as (
    select
      human_scans.*
    from human_scans
    where human_scans.scanned_at >=
          p_period_start
      and human_scans.scanned_at <
          p_period_end
  ),

  previous_period_scans as (
    select
      human_scans.*
    from human_scans
    where human_scans.scanned_at >=
          previous_period_start
      and human_scans.scanned_at <
          p_period_start
  ),

  assignment_statistics as (
    select
      count(*)::bigint
        as assignment_count
    from public.reusable_qr_assignments
    where reusable_qr_assignments.listing_id =
          p_listing_id
  ),

  lifetime_statistics as (
    select
      count(*)::bigint
        as total_human_scans,

      min(
        human_scans.scanned_at
      ) as first_scan_at,

      max(
        human_scans.scanned_at
      ) as last_scan_at

    from human_scans
  ),

  selected_period_statistics as (
    select
      count(*)::bigint
        as period_human_scans,

      count(
        distinct
        selected_period_scans
          .anonymous_scanner_hash
      )::bigint
        as estimated_unique_scanners,

      greatest(
        (
          count(*) filter (
            where selected_period_scans
                    .anonymous_scanner_hash
                  is not null
          )
          -
          count(
            distinct
            selected_period_scans
              .anonymous_scanner_hash
          )
        )::bigint,
        0::bigint
      ) as estimated_repeat_scans,

      count(*) filter (
        where selected_period_scans
                .anonymous_scanner_hash
              is null
      )::bigint
        as unclassified_scans

    from selected_period_scans
  ),

  previous_period_statistics as (
    select
      count(*)::bigint
        as previous_period_human_scans
    from previous_period_scans
  ),

  top_location as (
    select
      nullif(
        trim(
          selected_period_scans.city
        ),
        ''
      ) as city,

      nullif(
        trim(
          selected_period_scans.region
        ),
        ''
      ) as region,

      nullif(
        trim(
          selected_period_scans
            .country_code
        ),
        ''
      ) as country_code,

      count(*)::bigint
        as scan_count

    from selected_period_scans

    where nullif(
            trim(
              selected_period_scans.city
            ),
            ''
          ) is not null
       or nullif(
            trim(
              selected_period_scans.region
            ),
            ''
          ) is not null
       or nullif(
            trim(
              selected_period_scans
                .country_code
            ),
            ''
          ) is not null

    group by
      nullif(
        trim(
          selected_period_scans.city
        ),
        ''
      ),

      nullif(
        trim(
          selected_period_scans.region
        ),
        ''
      ),

      nullif(
        trim(
          selected_period_scans
            .country_code
        ),
        ''
      )

    order by
      count(*) desc,

      lower(
        coalesce(
          nullif(
            trim(
              selected_period_scans.city
            ),
            ''
          ),
          ''
        )
      ),

      lower(
        coalesce(
          nullif(
            trim(
              selected_period_scans.region
            ),
            ''
          ),
          ''
        )
      )

    limit 1
  ),

  top_source as (
    select
      selected_period_scans
        .marketing_source,

      count(*)::bigint
        as scan_count

    from selected_period_scans

    where selected_period_scans
            .marketing_source
          is not null

    group by
      selected_period_scans
        .marketing_source

    order by
      count(*) desc,
      selected_period_scans
        .marketing_source

    limit 1
  ),

  top_device as (
    select
      selected_period_scans
        .device_category,

      count(*)::bigint
        as scan_count

    from selected_period_scans

    group by
      selected_period_scans
        .device_category

    order by
      count(*) desc,
      selected_period_scans
        .device_category

    limit 1
  )

  select
    assignment_statistics
      .assignment_count,

    lifetime_statistics
      .total_human_scans,

    selected_period_statistics
      .period_human_scans,

    previous_period_statistics
      .previous_period_human_scans,

    selected_period_statistics
      .estimated_unique_scanners,

    selected_period_statistics
      .estimated_repeat_scans,

    selected_period_statistics
      .unclassified_scans,

    lifetime_statistics
      .first_scan_at,

    lifetime_statistics
      .last_scan_at,

    top_location.city,

    top_location.region,

    top_location.country_code,

    top_source.marketing_source,

    top_device.device_category

  from assignment_statistics

  cross join lifetime_statistics

  cross join selected_period_statistics

  cross join previous_period_statistics

  left join top_location
    on true

  left join top_source
    on true

  left join top_device
    on true;
end;
$function$;

revoke all
on function public.get_listing_qr_scan_report_metrics(
  uuid,
  timestamptz,
  timestamptz
)
from public;

revoke all
on function public.get_listing_qr_scan_report_metrics(
  uuid,
  timestamptz,
  timestamptz
)
from anon;

grant execute
on function public.get_listing_qr_scan_report_metrics(
  uuid,
  timestamptz,
  timestamptz
)
to authenticated;

grant execute
on function public.get_listing_qr_scan_report_metrics(
  uuid,
  timestamptz,
  timestamptz
)
to service_role;

comment on function
  public.get_listing_qr_scan_report_metrics(
    uuid,
    timestamptz,
    timestamptz
  )
is
  'Returns privacy-safe, bot-filtered QR engagement metrics for a listing seller report.';

commit;
