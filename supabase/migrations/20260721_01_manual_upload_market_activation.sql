begin;

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
    where profile.id = reviewer_id
      and profile.role = 'platform_admin'
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
    jurisdiction.marketing_enabled as jurisdiction_marketing_enabled,
    jurisdiction.next_review_due as jurisdiction_next_review_due

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

  if market_record.launch_status <> 'approved'
     or market_record.jurisdiction_marketing_enabled <> true
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
    Approve only the manual-upload workflow.

    This does not represent a direct MLS feed, RETS connection,
    RESO API connection or permission to ingest third-party listings.
  */
  update public.mls_compliance_profiles
  set
    profile_status =
      'approved',

    marketing_enabled =
      true,

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

    last_rules_verified_at =
      activation_time,

    verified_by =
      reviewer_id,

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
          '%Manual-upload organization-market workflow approved.%'
        then notes

        else concat_ws(
          E'\n\n',
          nullif(
            notes,
            ''
          ),
          'Manual-upload organization-market workflow approved. No direct MLS feed is connected. Marketing is limited to organization-provided or listing-agent-authorized content.'
        )
      end

  where id =
    manual_profile_id;

  /*
    These tasks remain visible for later direct-MLS development
    and representative-material QA, but they do not block the
    current manual-upload launch.
  */
  update public.organization_market_launch_checklist_items
  set
    is_required =
      false,

    notes =
      case item_key
        when 'mls_feed_connection_configured'
        then
          'Not required for the approved manual-upload workflow. This becomes required before a direct MLS feed is enabled.'

        when 'mls_field_mapping_tested'
        then
          'Not required while listing data is reviewed and entered through the manual-upload workflow.'

        when 'samantha_mls_qa_completed'
        then
          'Deferred until Samantha is connected to a direct MLS or normalized automated listing-data feed.'

        when 'local_test_materials_reviewed'
        then
          'Retained as a nonblocking post-launch QA task for representative email, website, social and print materials.'

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

  /*
    Complete the items supported by existing verified licenses,
    configured organization branding, the approved manual-upload
    policy and the explicit activation action.
  */
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
          'Completed from the verified organization brokerage and responsible-broker record.'

        when 'agent_licenses_verified'
        then
          'Completed after confirming at least one verified active individual license for this organization and state.'

        when 'local_contact_branding_completed'
        then
          'The platform administrator confirmed the organization contact and branding configuration during market activation.'

        when 'mls_compliance_configured'
        then
          'Approved for the conservative manual-upload workflow only: no direct MLS feed and no automatic third-party listing ingestion.'

        when 'organization_admin_signoff_completed'
        then
          'Organization-market details were confirmed through the explicit activation action.'

        when 'platform_admin_market_activation_approved'
        then
          'Final market activation was explicitly approved by the platform administrator.'

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

  /*
    The existing organization-market trigger performs the final
    independent checks for state readiness, licenses, checklist
    completion, MLS/manual-upload profile approval and reviewer role.
  */
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
          '%Manual-upload market activation approved.%'
        then notes

        else concat_ws(
          E'\n\n',
          nullif(
            notes,
            ''
          ),
          'Manual-upload market activation approved. Direct MLS ingestion remains disabled until the feed, permissions, field mapping and Samantha MLS QA are completed.'
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
