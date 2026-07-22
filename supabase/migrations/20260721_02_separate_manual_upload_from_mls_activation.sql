begin;

-- ============================================================
-- ORGANIZATION-MARKET ACTIVATION GUARD
--
-- An organization may operate under either:
--
-- 1. An approved and enabled MLS/feed compliance profile; or
-- 2. A strictly limited approved manual-upload workflow.
--
-- A manual-upload workflow does not represent an active MLS
-- connection and does not bypass future MLS rules, permission,
-- attribution, mapping, freshness or Samantha QA requirements.
-- ============================================================

create or replace function public.enforce_organization_market_activation_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  state_ready boolean;

  required_item_count integer;
  completed_item_count integer;

  brokerage_license_ready boolean;
  active_agent_license_count integer;
  eligible_listing_profile_count integer;

  platform_approval_ready boolean;
  approving_profile_is_platform_admin boolean;
begin
  if new.marketing_enabled = false
     and new.market_status <> 'active'
  then
    return new;
  end if;

  if new.market_status <> 'active' then
    raise exception
      'Organization-market activation blocked: market_status must be active.';
  end if;

  if new.marketing_enabled <> true then
    raise exception
      'Organization-market activation blocked: marketing_enabled must be true.';
  end if;

  select exists (
    select 1

    from public.marketing_jurisdictions jurisdiction

    where jurisdiction.id =
      new.jurisdiction_id

      and jurisdiction.jurisdiction_type =
        'state'

      and jurisdiction.launch_status =
        'approved'

      and jurisdiction.marketing_enabled =
        true

      and jurisdiction.next_review_due is not null

      and jurisdiction.next_review_due >=
        current_date
  )
  into state_ready;

  if state_ready = false then
    raise exception
      'Organization-market activation blocked: the parent state compliance pack is not approved, active and current.';
  end if;

  select
    count(*) filter (
      where checklist.is_required = true
    ),

    count(*) filter (
      where checklist.is_required = true
        and checklist.is_completed = true
    )

  into
    required_item_count,
    completed_item_count

  from public.organization_market_launch_checklist_items checklist

  where checklist.organization_market_id =
    new.id;

  if required_item_count = 0 then
    raise exception
      'Organization-market activation blocked: no local-market checklist exists.';
  end if;

  if completed_item_count <> required_item_count then
    raise exception
      'Organization-market activation blocked: % of % required local-market checklist items are complete.',
      completed_item_count,
      required_item_count;
  end if;

  select exists (
    select 1

    from public.organization_market_launch_checklist_items checklist

    join public.profiles profile
      on profile.id =
        checklist.completed_by

    where checklist.organization_market_id =
      new.id

      and checklist.item_key =
        'platform_admin_market_activation_approved'

      and checklist.is_completed =
        true

      and checklist.completed_at is not null

      and profile.role =
        'platform_admin'
  )
  into platform_approval_ready;

  if platform_approval_ready = false then
    raise exception
      'Organization-market activation blocked: final platform-admin checklist approval is incomplete.';
  end if;

  select exists (
    select 1

    from public.organization_real_estate_licenses license

    where license.organization_id =
      new.organization_id

      and license.jurisdiction_id =
        new.jurisdiction_id

      and license.license_status =
        'active'

      and nullif(
        trim(
          license.licensed_business_name
        ),
        ''
      ) is not null

      and nullif(
        trim(
          license.responsible_broker_name
        ),
        ''
      ) is not null

      and nullif(
        trim(
          license.regulator_source_url
        ),
        ''
      ) is not null

      and license.verified_by is not null
      and license.verified_at is not null

      and (
        license.expiration_date is null
        or license.expiration_date >=
          current_date
      )
  )
  into brokerage_license_ready;

  if brokerage_license_ready = false then
    raise exception
      'Organization-market activation blocked: a verified active organization brokerage license is required.';
  end if;

  select count(*)

  into active_agent_license_count

  from public.profile_real_estate_licenses license

  where license.organization_id =
    new.organization_id

    and license.jurisdiction_id =
      new.jurisdiction_id

    and license.license_status =
      'active'

    and nullif(
      trim(
        license.license_number
      ),
      ''
    ) is not null

    and license.verified_by is not null
    and license.verified_at is not null

    and (
      license.expiration_date is null
      or license.expiration_date >=
        current_date
    );

  if active_agent_license_count = 0 then
    raise exception
      'Organization-market activation blocked: at least one verified active agent license is required.';
  end if;

  /*
    Accept either:

    A fully enabled MLS/feed profile that passed the MLS guard;

    or

    A disabled-as-MLS but approved manual-upload policy with
    explicit restrictions against automatic MLS ingestion.
  */
  select count(*)

  into eligible_listing_profile_count

  from public.mls_compliance_profiles profile

  where profile.organization_market_id =
    new.id

    and profile.profile_status =
      'approved'

    and profile.approved_by is not null
    and profile.approved_at is not null

    and (
      (
        profile.marketing_enabled =
          true

        and profile.last_rules_verified_at
          is not null
      )

      or

      (
        profile.data_source_type in (
          'manual_upload',
          'manual_entry'
        )

        and profile.marketing_enabled =
          false

        and profile.connection_status =
          'disabled'

        and profile.rules_configuration @>
          '{
            "workflow": "manual_upload",
            "manual_workflow_approved": true,
            "direct_mls_feed_enabled": false,
            "automatic_third_party_ingestion": false,
            "requires_listing_authority_confirmation": true,
            "requires_media_rights_confirmation": true
          }'::jsonb

        and profile.public_display_allowed
          is not null

        and profile.email_marketing_allowed
          is not null

        and profile.social_marketing_allowed
          is not null

        and profile.print_marketing_allowed
          is not null

        and profile.samantha_use_allowed
          is not null

        and nullif(
          trim(
            profile.photo_use_policy
          ),
          ''
        ) is not null

        and nullif(
          trim(
            profile.third_party_listing_policy
          ),
          ''
        ) is not null

        and nullif(
          trim(
            profile.listing_permission_requirements
          ),
          ''
        ) is not null
      )
    );

  if eligible_listing_profile_count = 0 then
    raise exception
      'Organization-market activation blocked: an approved MLS/feed profile or approved restricted manual-upload workflow is required.';
  end if;

  if new.approved_by is null
     or new.approved_at is null
  then
    raise exception
      'Organization-market activation blocked: final approval information is incomplete.';
  end if;

  select exists (
    select 1

    from public.profiles profile

    where profile.id =
      new.approved_by

      and profile.role =
        'platform_admin'
  )
  into approving_profile_is_platform_admin;

  if approving_profile_is_platform_admin = false then
    raise exception
      'Organization-market activation blocked: final approval must be completed by a platform admin.';
  end if;

  if new.last_reviewed_at is null then
    raise exception
      'Organization-market activation blocked: last_reviewed_at is required.';
  end if;

  if new.next_review_due is null then
    raise exception
      'Organization-market activation blocked: next_review_due is required.';
  end if;

  if new.next_review_due < current_date then
    raise exception
      'Organization-market activation blocked: the local-market compliance review is overdue.';
  end if;

  return new;
