import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

import {
  RequestAuthError,
  requireAuthenticatedProfile,
} from "../../../../lib/server/authenticatedProfile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RULE_SET_STATUSES = new Set([
  "draft",
  "in_review",
  "approved",
  "rejected",
  "expired",
  "retired",
]);

const REQUIREMENT_TYPES = new Set([
  "disclosure",
  "identity",
  "license",
  "placement",
  "font_size",
  "logo",
  "consent",
  "permission",
  "attribution",
  "record_retention",
  "approval",
  "prohibited_content",
  "audience_restriction",
  "image_disclosure",
  "data_freshness",
  "other",
]);

const REQUIREMENT_SEVERITIES =
  new Set([
    "informational",
    "warning",
    "blocking",
  ]);

const SOURCE_TYPES = new Set([
  "statute",
  "administrative_rule",
  "regulator",
  "official_guidance",
  "federal_agency",
  "mls",
  "broker_policy",
  "legal_review",
  "other",
]);

const SOURCE_ROLES = new Set([
  "primary",
  "supporting",
  "guidance",
  "interpretive",
  "verification",
]);

class ComplianceManagerError
  extends Error {
  status: number;

  constructor(
    message: string,
    status = 400
  ) {
    super(message);

    this.name =
      "ComplianceManagerError";

    this.status =
      status;
  }
}

function jsonError(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

function errorStatus(
  error: unknown
) {
  if (
    error instanceof
    RequestAuthError
  ) {
    return error.status;
  }

  if (
    error instanceof
    ComplianceManagerError
  ) {
    return error.status;
  }

  return 500;
}

function throwIfError(
  error:
    | {
        message?: string;
      }
    | null
    | undefined,
  fallback: string
) {
  if (error) {
    throw new Error(
      error.message ||
        fallback
    );
  }
}

function textValue(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function nullableText(
  value: unknown
) {
  const normalized =
    textValue(value);

  return normalized ||
    null;
}

function nullableDate(
  value: unknown
) {
  const normalized =
    textValue(value);

  if (!normalized) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized
    )
  ) {
    throw new ComplianceManagerError(
      "Dates must use YYYY-MM-DD format."
    );
  }

  return normalized;
}

function integerValue(
  value: unknown,
  fallback = 0
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return fallback;
  }

  return Math.trunc(
    parsed
  );
}

function booleanValue(
  value: unknown,
  fallback = false
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  return fallback;
}

function jsonObject(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return {};
  }

  if (
    typeof value ===
    "string"
  ) {
    try {
      const parsed =
        JSON.parse(value);

      if (
        !parsed ||
        Array.isArray(parsed) ||
        typeof parsed !==
          "object"
      ) {
        throw new Error();
      }

      return parsed;
    }
    catch {
      throw new ComplianceManagerError(
        "JSON fields must contain a valid JSON object."
      );
    }
  }

  if (
    Array.isArray(value) ||
    typeof value !==
      "object"
  ) {
    throw new ComplianceManagerError(
      "JSON fields must contain a valid JSON object."
    );
  }

  return value;
}

function requiredId(
  value: unknown,
  label: string
) {
  const normalized =
    textValue(value);

  if (!normalized) {
    throw new ComplianceManagerError(
      `${label} is required.`
    );
  }

  return normalized;
}

function allowedValue(
  value: unknown,
  allowed:
    Set<string>,
  label: string
) {
  const normalized =
    textValue(value);

  if (
    !allowed.has(
      normalized
    )
  ) {
    throw new ComplianceManagerError(
      `${label} is invalid.`
    );
  }

  return normalized;
}

async function requirePlatformAdmin(
  request: Request
) {
  const profile =
    await requireAuthenticatedProfile(
      request
    );

  if (
    profile.role !==
    "platform_admin"
  ) {
    throw new RequestAuthError(
      "Platform-admin access is required.",
      403
    );
  }

  return profile;
}

async function loadRuleSet(
  ruleSetId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "marketing_compliance_rule_sets"
    )
    .select("*")
    .eq(
      "id",
      ruleSetId
    )
    .single();

  if (
    error ||
    !data
  ) {
    throw new ComplianceManagerError(
      error?.message ||
        "Rule pack not found.",
      404
    );
  }

  return data as any;
}

async function loadJurisdiction(
  jurisdictionId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "marketing_jurisdictions"
    )
    .select("*")
    .eq(
      "id",
      jurisdictionId
    )
    .single();

  if (
    error ||
    !data
  ) {
    throw new ComplianceManagerError(
      error?.message ||
        "Jurisdiction not found.",
      404
    );
  }

  return data as any;
}

async function loadManagerIndex() {
  const [
    jurisdictionResult,
    ruleSetResult,
  ] = await Promise.all([
    supabaseAdmin
      .from(
        "marketing_jurisdictions"
      )
      .select(`
        id,
        code,
        country_code,
        state_code,
        name,
        jurisdiction_type,
        launch_status,
        marketing_enabled,
        current_rule_version,
        review_cycle_months,
        last_reviewed_at,
        next_review_due
      `)
      .eq(
        "country_code",
        "US"
      )
      .in(
        "jurisdiction_type",
        [
          "federal",
          "state",
        ]
      )
      .order(
        "jurisdiction_type",
        {
          ascending: true,
        }
      )
      .order(
        "name",
        {
          ascending: true,
        }
      ),

    supabaseAdmin
      .from(
        "marketing_compliance_rule_sets"
      )
      .select(`
        id,
        jurisdiction_id,
        channel,
        material_type,
        campaign_type,
        name,
        version,
        status,
        is_active,
        effective_date,
        expiration_date,
        last_reviewed_at,
        next_review_due,
        approved_at,
        requires_broker_approval,
        requires_legal_review,
        legal_reviewed_at,
        broker_reviewed_at,
        created_at,
        updated_at
      `)
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),
  ]);

  throwIfError(
    jurisdictionResult.error,
    "Could not load jurisdictions."
  );

  throwIfError(
    ruleSetResult.error,
    "Could not load rule packs."
  );

  return {
    ok: true,
    jurisdictions:
      jurisdictionResult.data ||
      [],
    rule_sets:
      ruleSetResult.data ||
      [],
  };
}

