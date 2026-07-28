-- ============================================================
-- CONTACT CATEGORY FOUNDATION
-- Stage 1: additive and backward compatible
-- ============================================================

begin;

-- ------------------------------------------------------------
-- NEW CONDITIONAL CONTACT FIELDS
-- ------------------------------------------------------------

alter table public.contacts
  add column if not exists relationship_status text null,
  add column if not exists prospect_temperature text null,
  add column if not exists is_archived boolean not null default false;

comment on column public.contacts.relationship_status is
  'Conditional relationship status for Buyer, Seller, Buyer & Seller, and applicable consumer relationships.';

comment on column public.contacts.prospect_temperature is
  'Samantha-managed Hot, Warm, or Cold rating for Prospect contacts.';

comment on column public.contacts.is_archived is
  'Universal archive flag. Archived contacts are excluded from marketing delivery.';


-- ------------------------------------------------------------
-- CONTACT CATEGORY VALUES
--
-- consumer and vendor remain temporarily allowed as legacy
-- values until the Contacts and Campaigns interfaces are fully
-- migrated.
--
-- builder remains database-valid for the future referral-vendor
-- directory but will not be offered as an email-marketing
-- audience.
-- ------------------------------------------------------------

alter table public.contacts
  drop constraint if exists contacts_contact_type_check;

alter table public.contacts
  add constraint contacts_contact_type_check
  check (
    contact_type = any (
      array[
        'prospect',
        'buyer',
        'seller',
        'buyer_seller',
        'past_client',
        'sphere',
        'realtor',
        'lender',
        'builder',
        'vendor_partner',
        'title_escrow',
        'professional',
        'other',

        -- Temporary legacy values
        'consumer',
        'vendor'
      ]::text[]
    )
  );

alter table public.contacts
  alter column contact_type
  set default 'prospect';


-- ------------------------------------------------------------
-- RELATIONSHIP STATUS
-- ------------------------------------------------------------

alter table public.contacts
  drop constraint if exists contacts_relationship_status_check;

alter table public.contacts
  add constraint contacts_relationship_status_check
  check (
    relationship_status is null
    or relationship_status = any (
      array[
        'active',
        'under_contract',
        'lost'
      ]::text[]
    )
  );


-- ------------------------------------------------------------
-- PROSPECT TEMPERATURE
-- ------------------------------------------------------------

alter table public.contacts
  drop constraint if exists contacts_prospect_temperature_check;

alter table public.contacts
  add constraint contacts_prospect_temperature_check
  check (
    prospect_temperature is null
    or prospect_temperature = any (
      array[
        'hot',
        'warm',
        'cold'
      ]::text[]
    )
  );


-- ------------------------------------------------------------
-- BACKFILL ARCHIVE FLAG
-- ------------------------------------------------------------

update public.contacts
set is_archived = true
where lifecycle_stage = 'archived'
  and is_archived = false;


-- ------------------------------------------------------------
-- BACKFILL LEGACY CONTACT TYPES
-- ------------------------------------------------------------

update public.contacts
set contact_type = 'vendor_partner'
where contact_type = 'vendor';


update public.contacts
set contact_type =
  case lifecycle_stage
    when 'prospect'
      then 'prospect'

    when 'active_buyer'
      then 'buyer'

    when 'active_seller'
      then 'seller'

    when 'closed_client'
      then 'past_client'

    when 'past_client'
      then 'past_client'

    when 'sphere'
      then 'sphere'

    when 'referral_partner'
      then 'vendor_partner'

    when 'lost'
      then 'prospect'

    else contact_type
  end
where contact_type = 'consumer';


-- ------------------------------------------------------------
-- BACKFILL CONDITIONAL STATUS
-- ------------------------------------------------------------

update public.contacts
set relationship_status =
  case lifecycle_stage
    when 'active_buyer'
      then 'active'

    when 'active_seller'
      then 'active'

    when 'under_contract'
      then 'under_contract'

    when 'lost'
      then 'lost'

    else relationship_status
  end
where relationship_status is null;


-- ------------------------------------------------------------
-- BACKFILL PROSPECT TEMPERATURE
--
-- Existing Prospect contacts default Hot unless they were
-- previously marked Lost.
-- ------------------------------------------------------------

update public.contacts
set prospect_temperature =
  case
    when lifecycle_stage = 'lost'
      then 'cold'

    else 'hot'
  end
where contact_type = 'prospect'
  and prospect_temperature is null;


-- ------------------------------------------------------------
-- FLAG ANY REMAINING LEGACY CONSUMERS FOR MANUAL REVIEW
-- ------------------------------------------------------------

update public.contacts
set contact_review_status = 'needs_review'
where contact_type = 'consumer';


-- ------------------------------------------------------------
-- USEFUL INDEXES
-- ------------------------------------------------------------

create index if not exists
  contacts_org_contact_category_idx
on public.contacts (
  org_id,
  contact_type
);


create index if not exists
  contacts_org_archived_idx
on public.contacts (
  org_id,
  is_archived
);


create index if not exists
  contacts_org_prospect_temperature_idx
on public.contacts (
  org_id,
  prospect_temperature
)
where prospect_temperature is not null;


commit;