end;
$function$;


-- ============================================================
-- RESTRICTED MANUAL-UPLOAD ACTIVATION
-- ============================================================

create or replace function public.activate_manual_upload_organization_market(
  requested_market_id uuid,
  reviewer_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  reviewer_is_platform_admin boolean;

  market_record record;

  manual_profile_id uuid;

  activation_time timestamptz :=
    now();

  review_due date;
begin
  select exists (
    select 1

    from public.profiles profile

    where profile.id =
      reviewer_id

      and profile.role =
        'platform_admin'
  )
  into reviewer_is_platform_admin;

  if reviewer_is_platform_admin = false then
    raise exception
      'Organization-market activation blocked: only a platform administrator may complete final activation.';
  end if;

  select
    market.id,
    market.organization_id,
    market.jurisdiction_id,

    jurisdiction.code as jurisdiction_code,
    jurisdiction.launch_status,

    jurisdiction.marketing_enabled
      as jurisdiction_marketing_enabled,

    jurisdiction.next_review_due
      as jurisdiction_next_review_due

  into market_record

  from public.organization_markets market

  join public.marketing_jurisdictions jurisdiction
    on jurisdiction.id =
      market.jurisdiction_id

  where market.id =
    requested_market_id;

  if not found then
    raise exception
      'Organization-market activation blocked: the organization market was not found.';
  end if;

  if market_record.launch_status <>
       'approved'

     or market_record
       .jurisdiction_marketing_enabled <>
       true
  then
    raise exception
      'Organization-market activation blocked: the parent state compliance package is not approved and active.';
  end if;

  perform public.seed_organization_market_launch_checklist(
    requested_market_id
  );

  select profile.id

  into manual_profile_id

  from public.mls_compliance_profiles profile

  where profile.organization_market_id =
    requested_market_id

    and profile.data_source_type in (
      'manual_upload',
      'manual_entry'
    )

  order by profile.created_at

  limit 1;

  if manual_profile_id is null then
    raise exception
      'Organization-market activation blocked: a manual-upload listing compliance profile is required.';
  end if;

  /*
    Approve the manual workflow while explicitly leaving the MLS
    profile disabled as an MLS data source.

    official_rules_url and last_rules_verified_at remain reserved
    for the future real MLS rules/feed approval.
  */
  update public.mls_compliance_profiles
  set
    profile_status =
      'approved',

    marketing_enabled =
      false,

    connection_status =
      'disabled',

    public_display_allowed =
      true,

    email_marketing_allowed =
      true,

    social_marketing_allowed =
      true,

    print_marketing_allowed =
      true,

    samantha_use_allowed =
      true,

    photo_use_policy =
      coalesce(
        nullif(
          trim(
            photo_use_policy
          ),
          ''
        ),
        'Only organization-provided or listing-agent-authorized photos, videos and media may be used.'
      ),

    third_party_listing_policy =
      coalesce(
        nullif(
          trim(
            third_party_listing_policy
          ),
          ''
        ),
        'No automatic third-party MLS ingestion or republication is permitted. Use only organization-owned listings or listing content uploaded with confirmed authorization.'
      ),

    listing_permission_requirements =
      coalesce(
        nullif(
          trim(
            listing_permission_requirements
          ),
          ''
        ),
        'The organization or advertising agent must confirm listing authority and rights to all uploaded descriptions, documents, photos, videos and other media before publication.'
      ),

    rules_configuration =
      coalesce(
        rules_configuration,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'workflow',
        'manual_upload',

        'manual_workflow_approved',
        true,

        'direct_mls_feed_enabled',
        false,

        'automatic_third_party_ingestion',
        false,

        'content_scope',
        'organization_provided_or_listing_agent_authorized',

        'requires_listing_authority_confirmation',
        true,

        'requires_media_rights_confirmation',
        true
      ),

    /*
      Do not claim the actual IMLS rules have been verified yet.
    */
    last_rules_verified_at =
      null,

    verified_by =
      null,

    approved_by =
      reviewer_id,

    approved_at =
      activation_time,

    notes =
      case
        when coalesce(
          notes,
          ''
        ) ilike
          '%Restricted manual-upload workflow approved.%'
        then notes

        else concat_ws(
          E'\n\n',
          nullif(
            notes,
            ''
          ),
          'Restricted manual-upload workflow approved. The MLS profile remains disabled as an MLS data source. No direct MLS feed or automatic third-party ingestion is authorized.'
        )
      end

  where id =
    manual_profile_id;

  update public.organization_market_launch_checklist_items
  set
    is_required =
      false,

    is_completed =
      false,

    completed_by =
      null,

    completed_at =
      null,

    notes =
      case item_key
        when 'mls_feed_connection_configured'
        then
          'Deferred until the real MLS feed is connected and verified.'

        when 'mls_field_mapping_tested'
        then
          'Deferred until the real MLS feed and normalized field mapping are tested.'

        when 'samantha_mls_qa_completed'
        then
          'Deferred until Samantha is connected to the real MLS or an approved automated listing-data feed.'

        when 'local_test_materials_reviewed'
        then
          'Retained as a visible nonblocking post-launch QA task.'

        else notes
      end

  where organization_market_id =
    requested_market_id

    and item_key in (
      'mls_feed_connection_configured',
      'mls_field_mapping_tested',
      'samantha_mls_qa_completed',
      'local_test_materials_reviewed'
    );

  update public.organization_market_launch_checklist_items
  set
    is_required =
      true,

    is_completed =
      true,

    completed_by =
      reviewer_id,

    completed_at =
      activation_time,

    notes =
      case item_key
        when 'organization_brokerage_identity_completed'
        then
          'Completed from the verified organization brokerage-license record.'

        when 'responsible_broker_verified'
        then
          'Completed from the verified responsible-broker record.'

        when 'agent_licenses_verified'
        then
          'Completed after confirming at least one verified active individual license for this organization and state.'

        when 'local_contact_branding_completed'
        then
          'The platform administrator confirmed the organization contact and branding configuration.'

        when 'mls_compliance_configured'
        then
          'A restricted manual-upload policy is configured. The MLS profile itself remains disabled pending official rules, permissions and feed approval.'

        when 'organization_admin_signoff_completed'
        then
          'Organization-market details were confirmed through the explicit activation action.'

        when 'platform_admin_market_activation_approved'
        then
          'Final restricted manual-upload market activation was explicitly approved by the platform administrator.'

        else notes
      end

  where organization_market_id =
    requested_market_id

    and item_key in (
      'organization_brokerage_identity_completed',
      'responsible_broker_verified',
      'agent_licenses_verified',
      'local_contact_branding_completed',
      'mls_compliance_configured',
      'organization_admin_signoff_completed',
      'platform_admin_market_activation_approved'
    );

  review_due =
    coalesce(
      market_record
        .jurisdiction_next_review_due,

      (
        current_date +
        interval '12 months'
      )::date
    );

  update public.organization_markets
  set
    market_status =
      'active',

    marketing_enabled =
      true,

    approved_by =
      reviewer_id,

    approved_at =
      coalesce(
        approved_at,
        activation_time
      ),

    last_reviewed_at =
      activation_time,

    next_review_due =
      review_due,

    notes =
      case
        when coalesce(
          notes,
          ''
        ) ilike
          '%Restricted manual-upload market activation approved.%'
        then notes

        else concat_ws(
          E'\n\n',
          nullif(
            notes,
            ''
          ),
          'Restricted manual-upload market activation approved. The MLS profile and direct MLS ingestion remain disabled until official MLS rules, permissions, connection, field mapping and Samantha MLS QA are completed.'
        )
      end

  where id =
    requested_market_id;
end;
$function$;

revoke all
on function public.activate_manual_upload_organization_market(
  uuid,
  uuid
)
from public;

revoke all
on function public.activate_manual_upload_organization_market(
  uuid,
  uuid
)
from anon;

revoke all
on function public.activate_manual_upload_organization_market(
  uuid,
  uuid
)
from authenticated;

grant execute
on function public.activate_manual_upload_organization_market(
  uuid,
  uuid
)
to service_role;

commit;