async function loadRuleSetDetails(
  ruleSetId: string
) {
  const ruleSet =
    await loadRuleSet(
      ruleSetId
    );

  const [
    jurisdictionResult,
    requirementResult,
    sourceResult,
    checklistResult,
  ] = await Promise.all([
    supabaseAdmin
      .from(
        "marketing_jurisdictions"
      )
      .select("*")
      .eq(
        "id",
        ruleSet
          .jurisdiction_id
      )
      .single(),

    supabaseAdmin
      .from(
        "marketing_compliance_requirements"
      )
      .select("*")
      .eq(
        "rule_set_id",
        ruleSetId
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      ),

    supabaseAdmin
      .from(
        "marketing_compliance_rule_sources"
      )
      .select("*")
      .eq(
        "rule_set_id",
        ruleSetId
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      ),

    supabaseAdmin
      .from(
        "marketing_state_launch_checklist_items"
      )
      .select("*")
      .eq(
        "jurisdiction_id",
        ruleSet
          .jurisdiction_id
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      ),
  ]);

  throwIfError(
    jurisdictionResult.error,
    "Could not load the jurisdiction."
  );

  throwIfError(
    requirementResult.error,
    "Could not load requirements."
  );

  throwIfError(
    sourceResult.error,
    "Could not load official sources."
  );

  throwIfError(
    checklistResult.error,
    "Could not load the review checklist."
  );

  const requirements =
    (
      requirementResult.data ||
      []
    ) as any[];

  const sources =
    (
      sourceResult.data ||
      []
    ) as any[];

  const checklist =
    (
      checklistResult.data ||
      []
    ) as any[];

  let links: any[] = [];

  if (
    requirements.length >
    0
  ) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "marketing_compliance_requirement_sources"
      )
      .select("*")
      .in(
        "requirement_id",
        requirements.map(
          (requirement) =>
            requirement.id
        )
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    throwIfError(
      error,
      "Could not load requirement citations."
    );

    links =
      (data || []) as any[];
  }

  const linkedRequirementIds =
    new Set(
      links.map(
        (link) =>
          String(
            link.requirement_id
          )
      )
    );

  const requiredRequirementIds =
    new Set(
      requirements
        .filter(
          (requirement) =>
            requirement
              .is_required
        )
        .map(
          (requirement) =>
            String(
              requirement.id
            )
        )
    );

  const requiredUnlinked =
    requirements.filter(
      (requirement) =>
        requirement.is_required &&
        !linkedRequirementIds.has(
          String(
            requirement.id
          )
        )
    );

  const blockingSourceIds =
    new Set(
      links
        .filter(
          (link) =>
            requiredRequirementIds.has(
              String(
                link.requirement_id
              )
            ) &&
            [
              "primary",
              "verification",
            ].includes(
              String(
                link.source_role ||
                ""
              )
            )
        )
        .map(
          (link) =>
            String(
              link.source_id
            )
        )
    );

  const hasExplicitBlockingSources =
    blockingSourceIds.size >
    0;

  function sourceIsBlocking(
    source: any
  ) {
    if (
      !hasExplicitBlockingSources
    ) {
      return true;
    }

    return blockingSourceIds.has(
      String(
        source.id
      )
    );
  }

  function sourceIsVerified(
    source: any
  ) {
    const manualVerification =
      Boolean(
        source
          .last_verified_at &&
        source.verified_by
      );

    const monitoringStatus =
      String(
        source
          .last_check_status ||
        ""
      );

    const samanthaVerification =
      Boolean(
        source
          .last_checked_at &&
        source
          .last_content_hash &&
        [
          "first_snapshot",
          "unchanged",
          "unavailable",
          "unsupported",
          "error",
        ].includes(
          monitoringStatus
        )
      );

    return (
      manualVerification ||
      samanthaVerification
    );
  }

  const blockingSources =
    sources.filter(
      sourceIsBlocking
    );

  const supplementalComplianceSources =
    sources.filter(
      (source) =>
        !sourceIsBlocking(
          source
        )
    );

  const unverifiedSources =
    blockingSources.filter(
      (source) =>
        !sourceIsVerified(
          source
        )
    );

  const unverifiedSupplementalSources =
    supplementalComplianceSources.filter(
      (source) =>
        !sourceIsVerified(
          source
        )
    );

  const effectiveSources =
    sources.map(
      (source) => ({
        ...source,

        is_blocking:
          sourceIsBlocking(
            source
          ),

        compliance_role:
          sourceIsBlocking(
            source
          )
            ? "controlling"
            : "supplemental",
      })
    );

  const legalReviewComplete =
    !ruleSet
      .requires_legal_review ||
    Boolean(
      ruleSet
        .legal_reviewed_at &&
      ruleSet
        .legal_reviewed_by
    );

  const brokerReviewComplete =
    !ruleSet
      .requires_broker_approval ||
    Boolean(
      ruleSet
        .broker_reviewed_at &&
      ruleSet
        .broker_reviewed_by
    );

  const metadataComplete =
    Boolean(
      ruleSet
        .effective_date &&
      ruleSet
        .next_review_due
    );

  const allSourcesVerified =
    blockingSources.length >
      0 &&
    unverifiedSources.length ===
      0;

  const allRequiredRulesLinked =
    requirements.length >
      0 &&
    requiredUnlinked.length ===
      0;

  let supplementalRequirements:
    any[] =
    [];

  let supplementalSources:
    any[] =
    [];

  const currentJurisdiction =
    jurisdictionResult
      .data as any;

  if (
    currentJurisdiction
      ?.jurisdiction_type ===
    "state"
  ) {
    const {
      data:
        federalJurisdiction,
      error:
        federalJurisdictionError,
    } = await supabaseAdmin
      .from(
        "marketing_jurisdictions"
      )
      .select(
        "id"
      )
      .eq(
        "code",
        "US-FED"
      )
      .maybeSingle();

    throwIfError(
      federalJurisdictionError,
      "Could not load Federal compliance evidence."
    );

    if (
      federalJurisdiction
        ?.id
    ) {
      const {
        data:
          federalRuleSets,
        error:
          federalRuleSetError,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .select(`
          id,
          is_active,
          status,
          approved_at,
          created_at
        `)
        .eq(
          "jurisdiction_id",
          federalJurisdiction.id
        )
        .order(
          "is_active",
          {
            ascending:
              false,
          }
        )
        .order(
          "approved_at",
          {
            ascending:
              false,
          }
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(1);

      throwIfError(
        federalRuleSetError,
        "Could not load the Federal rule package."
      );

      const federalRuleSet =
        federalRuleSets?.[0] ||
        null;

      if (
        federalRuleSet?.id
      ) {
        const [
          federalRequirementsResult,
          federalSourcesResult,
        ] = await Promise.all([
          supabaseAdmin
            .from(
              "marketing_compliance_requirements"
            )
            .select(`
              requirement_key,
              label,
              description,
              requirement_type,
              disclosure_template
            `)
            .eq(
              "rule_set_id",
              federalRuleSet.id
            ),

          supabaseAdmin
            .from(
              "marketing_compliance_rule_sources"
            )
            .select(`
              title,
              citation,
              issuing_authority,
              notes
            `)
            .eq(
              "rule_set_id",
              federalRuleSet.id
            ),
        ]);

        throwIfError(
          federalRequirementsResult.error,
          "Could not load Federal requirements."
        );

        throwIfError(
          federalSourcesResult.error,
          "Could not load Federal sources."
        );

        supplementalRequirements =
          federalRequirementsResult
            .data ||
          [];

        supplementalSources =
          federalSourcesResult
            .data ||
          [];
      }
    }
  }

  const requirementEvidenceText =
    [
      ...requirements.map(
        (requirement) =>
          [
            requirement
              .requirement_key,
            requirement.label,
            requirement
              .description,
            requirement
              .requirement_type,
            requirement
              .disclosure_template,
          ]
            .filter(Boolean)
            .join(" ")
      ),

      ...supplementalRequirements.map(
        (requirement) =>
          [
            requirement
              .requirement_key,
            requirement.label,
            requirement
              .description,
            requirement
              .requirement_type,
            requirement
              .disclosure_template,
          ]
            .filter(Boolean)
            .join(" ")
      ),

      ...sources.map(
        (source) =>
          [
            source.title,
            source.citation,
            source
              .issuing_authority,
            source.notes,
          ]
            .filter(Boolean)
            .join(" ")
      ),

      ...supplementalSources.map(
        (source) =>
          [
            source.title,
            source.citation,
            source
              .issuing_authority,
            source.notes,
          ]
            .filter(Boolean)
            .join(" ")
      ),
    ]
      .join(" ")
      .toLowerCase();

  function hasRequirementEvidence(
    ...terms: string[]
  ) {
    return terms.some(
      (term) =>
        requirementEvidenceText
          .includes(
            term.toLowerCase()
          )
    );
  }

  const disclosureRulesComplete =
    requirements.some(
      (requirement) =>
        requirement
          .requirement_type ===
          "disclosure" ||
        Boolean(
          requirement
            .disclosure_template
        )
    );

  const automaticChecklistByKey =
    new Map<
      string,
      {
        complete: boolean;
        reason: string;
      }
    >([
      [
        "official_sources_reviewed",
        {
          complete:
            allSourcesVerified,

          reason:
            allSourcesVerified
              ? "Samantha successfully verified every controlling official source. Supplemental guidance remains monitored separately."
              : "Waiting for every controlling official source to complete a successful Samantha check.",
        },
      ],

      [
        "advertising_rules_documented",
        {
          complete:
            allRequiredRulesLinked,

          reason:
            allRequiredRulesLinked
              ? "The rule package contains documented requirements with official citations."
              : "Waiting for documented requirements and complete official-source citations.",
        },
      ],

      [
        "required_disclosures_configured",
        {
          complete:
            disclosureRulesComplete &&
            allRequiredRulesLinked,

          reason:
            disclosureRulesComplete &&
            allRequiredRulesLinked
              ? "Required disclosure rules are configured and linked to official sources."
              : "Waiting for required disclosure rules and their official citations.",
        },
      ],

      [
        "agent_license_requirements_configured",
        {
          complete:
            hasRequirementEvidence(
              "license"
            ) &&
            allRequiredRulesLinked,

          reason:
            hasRequirementEvidence(
              "license"
            ) &&
            allRequiredRulesLinked
              ? "Agent and license requirements are represented in the rule package."
              : "Waiting for agent-license requirements in the rule package.",
        },
      ],

      [
        "channel_rules_reviewed",
        {
          complete:
            allRequiredRulesLinked,

          reason:
            allRequiredRulesLinked
              ? "The active rule package supplies cited requirements to connected marketing channels."
              : "Waiting for every required rule to have an official citation.",
        },
      ],

      [
        "fair_housing_confirmed",
        {
          complete:
            (
              hasRequirementEvidence(
                "fair housing",
                "fair_housing"
              )
            ) &&
            allRequiredRulesLinked,

          reason:
            (
              hasRequirementEvidence(
                "fair housing",
                "fair_housing"
              )
            ) &&
            allRequiredRulesLinked
              ? "Fair Housing protections are documented in the cited rule package."
              : "Waiting for documented Fair Housing requirements.",
        },
      ],

      [
        "privacy_tcp_dnc_reviewed",
        {
          complete:
            (
              hasRequirementEvidence(
                "privacy",
                "tcpa",
                "telemarketing",
                "do-not-call",
                "do not call",
                "dnc"
              )
            ) &&
            allRequiredRulesLinked,

          reason:
            (
              hasRequirementEvidence(
                "privacy",
                "tcpa",
                "telemarketing",
                "do-not-call",
                "do not call",
                "dnc"
              )
            ) &&
            allRequiredRulesLinked
              ? "Privacy, consent, texting, calling and Do-Not-Call requirements are documented."
              : "Waiting for privacy, consent, TCPA or Do-Not-Call requirements.",
        },
      ],

      [
        "legal_broker_review_completed",
        {
          complete:
            legalReviewComplete &&
            brokerReviewComplete,

          reason:
            legalReviewComplete &&
            brokerReviewComplete
              ? "No additional review is required, or all configured reviews are recorded."
              : "A configured legal or responsible-broker review is still required.",
        },
      ],

      [
        "rule_version_recorded",
        {
          complete:
            metadataComplete,

          reason:
            metadataComplete
              ? "The effective date and next review date are recorded."
              : "Waiting for the effective date and next review date.",
        },
      ],
    ]);

  const nonBlockingChecklistKeys =
    new Set([
      "brokerage_identity_completed",
      "mls_feed_connection_configured",
      "mls_field_mapping_tested",
      "mls_compliance_configured",
      "samantha_mls_qa_completed",
      "test_materials_reviewed",
    ]);

  const effectiveChecklist =
    checklist.map(
      (item) => {
        const key =
          String(
            item.item_key ||
            ""
          );

        const automatic =
          automaticChecklistByKey.get(
            key
          );

        const nonBlocking =
          nonBlockingChecklistKeys.has(
            key
          );

        const nonBlockingReason =
          key ===
          "brokerage_identity_completed"
            ? "Organization and agent license records are completed and enforced separately in License Validation."
            : key ===
                "test_materials_reviewed"
            ? "Channel-specific material QA will occur when that marketing channel is used. It does not block the state rule package."
            : "This is a future MLS integration checkpoint. It does not block email or property-website compliance launch.";

        return {
          ...item,

          is_completed:
            Boolean(
              item.is_completed ||
              automatic
                ?.complete
            ),

          automatic_completion:
            Boolean(
              automatic ||
              nonBlocking
            ),

          automation_reason:
            automatic
              ?.reason ||
            (
              nonBlocking
                ? nonBlockingReason
                : null
            ),

          is_blocking:
            !nonBlocking,
        };
      }
    );

  const incompleteChecklist =
    effectiveChecklist.filter(
      (item) =>
        item.is_required &&
        item.is_blocking !==
          false &&
        !item.is_completed
    );

  const incompleteApprovalChecklist =
    incompleteChecklist.filter(
      (item) =>
        item.item_key !==
        "platform_admin_approval_completed"
    );

  const researchComplete =
    requirements.length >
      0 &&
    blockingSources.length >
      0 &&
    requiredUnlinked.length ===
      0 &&
    unverifiedSources.length ===
      0;

  const approvalReady =
    researchComplete &&
    metadataComplete &&
    legalReviewComplete &&
    brokerReviewComplete &&
    incompleteApprovalChecklist
      .length === 0;

  const activationReady =
    approvalReady &&
    incompleteChecklist.length ===
      0 &&
    ruleSet.status ===
      "approved";

  return {
    ok: true,

    jurisdiction:
      jurisdictionResult.data,

    rule_set:
      ruleSet,

    requirements,

    sources:
      effectiveSources,

    links,
    checklist:
      effectiveChecklist,

    readiness: {
      requirement_count:
        requirements.length,

      source_count:
        sources.length,

      blocking_source_count:
        blockingSources.length,

      supplemental_source_count:
        supplementalComplianceSources
          .length,

      unverified_supplemental_source_count:
        unverifiedSupplementalSources
          .length,

      linked_requirement_count:
        linkedRequirementIds
          .size,

      unlinked_required_count:
        requiredUnlinked
          .length,

      unverified_source_count:
        unverifiedSources
          .length,

      incomplete_checklist_count:
        incompleteChecklist
          .length,

      incomplete_preapproval_checklist_count:
        incompleteApprovalChecklist
          .length,

      legal_review_complete:
        legalReviewComplete,

      broker_review_complete:
        brokerReviewComplete,

      metadata_complete:
        metadataComplete,

      research_complete:
        researchComplete,

      approval_ready:
        approvalReady,

      activation_ready:
        activationReady,
    },
  };
}

async function assertEditableRuleSet(
  ruleSetId: string
) {
  const ruleSet =
    await loadRuleSet(
      ruleSetId
    );

  if (
    ruleSet.is_active
  ) {
    throw new ComplianceManagerError(
      "An active rule pack must be deactivated before it can be edited.",
      409
    );
  }

  if (
    [
      "approved",
      "expired",
      "retired",
    ].includes(
      ruleSet.status
    )
  ) {
    throw new ComplianceManagerError(
      "Approved, expired and retired rule packs cannot be edited directly. Create a new version instead.",
      409
    );
  }

  return ruleSet;
}

async function assertRequirementBelongs(
  requirementId: string,
  ruleSetId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "marketing_compliance_requirements"
    )
    .select(
      "id, rule_set_id"
    )
    .eq(
      "id",
      requirementId
    )
    .eq(
      "rule_set_id",
      ruleSetId
    )
    .single();

  if (
    error ||
    !data
  ) {
    throw new ComplianceManagerError(
      "Requirement not found in this rule pack.",
      404
    );
  }

  return data;
}

