-- ============================================================
-- LISTING EMAIL EVENT TYPES + EXTERNAL CAMPAIGN SAFEGUARDS
--
-- Purpose:
-- - Add the approved listing-email lifecycle and marketing events.
-- - Preserve existing event values for backward compatibility.
-- - Keep email_campaigns.campaign_type as the broad recipient-
--   preference category.
-- - Map Price Improvement to the Price Change preference.
-- - Map Open House and Broker Open to the Open House preference.
-- - Map other external listing events to Listing Advertisements.
-- - Prevent internal-only listing events from being attached to
--   external email campaigns.
--
-- This migration:
-- - Does not create, schedule, or send any email.
-- - Does not change campaign or recipient records.
-- - Does not change the existing email-preference columns.
-- - Does not change Personal Follow-up or 10 AM scheduling.
-- ============================================================

begin;


-- ============================================================
-- PREFLIGHT
-- ============================================================

do $$
begin
  if to_regclass(
    'public.listing_email_events'
  ) is null
  then
    raise exception
      'Preflight failed: public.listing_email_events does not exist.';
  end if;

  if to_regclass(
    'public.email_campaigns'
  ) is null
  then
    raise exception
      'Preflight failed: public.email_campaigns does not exist.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'public.listing_email_events'::regclass
      and conname =
        'listing_email_events_type_check'
      and contype = 'c'
  )
  then
    raise exception
      'Preflight failed: listing_email_events_type_check was not found.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'public.email_campaigns'::regclass
      and conname =
        'email_campaigns_campaign_type_check'
      and contype = 'c'
  )
  then
    raise exception
      'Preflight failed: email_campaigns_campaign_type_check was not found.';
  end if;
end;
$$;


-- ============================================================
-- LISTING EVENT TYPE CONSTRAINT
--
-- Existing values are retained.
-- New external and internal-only values are added.
-- ============================================================

alter table public.listing_email_events
  drop constraint
    listing_email_events_type_check;

alter table public.listing_email_events
  add constraint
    listing_email_events_type_check
  check (
    event_type = any (
      array[
        -- Existing event values
        'open_house',
        'price_change',
        'new_video',
        'new_photos',
        'back_on_market',
        'showing_window',
        'seller_terms',
        'offer_deadline',
        'status_change',
        'manual',

        -- Approved external marketing events
        'coming_soon',
        'new_listing',
        'price_improvement',
        'contingent',
        'pending_under_contract',
        'just_sold',
        'broker_open',
        'virtual_tour',
        'seller_incentive',
        'rate_buydown',
        'best_and_final',

        -- Internal-only lifecycle events
        'withdrawn',
        'temporarily_off_market',
        'expired',
        'cancelled'
      ]::text[]
    )
  );


-- ============================================================
-- EVENT-TO-PREFERENCE CATEGORY MAPPING
--
-- email_campaigns.campaign_type remains the existing broad
-- preference category used by recipient eligibility safeguards.
--
-- Returns:
-- - open_house
-- - price_change
-- - listing_ad
-- - null for internal-only events
-- ============================================================

create or replace function
  public.email_campaign_type_for_listing_event(
    p_event_type text
  )
returns text
language sql
immutable
set search_path = public, pg_temp
as $function$
  select
    case
      when lower(
        btrim(
          coalesce(
            p_event_type,
            ''
          )
        )
      ) in (
        'withdrawn',
        'temporarily_off_market',
        'expired',
        'cancelled'
      )
      then null

      when lower(
        btrim(
          coalesce(
            p_event_type,
            ''
          )
        )
      ) in (
        'open_house',
        'broker_open',
        'showing_window'
      )
      then 'open_house'

      when lower(
        btrim(
          coalesce(
            p_event_type,
            ''
          )
        )
      ) in (
        'price_change',
        'price_improvement'
      )
      then 'price_change'

      else 'listing_ad'
    end;
$function$;


comment on function
  public.email_campaign_type_for_listing_event(
    text
  )