async function assertSourceBelongs(
  sourceId: string,
  ruleSetId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "marketing_compliance_rule_sources"
    )
    .select(
      "id, rule_set_id"
    )
    .eq(
      "id",
      sourceId
    )
    .eq(
      "rule_set_id",
      ruleSetId
    )
    .single();

  if (
    error ||
    !data
  ) {
    throw new ComplianceManagerError(
      "Official source not found in this rule pack.",
      404
    );
  }

  return data;
}

function todayIsoDate() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10
    );
}

function addMonthsToIsoDate(
  value: string,
  months: number
) {
  const date =
    new Date(
      `${value}T00:00:00Z`
    );

  const originalDay =
    date.getUTCDate();

  date.setUTCDate(1);

  date.setUTCMonth(
    date.getUTCMonth() +
    Math.max(
      1,
      months
    )
  );

  const lastDay =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() +
          1,
        0
      )
    ).getUTCDate();

  date.setUTCDate(
    Math.min(
      originalDay,
      lastDay
    )
  );

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

async function finalizeRoutineRuleSet(
  ruleSetId: string,
  reviewerId: string
) {
  const ruleSet =
    await loadRuleSet(
      ruleSetId
    );

  const jurisdiction =
    await loadJurisdiction(
      ruleSet
        .jurisdiction_id
    );

  if (
    ruleSet.status ===
      "approved" &&
    ruleSet.is_active
  ) {
    return loadRuleSetDetails(
      ruleSetId
    );
  }

  if (
    ![
      "draft",
      "rejected",
      "in_review",
    ].includes(
      ruleSet.status
    )
  ) {
    throw new ComplianceManagerError(
      `The ${jurisdiction.name} package cannot be finalized from status ${ruleSet.status}.`,
      409
    );
  }

  const details =
    await loadRuleSetDetails(
      ruleSetId
    );

  if (
    !details
      .readiness
      .research_complete
  ) {
    throw new ComplianceManagerError(
      `${jurisdiction.name} is not ready: requirements, citations or verified source baselines are incomplete.`
    );
  }

  const {
    data:
      materialFindings,
    error:
      materialFindingsError,
  } = await supabaseAdmin
    .from(
      "marketing_compliance_audit_findings"
    )
    .select(`
      id,
      title,
      finding_type
    `)
    .eq(
      "rule_set_id",
      ruleSetId
    )
    .eq(
      "finding_status",
      "open"
    )
    .in(
      "finding_type",
      [
        "content_change",
        "effective_date_change",
        "potential_requirement_change",
      ]
    );

  throwIfError(
    materialFindingsError,
    "Could not check material compliance findings."
  );

  if (
    materialFindings &&
    materialFindings.length >
      0
  ) {
    throw new ComplianceManagerError(
      `${jurisdiction.name} has an unresolved material or uncertain legal-change finding. Review that finding before activation.`,
      409
    );
  }

  const automaticallyResolvedKeys =
    new Set([
      "rule_version_recorded",
      "legal_broker_review_completed",
      "platform_admin_approval_completed",
    ]);

  const remainingItems =
    details.checklist.filter(
      (item: any) =>
        item.is_required &&
        item.is_blocking !==
          false &&
        !item.is_completed &&
        !automaticallyResolvedKeys
          .has(
            String(
              item.item_key ||
              ""
            )
          )
    );

  if (
    remainingItems.length >
    0
  ) {
    throw new ComplianceManagerError(
      `${jurisdiction.name} still requires: ${remainingItems
        .map(
          (item: any) =>
            item.label
        )
        .join(", ")}.`
    );
  }

  const today =
    todayIsoDate();

  const reviewMonths =
    Number(
      jurisdiction
        .review_cycle_months ||
      12
    );

  const nextReviewDue =
    ruleSet
      .next_review_due ||
    addMonthsToIsoDate(
      today,
      reviewMonths
    );

  const now =
    new Date()
      .toISOString();

  const configuration =
    ruleSet
      .configuration &&
    typeof ruleSet
      .configuration ===
      "object" &&
    !Array.isArray(
      ruleSet
        .configuration
    )
      ? ruleSet
          .configuration
      : {};

  const {
    error:
      siblingUpdateError,
  } = await supabaseAdmin
    .from(
      "marketing_compliance_rule_sets"
    )
    .update({
      is_active:
        false,
    })
    .eq(
      "jurisdiction_id",
      ruleSet
        .jurisdiction_id
    )
    .eq(
      "channel",
      ruleSet.channel
    )
    .eq(
      "material_type",
      ruleSet
        .material_type
    )
    .eq(
      "campaign_type",
      ruleSet
        .campaign_type
    )
    .neq(
      "id",
      ruleSetId
    );

  throwIfError(
    siblingUpdateError,
    "Could not deactivate the previous rule-package version."
  );

  const {
    error:
      ruleSetUpdateError,
  } = await supabaseAdmin
    .from(
      "marketing_compliance_rule_sets"
    )
    .update({
      status:
        "approved",

      is_active:
        true,

      effective_date:
        ruleSet
          .effective_date ||
        today,

      next_review_due:
        nextReviewDue,

      requires_legal_review:
        false,

      requires_broker_approval:
        false,

      legal_reviewed_by:
        null,

      legal_reviewed_at:
        null,

      broker_reviewed_by:
        null,

      broker_reviewed_at:
        null,

      reviewed_by:
        reviewerId,

      last_reviewed_at:
        now,

      approved_by:
        reviewerId,

      approved_at:
        now,

      configuration: {
        ...configuration,

        automation_policy: {
          mode:
            "routine_baseline",

          routine_changes:
            "automatic",

          material_or_uncertain_changes:
            "human_review_required",

          finalized_by:
            reviewerId,

          finalized_at:
            now,
        },
      },
    })
    .eq(
      "id",
      ruleSetId
    );

  throwIfError(
    ruleSetUpdateError,
    `Could not finalize the ${jurisdiction.name} rule package.`
  );

  const automaticallyCompletedIds =
    details.checklist
      .filter(
        (item: any) =>
          item.is_required &&
          (
            item.is_completed ||
            automaticallyResolvedKeys
              .has(
                String(
                  item.item_key ||
                  ""
                )
              )
          )
      )
      .map(
        (item: any) =>
          item.id
      );

  if (
    automaticallyCompletedIds
      .length >
    0
  ) {
    const {
      error:
        checklistUpdateError,
    } = await supabaseAdmin
      .from(
        "marketing_state_launch_checklist_items"
      )
      .update({
        is_completed:
          true,

        completed_by:
          reviewerId,

        completed_at:
          now,

        notes:
          "Completed by Samantha's routine-baseline finalization workflow. Material or uncertain legal changes still require human review.",
      })
      .in(
        "id",
        automaticallyCompletedIds
      );

    throwIfError(
      checklistUpdateError,
      "Could not record automatically completed checklist items."
    );
  }

  const {
    error:
      jurisdictionUpdateError,
  } = await supabaseAdmin
    .from(
      "marketing_jurisdictions"
    )
    .update({
      launch_status:
        "approved",

      marketing_enabled:
        true,

      current_rule_version:
        ruleSet.version,

      approved_by:
        reviewerId,

      approved_at:
        now,

      last_reviewed_at:
        now,

      next_review_due:
        nextReviewDue,
    })
    .eq(
      "id",
      ruleSet
        .jurisdiction_id
    );

  throwIfError(
    jurisdictionUpdateError,
    `Could not activate ${jurisdiction.name} marketing compliance.`
  );

  return loadRuleSetDetails(
    ruleSetId
  );
}

async function finalizeFederalAndIdaho(
  idahoRuleSetId: string,
  reviewerId: string
) {
  const idahoRuleSet =
    await loadRuleSet(
      idahoRuleSetId
    );

  const idahoJurisdiction =
    await loadJurisdiction(
      idahoRuleSet
        .jurisdiction_id
    );

  if (
    idahoJurisdiction.code !==
    "US-ID"
  ) {
    throw new ComplianceManagerError(
      "The Federal and Idaho pilot can only be finalized from the Idaho package."
    );
  }

  const {
    data:
      federalJurisdiction,
    error:
      federalJurisdictionError,
  } = await supabaseAdmin
    .from(
      "marketing_jurisdictions"
    )
    .select(
      "id"
    )
    .eq(
      "code",
      "US-FED"
    )
    .single();

  throwIfError(
    federalJurisdictionError,
    "The Federal compliance jurisdiction could not be loaded."
  );

  if (
    !federalJurisdiction
      ?.id
  ) {
    throw new ComplianceManagerError(
      "The Federal compliance jurisdiction is missing."
    );
  }

  const {
    data:
      federalRuleSets,
    error:
      federalRuleSetError,
  } = await supabaseAdmin
    .from(
      "marketing_compliance_rule_sets"
    )
    .select(`
      id,
      is_active,
      status,
      created_at
    `)
    .eq(
      "jurisdiction_id",
      federalJurisdiction.id
    )
    .order(
      "is_active",
      {
        ascending:
          false,
      }
    )
    .order(
      "created_at",
      {
        ascending:
          false,
      }
    )
    .limit(1);

  throwIfError(
    federalRuleSetError,
    "The Federal rule package could not be loaded."
  );

  const federalRuleSet =
    federalRuleSets?.[0] ||
    null;

  if (
    !federalRuleSet?.id
  ) {
    throw new ComplianceManagerError(
      "The Federal baseline rule package is missing."
    );
  }

  await finalizeRoutineRuleSet(
    federalRuleSet.id,
    reviewerId
  );

  return finalizeRoutineRuleSet(
    idahoRuleSetId,
    reviewerId
  );
}
async function updateJurisdictionMarketingState(
  jurisdictionId: string
) {
  const {
    data: activeRuleSets,
    error,
  } = await supabaseAdmin
    .from(
      "marketing_compliance_rule_sets"
    )
    .select(
      "id, version"
    )
    .eq(
      "jurisdiction_id",
      jurisdictionId
    )
    .eq(
      "is_active",
      true
    )
    .eq(
      "status",
      "approved"
    )
    .order(
      "approved_at",
      {
        ascending: false,
      }
    )
    .limit(1);

  throwIfError(
    error,
    "Could not recalculate jurisdiction activation."
  );

  const activeRuleSet =
    activeRuleSets?.[0] ||
    null;

  const {
    error: updateError,
  } = await supabaseAdmin
    .from(
      "marketing_jurisdictions"
    )
    .update({
      marketing_enabled:
        Boolean(
          activeRuleSet
        ),

      current_rule_version:
        activeRuleSet
          ?.version ||
        null,

      launch_status:
        activeRuleSet
          ? "approved"
          : "pending_review",
    })
    .eq(
      "id",
      jurisdictionId
    );

  throwIfError(
    updateError,
    "Could not update jurisdiction activation."
  );
}