is
  'Maps a detailed listing-email event to the existing broad recipient-preference category. Internal-only events return null.';


-- ============================================================
-- EXTERNAL CAMPAIGN EVENT SAFEGUARD
--
-- Enforces:
-- - Internal-only events cannot be linked to email campaigns.
-- - Linked external events must use the correct broad campaign
--   category so recipient preferences remain effective.
-- ============================================================

create or replace function
  public.enforce_listing_email_campaign_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  selected_event record;
  expected_campaign_type text;
begin
  if new.listing_event_id is null then
    return new;
  end if;

  select
    event_row.event_type,
    event_row.org_id,
    event_row.listing_id
  into
    selected_event
  from public.listing_email_events
    as event_row
  where event_row.id =
    new.listing_event_id;

  if not found then
    raise exception
      'The selected listing email event was not found.';
  end if;

  if new.org_id is distinct from
    selected_event.org_id
  then
    raise exception
      'The selected listing email event belongs to a different organization.';
  end if;

  if new.listing_id is distinct from
    selected_event.listing_id
  then
    raise exception
      'The selected listing email event belongs to a different listing.';
  end if;

  expected_campaign_type :=
    public.email_campaign_type_for_listing_event(
      selected_event.event_type
    );

  if expected_campaign_type is null then
    raise exception
      'Internal-only listing event % cannot be attached to an external email campaign.',
      selected_event.event_type;
  end if;

  if new.campaign_type <>
    expected_campaign_type
  then
    raise exception
      'Listing event % requires email campaign type %, not %.',
      selected_event.event_type,
      expected_campaign_type,
      new.campaign_type;
  end if;

  return new;
end;
$function$;


drop trigger if exists
  email_campaigns_enforce_listing_event
on public.email_campaigns;

create trigger
  email_campaigns_enforce_listing_event
before insert or update of
  listing_event_id,
  campaign_type,
  listing_id,
  org_id
on public.email_campaigns
for each row
execute function
  public.enforce_listing_email_campaign_event();


comment on function
  public.enforce_listing_email_campaign_event()
is
  'Blocks internal-only or mismatched listing events from external email campaigns and requires the correct organization, listing and recipient-preference campaign category.';


-- ============================================================
-- LINKED EVENT UPDATE SAFEGUARD
--
-- Prevents a linked event from later becoming internal-only or
-- becoming incompatible with its existing external campaign.
-- ============================================================

create or replace function
  public.enforce_linked_listing_email_event_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  expected_campaign_type text;
begin
  expected_campaign_type :=
    public.email_campaign_type_for_listing_event(
      new.event_type
    );

  if expected_campaign_type is null
    and exists (
      select 1
      from public.email_campaigns
        as campaign
      where campaign.listing_event_id =
        new.id
    )
  then
    raise exception
      'A listing event linked to an external email campaign cannot be changed to internal-only event %.',
      new.event_type;
  end if;

  if exists (
    select 1
    from public.email_campaigns
      as campaign
    where campaign.listing_event_id =
        new.id

      and (
        campaign.org_id is distinct from
          new.org_id

        or campaign.listing_id is distinct from
          new.listing_id

        or campaign.campaign_type is distinct from
          expected_campaign_type
      )
  )
  then
    raise exception
      'The listing event update is incompatible with an existing linked email campaign.';
  end if;

  return new;
end;
$function$;


drop trigger if exists
  listing_email_events_enforce_linked_campaign
on public.listing_email_events;

create trigger
  listing_email_events_enforce_linked_campaign
before update of
  event_type,
  org_id,
  listing_id
on public.listing_email_events
for each row
when (
  old.event_type is distinct from
    new.event_type

  or old.org_id is distinct from
    new.org_id

  or old.listing_id is distinct from
    new.listing_id
)
execute function
  public.enforce_linked_listing_email_event_update();


comment on function
  public.enforce_linked_listing_email_event_update()
is
  'Prevents a listing event linked to an external campaign from later becoming internal-only or incompatible with that campaign.';


commit;