export async function GET(
  request: Request
) {
  try {
    await requirePlatformAdmin(
      request
    );

    const url =
      new URL(
        request.url
      );

    const ruleSetId =
      textValue(
        url.searchParams.get(
          "ruleSetId"
        )
      );

    if (ruleSetId) {
      return NextResponse.json(
        await loadRuleSetDetails(
          ruleSetId
        ),
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      await loadManagerIndex(),
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
  catch (error: any) {
    console.error(
      "Compliance manager GET error:",
      error
    );

    return jsonError(
      error?.message ||
        "Could not load the compliance manager.",
      errorStatus(error)
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const profile =
      await requirePlatformAdmin(
        request
      );

    const body =
      await request.json();

    const action =
      textValue(
        body?.action
      );

    if (!action) {
      throw new ComplianceManagerError(
        "A compliance-manager action is required."
      );
    }

    if (
      action ===
      "create_rule_set"
    ) {
      const jurisdictionId =
        requiredId(
          body
            ?.jurisdiction_id,
          "Jurisdiction"
        );

      const jurisdiction =
        await loadJurisdiction(
          jurisdictionId
        );

      if (
        ![
          "federal",
          "state",
        ].includes(
          jurisdiction
            .jurisdiction_type
        )
      ) {
        throw new ComplianceManagerError(
          "Only Federal and state rule packs are supported."
        );
      }

      const name =
        textValue(
          body?.name
        );

      const version =
        textValue(
          body?.version
        );

      if (
        !name ||
        !version
      ) {
        throw new ComplianceManagerError(
          "Rule-pack name and version are required."
        );
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .insert({
          jurisdiction_id:
            jurisdictionId,

          channel:
            textValue(
              body?.channel
            ) || "all",

          material_type:
            textValue(
              body
                ?.material_type
            ) || "all",

          campaign_type:
            textValue(
              body
                ?.campaign_type
            ) || "all",

          name,
          version,

          status:
            "draft",

          is_active:
            false,

          effective_date:
            nullableDate(
              body
                ?.effective_date
            ),

          expiration_date:
            nullableDate(
              body
                ?.expiration_date
            ),

          next_review_due:
            nullableDate(
              body
                ?.next_review_due
            ),

          requires_legal_review:
            booleanValue(
              body
                ?.requires_legal_review,
              true
            ),

          requires_broker_approval:
            booleanValue(
              body
                ?.requires_broker_approval,
              false
            ),

          notes:
            nullableText(
              body?.notes
            ),

          configuration:
            jsonObject(
              body
                ?.configuration
            ),
        })
        .select("id")
        .single();

      throwIfError(
        error,
        "Could not create the rule pack."
      );

      return NextResponse.json(
        await loadRuleSetDetails(
          String(
            data?.id
          )
        )
      );
    }

    const ruleSetId =
      requiredId(
        body
          ?.rule_set_id,
        "Rule pack"
      );

    if (
      action ===
      "finalize_pilot"
    ) {
      return NextResponse.json(
        await finalizeFederalAndIdaho(
          ruleSetId,
          profile.id
        ),
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    if (
      action ===
      "save_rule_set"
    ) {
      await assertEditableRuleSet(
        ruleSetId
      );

      const name =
        textValue(
          body?.name
        );

      const version =
        textValue(
          body?.version
        );

      if (
        !name ||
        !version
      ) {
        throw new ComplianceManagerError(
          "Rule-pack name and version are required."
        );
      }

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .update({
          channel:
            textValue(
              body?.channel
            ) || "all",

          material_type:
            textValue(
              body
                ?.material_type
            ) || "all",

          campaign_type:
            textValue(
              body
                ?.campaign_type
            ) || "all",

          name,
          version,

          effective_date:
            nullableDate(
              body
                ?.effective_date
            ),

          expiration_date:
            nullableDate(
              body
                ?.expiration_date
            ),

          next_review_due:
            nullableDate(
              body
                ?.next_review_due
            ),

          requires_legal_review:
            booleanValue(
              body
                ?.requires_legal_review,
              true
            ),

          requires_broker_approval:
            booleanValue(
              body
                ?.requires_broker_approval,
              false
            ),

          notes:
            nullableText(
              body?.notes
            ),

          configuration:
            jsonObject(
              body
                ?.configuration
            ),
        })
        .eq(
          "id",
          ruleSetId
        );

      throwIfError(
        error,
        "Could not save the rule pack."
      );
    }
    else if (
      action ===
      "save_requirement"
    ) {
      await assertEditableRuleSet(
        ruleSetId
      );

      const requirementId =
        textValue(
          body
            ?.requirement_id
        );

      const requirementKey =
        textValue(
          body
            ?.requirement_key
        );

      const label =
        textValue(
          body?.label
        );

      if (
        !requirementKey ||
        !label
      ) {
        throw new ComplianceManagerError(
          "Requirement key and label are required."
        );
      }

      const payload = {
        rule_set_id:
          ruleSetId,

        requirement_key:
          requirementKey,

        label,

        description:
          nullableText(
            body
              ?.description
          ),

        requirement_type:
          allowedValue(
            body
              ?.requirement_type ||
              "disclosure",
            REQUIREMENT_TYPES,
            "Requirement type"
          ),

        severity:
          allowedValue(
            body
              ?.severity ||
              "blocking",
            REQUIREMENT_SEVERITIES,
            "Requirement severity"
          ),

        is_required:
          booleanValue(
            body
              ?.is_required,
            true
          ),

        sort_order:
          integerValue(
            body
              ?.sort_order,
            0
          ),

        applies_when:
          jsonObject(
            body
              ?.applies_when
          ),

        configuration:
          jsonObject(
            body
              ?.configuration
          ),

        disclosure_template:
          nullableText(
            body
              ?.disclosure_template
          ),
      };

      if (requirementId) {
        await assertRequirementBelongs(
          requirementId,
          ruleSetId
        );

        const {
          error,
        } = await supabaseAdmin
          .from(
            "marketing_compliance_requirements"
          )
          .update(payload)
          .eq(
            "id",
            requirementId
          );

        throwIfError(
          error,
          "Could not update the requirement."
        );
      }
      else {
        const {
          error,
        } = await supabaseAdmin
          .from(
            "marketing_compliance_requirements"
          )
          .insert(
            payload
          );

        throwIfError(
          error,
          "Could not create the requirement."
        );
      }
    }
    else if (
      action ===
      "delete_requirement"
    ) {
      await assertEditableRuleSet(
        ruleSetId
      );

      const requirementId =
        requiredId(
          body
            ?.requirement_id,
          "Requirement"
        );

      await assertRequirementBelongs(
        requirementId,
        ruleSetId
      );

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_requirements"
        )
        .delete()
        .eq(
          "id",
          requirementId
        );

      throwIfError(
        error,
        "Could not delete the requirement."
      );
    }
    else if (
      action ===
      "save_source"
    ) {
      await assertEditableRuleSet(
        ruleSetId
      );

      const sourceId =
        textValue(
          body?.source_id
        );

      const title =
        textValue(
          body?.title
        );

      if (!title) {
        throw new ComplianceManagerError(
          "Official-source title is required."
        );
      }

      const payload:
        Record<
          string,
          unknown
        > = {
          rule_set_id:
            ruleSetId,

          source_type:
            allowedValue(
              body
                ?.source_type ||
                "regulator",
              SOURCE_TYPES,
              "Source type"
            ),

          title,

          source_url:
            nullableText(
              body
                ?.source_url
            ),

          citation:
            nullableText(
              body?.citation
            ),

          issuing_authority:
            nullableText(
              body
                ?.issuing_authority
            ),

          effective_date:
            nullableDate(
              body
                ?.effective_date
            ),

          expiration_date:
            nullableDate(
              body
                ?.expiration_date
            ),

          archived_copy_url:
            nullableText(
              body
                ?.archived_copy_url
            ),

          notes:
            nullableText(
              body?.notes
            ),
        };

      if (
        Object.prototype
          .hasOwnProperty
          .call(
            body,
            "verified"
          )
      ) {
        const verified =
          booleanValue(
            body?.verified,
            false
          );

        payload.last_verified_at =
          verified
            ? new Date()
                .toISOString()
            : null;

        payload.verified_by =
          verified
            ? profile.id
            : null;
      }

      if (sourceId) {
        await assertSourceBelongs(
          sourceId,
          ruleSetId
        );

        const {
          error,
        } = await supabaseAdmin
          .from(
            "marketing_compliance_rule_sources"
          )
          .update(payload)
          .eq(
            "id",
            sourceId
          );

        throwIfError(
          error,
          "Could not update the official source."
        );
      }
      else {
        const {
          error,
        } = await supabaseAdmin
          .from(
            "marketing_compliance_rule_sources"
          )
          .insert(
            payload
          );

        throwIfError(
          error,
          "Could not create the official source."
        );
      }
    }
    else if (
      action ===
      "delete_source"
    ) {
      await assertEditableRuleSet(
        ruleSetId
      );

      const sourceId =
        requiredId(
          body?.source_id,
          "Official source"
        );

      await assertSourceBelongs(
        sourceId,
        ruleSetId
      );

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sources"
        )
        .delete()
        .eq(
          "id",
          sourceId
        );

      throwIfError(
        error,
        "Could not delete the official source."
      );
    }
    else if (
      action ===
      "save_link"
    ) {
      await assertEditableRuleSet(
        ruleSetId
      );

      const requirementId =
        requiredId(
          body
            ?.requirement_id,
          "Requirement"
        );

      const sourceId =
        requiredId(
          body?.source_id,
          "Official source"
        );

      await Promise.all([
        assertRequirementBelongs(
          requirementId,
          ruleSetId
        ),

        assertSourceBelongs(
          sourceId,
          ruleSetId
        ),
      ]);

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_requirement_sources"
        )
        .upsert(
          {
            requirement_id:
              requirementId,

            source_id:
              sourceId,

            source_role:
              allowedValue(
                body
                  ?.source_role ||
                  "primary",
                SOURCE_ROLES,
                "Citation role"
              ),

            pinpoint_citation:
              nullableText(
                body
                  ?.pinpoint_citation
              ),

            notes:
              nullableText(
                body?.notes
              ),
          },
          {
            onConflict:
              "requirement_id,source_id",
          }
        );

      throwIfError(
        error,
        "Could not save the requirement citation."
      );
    }
    else if (
      action ===
      "delete_link"
    ) {
      await assertEditableRuleSet(
        ruleSetId
      );

      const linkId =
        requiredId(
          body?.link_id,
          "Citation link"
        );

      const details =
        await loadRuleSetDetails(
          ruleSetId
        );

      const belongs =
        details.links.some(
          (link: any) =>
            link.id ===
            linkId
        );

      if (!belongs) {
        throw new ComplianceManagerError(
          "Citation link not found in this rule pack.",
          404
        );
      }

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_requirement_sources"
        )
        .delete()
        .eq(
          "id",
          linkId
        );

      throwIfError(
        error,
        "Could not delete the citation link."
      );
    }
    else if (
      action ===
      "save_checklist_item"
    ) {
      const ruleSet =
        await loadRuleSet(
          ruleSetId
        );

      const checklistItemId =
        requiredId(
          body
            ?.checklist_item_id,
          "Checklist item"
        );

      const {
        data: checklistItem,
        error:
          checklistLoadError,
      } = await supabaseAdmin
        .from(
          "marketing_state_launch_checklist_items"
        )
        .select(
          "id, item_key, jurisdiction_id, is_completed"
        )
        .eq(
          "id",
          checklistItemId
        )
        .eq(
          "jurisdiction_id",
          ruleSet
            .jurisdiction_id
        )
        .single();

      if (
        checklistLoadError ||
        !checklistItem
      ) {
        throw new ComplianceManagerError(
          "Checklist item not found for this jurisdiction.",
          404
        );
      }

      const requestedCompletion =
        booleanValue(
          body
            ?.is_completed,
          Boolean(
            checklistItem
              .is_completed
          )
        );

      if (
        checklistItem
          .item_key ===
          "platform_admin_approval_completed" &&
        requestedCompletion !==
          Boolean(
            checklistItem
              .is_completed
          )
      ) {
        throw new ComplianceManagerError(
          "The platform-admin approval checkpoint is controlled automatically by the Approve action."
        );
      }

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_state_launch_checklist_items"
        )
        .update({
          is_completed:
            requestedCompletion,

          completed_by:
            requestedCompletion
              ? profile.id
              : null,

          completed_at:
            requestedCompletion
              ? new Date()
                  .toISOString()
              : null,

          evidence_url:
            nullableText(
              body
                ?.evidence_url
            ),

          official_source_url:
            nullableText(
              body
                ?.official_source_url
            ),

          rule_reference:
            nullableText(
              body
                ?.rule_reference
            ),

          notes:
            nullableText(
              body?.notes
            ),
        })
        .eq(
          "id",
          checklistItemId
        );

      throwIfError(
        error,
        "Could not update the checklist item."
      );
    }
    else if (
      action ===
      "submit_review"
    ) {
      const ruleSet =
        await loadRuleSet(
          ruleSetId
        );

      if (
        ![
          "draft",
          "rejected",
        ].includes(
          ruleSet.status
        )
      ) {
        throw new ComplianceManagerError(
          "Only draft or rejected rule packs can be submitted for review.",
          409
        );
      }

      const details =
        await loadRuleSetDetails(
          ruleSetId
        );

      if (
        !details
          .readiness
          .research_complete
      ) {
        throw new ComplianceManagerError(
          "Before review, add requirements, verify all official sources and link every required requirement to at least one source."
        );
      }

      const now =
        new Date()
          .toISOString();

      const {
        error:
          ruleSetUpdateError,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .update({
          status:
            "in_review",

          reviewed_by:
            profile.id,

          last_reviewed_at:
            now,

          approved_by:
            null,

          approved_at:
            null,
        })
        .eq(
          "id",
          ruleSetId
        );

      throwIfError(
        ruleSetUpdateError,
        "Could not submit the rule pack for review."
      );

      const {
        error:
          jurisdictionUpdateError,
      } = await supabaseAdmin
        .from(
          "marketing_jurisdictions"
        )
        .update({
          launch_status:
            "in_review",

          marketing_enabled:
            false,
        })
        .eq(
          "id",
          ruleSet
            .jurisdiction_id
        );

      throwIfError(
        jurisdictionUpdateError,
        "Could not update jurisdiction review status."
      );
    }
    else if (
      action ===
      "record_legal_review"
    ) {
      const ruleSet =
        await loadRuleSet(
          ruleSetId
        );

      if (
        ruleSet.status !==
        "in_review"
      ) {
        throw new ComplianceManagerError(
          "Legal review can only be recorded while the rule pack is in review.",
          409
        );
      }

      const completed =
        booleanValue(
          body?.completed,
          true
        );

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .update({
          legal_reviewed_by:
            completed
              ? profile.id
              : null,

          legal_reviewed_at:
            completed
              ? new Date()
                  .toISOString()
              : null,
        })
        .eq(
          "id",
          ruleSetId
        );

      throwIfError(
        error,
        "Could not update legal review."
      );
    }
    else if (
      action ===
      "record_broker_review"
    ) {
      const ruleSet =
        await loadRuleSet(
          ruleSetId
        );

      if (
        ruleSet.status !==
        "in_review"
      ) {
        throw new ComplianceManagerError(
          "Broker review can only be recorded while the rule pack is in review.",
          409
        );
      }

      const completed =
        booleanValue(
          body?.completed,
          true
        );

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .update({
          broker_reviewed_by:
            completed
              ? profile.id
              : null,

          broker_reviewed_at:
            completed
              ? new Date()
                  .toISOString()
              : null,
        })
        .eq(
          "id",
          ruleSetId
        );

      throwIfError(
        error,
        "Could not update broker review."
      );
    }
    else if (
      action ===
      "reject"
    ) {
      const ruleSet =
        await loadRuleSet(
          ruleSetId
        );

      if (
        ruleSet.status !==
        "in_review"
      ) {
        throw new ComplianceManagerError(
          "Only a rule pack currently in review can be rejected.",
          409
        );
      }

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .update({
          status:
            "rejected",

          is_active:
            false,

          approved_by:
            null,

          approved_at:
            null,
        })
        .eq(
          "id",
          ruleSetId
        );

      throwIfError(
        error,
        "Could not reject the rule pack."
      );

      await updateJurisdictionMarketingState(
        ruleSet
          .jurisdiction_id
      );
    }
    else if (
      action ===
      "approve"
    ) {
      const ruleSet =
        await loadRuleSet(
          ruleSetId
        );

      if (
        ruleSet.status !==
        "in_review"
      ) {
        throw new ComplianceManagerError(
          "Only a rule pack currently in review can be approved.",
          409
        );
      }

      const details =
        await loadRuleSetDetails(
          ruleSetId
        );

      if (
        !details
          .readiness
          .approval_ready
      ) {
        throw new ComplianceManagerError(
          "Approval is locked until metadata, official sources, requirement citations, required checklist items and required reviews are complete."
        );
      }

      const now =
        new Date()
          .toISOString();

      const {
        error:
          ruleSetUpdateError,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .update({
          status:
            "approved",

          is_active:
            false,

          approved_by:
            profile.id,

          approved_at:
            now,

          reviewed_by:
            profile.id,

          last_reviewed_at:
            now,
        })
        .eq(
          "id",
          ruleSetId
        );

      throwIfError(
        ruleSetUpdateError,
        "Could not approve the rule pack."
      );

      const {
        error:
          checklistUpdateError,
      } = await supabaseAdmin
        .from(
          "marketing_state_launch_checklist_items"
        )
        .update({
          is_completed:
            true,

          completed_by:
            profile.id,

          completed_at:
            now,

          notes:
            "Completed automatically when the platform administrator approved the rule pack.",
        })
        .eq(
          "jurisdiction_id",
          ruleSet
            .jurisdiction_id
        )
        .eq(
          "item_key",
          "platform_admin_approval_completed"
        );

      throwIfError(
        checklistUpdateError,
        "Could not complete the platform approval checkpoint."
      );

      const {
        error:
          jurisdictionUpdateError,
      } = await supabaseAdmin
        .from(
          "marketing_jurisdictions"
        )
        .update({
          launch_status:
            "approved",

          marketing_enabled:
            false,

          current_rule_version:
            ruleSet.version,

          approved_by:
            profile.id,

          approved_at:
            now,

          last_reviewed_at:
            now,

          next_review_due:
            ruleSet
              .next_review_due,
        })
        .eq(
          "id",
          ruleSet
            .jurisdiction_id
        );

      throwIfError(
        jurisdictionUpdateError,
        "Could not approve the jurisdiction."
      );
    }
    else if (
      action ===
      "activate"
    ) {
      const ruleSet =
        await loadRuleSet(
          ruleSetId
        );

      if (
        ruleSet.status !==
        "approved"
      ) {
        throw new ComplianceManagerError(
          "Only an approved rule pack can be activated.",
          409
        );
      }

      const details =
        await loadRuleSetDetails(
          ruleSetId
        );

      if (
        !details
          .readiness
          .activation_ready
      ) {
        throw new ComplianceManagerError(
          "Activation is locked until every approval safeguard and required checklist item is complete."
        );
      }

      if (
        ruleSet
          .expiration_date
      ) {
        const expiration =
          new Date(
            `${ruleSet.expiration_date}T23:59:59`
          );

        if (
          !Number.isNaN(
            expiration
              .getTime()
          ) &&
          expiration
            .getTime() <
            Date.now()
        ) {
          throw new ComplianceManagerError(
            "An expired rule pack cannot be activated."
          );
        }
      }

      const {
        error:
          siblingUpdateError,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .update({
          is_active:
            false,
        })
        .eq(
          "jurisdiction_id",
          ruleSet
            .jurisdiction_id
        )
        .eq(
          "channel",
          ruleSet.channel
        )
        .eq(
          "material_type",
          ruleSet
            .material_type
        )
        .eq(
          "campaign_type",
          ruleSet
            .campaign_type
        )
        .neq(
          "id",
          ruleSetId
        );

      throwIfError(
        siblingUpdateError,
        "Could not deactivate the previous rule-pack version."
      );

      const {
        error:
          activeUpdateError,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .update({
          is_active:
            true,
        })
        .eq(
          "id",
          ruleSetId
        );

      throwIfError(
        activeUpdateError,
        "Could not activate the rule pack."
      );

      const now =
        new Date()
          .toISOString();

      const {
        error:
          jurisdictionUpdateError,
      } = await supabaseAdmin
        .from(
          "marketing_jurisdictions"
        )
        .update({
          launch_status:
            "approved",

          marketing_enabled:
            true,

          current_rule_version:
            ruleSet.version,

          approved_by:
            profile.id,

          approved_at:
            ruleSet
              .approved_at ||
            now,

          last_reviewed_at:
            now,

          next_review_due:
            ruleSet
              .next_review_due,
        })
        .eq(
          "id",
          ruleSet
            .jurisdiction_id
        );

      throwIfError(
        jurisdictionUpdateError,
        "Could not activate jurisdiction marketing."
      );
    }
    else if (
      action ===
      "deactivate"
    ) {
      const ruleSet =
        await loadRuleSet(
          ruleSetId
        );

      if (
        !ruleSet.is_active
      ) {
        throw new ComplianceManagerError(
          "This rule pack is already inactive.",
          409
        );
      }

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .update({
          is_active:
            false,
        })
        .eq(
          "id",
          ruleSetId
        );

      throwIfError(
        error,
        "Could not deactivate the rule pack."
      );

      await updateJurisdictionMarketingState(
        ruleSet
          .jurisdiction_id
      );
    }
    else if (
      action ===
      "retire"
    ) {
      const ruleSet =
        await loadRuleSet(
          ruleSetId
        );

      if (
        ruleSet.status ===
        "retired"
      ) {
        throw new ComplianceManagerError(
          "This rule pack is already retired.",
          409
        );
      }

      const {
        error,
      } = await supabaseAdmin
        .from(
          "marketing_compliance_rule_sets"
        )
        .update({
          status:
            "retired",

          is_active:
            false,
        })
        .eq(
          "id",
          ruleSetId
        );

      throwIfError(
        error,
        "Could not retire the rule pack."
      );

      await updateJurisdictionMarketingState(
        ruleSet
          .jurisdiction_id
      );
    }
    else {
      throw new ComplianceManagerError(
        `Unsupported compliance-manager action: ${action}`
      );
    }

    return NextResponse.json(
      await loadRuleSetDetails(
        ruleSetId
      ),
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
  catch (error: any) {
    console.error(
      "Compliance manager POST error:",
      error
    );

    return jsonError(
      error?.message ||
        "Could not complete the compliance-manager action.",
      errorStatus(error)
    );
  }
}
