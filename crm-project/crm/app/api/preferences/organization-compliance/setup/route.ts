import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../../lib/server/authenticatedProfile";

export const runtime = "nodejs";

const ADMIN_ROLES = new Set([
  "platform_admin",
  "admin",
  "org_admin",
]);

type JurisdictionRow = {
  id: string;
  code: string;
  state_code: string | null;
  name: string;
  jurisdiction_type: string;
  launch_status: string;
  marketing_enabled: boolean;
  current_rule_version: string | null;
};

type RuleSetRow = {
  id: string;
  jurisdiction_id: string;
  name: string;
  version: string;
  status: string;
  is_active: boolean;
  approved_at: string | null;
  created_at: string;
};

function assertOrganizationAdmin(
  role: string | null | undefined
) {
  if (!ADMIN_ROLES.has(String(role || ""))) {
    throw new RequestAuthError(
      "Administrator access is required to configure an organization state.",
      403
    );
  }
}

function isValidTimeZone(
  value: string
) {
  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: value,
      }
    ).format(new Date());

    return true;
  }
  catch {
    return false;
  }
}

function packageEntry(
  jurisdiction:
    | JurisdictionRow
    | null,
  ruleSets: RuleSetRow[]
) {
  if (!jurisdiction) {
    return null;
  }

  const matchingRuleSets =
    ruleSets.filter(
      (row) =>
        row.jurisdiction_id ===
        jurisdiction.id
    );

  const ruleSet =
    matchingRuleSets.find(
      (row) =>
        row.is_active &&
        row.status ===
          "approved"
    ) ||
    matchingRuleSets.find(
      (row) =>
        row.status ===
          "approved"
    ) ||
    matchingRuleSets[0] ||
    null;

  return {
    jurisdiction_id:
      jurisdiction.id,
    code:
      jurisdiction.code,
    state_code:
      jurisdiction.state_code,
    name:
      jurisdiction.name,
    launch_status:
      jurisdiction.launch_status,
    marketing_enabled:
      Boolean(
        jurisdiction.marketing_enabled
      ),
    current_rule_version:
      jurisdiction
        .current_rule_version,
    rule_set:
      ruleSet
        ? {
            id: ruleSet.id,
            name: ruleSet.name,
            version: ruleSet.version,
            status: ruleSet.status,
            is_active:
              Boolean(
                ruleSet.is_active
              ),
            approved_at:
              ruleSet.approved_at,
          }
        : null,
  };
}

async function loadSetup(
  organizationId: string
) {
  const [
    organizationResult,
    jurisdictionResult,
    marketResult,
    ruleSetResult,
    licenseResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select(`
        id,
        name,
        org_display,
        market_name,
        state,
        timezone,
        marketing_license_state
      `)
      .eq("id", organizationId)
      .single(),

    supabaseAdmin
      .from(
        "marketing_jurisdictions"
      )
      .select(`
        id,
        code,
        state_code,
        name,
        jurisdiction_type,
        launch_status,
        marketing_enabled,
        current_rule_version
      `)
      .eq("country_code", "US")
      .in(
        "jurisdiction_type",
        ["federal", "state"]
      )
      .order("name", {
        ascending: true,
      }),

    supabaseAdmin
      .from(
        "organization_markets"
      )
      .select(`
        id,
        jurisdiction_id,
        market_name,
        market_status,
        marketing_enabled
      `)
      .eq(
        "organization_id",
        organizationId
      ),

    supabaseAdmin
      .from(
        "marketing_compliance_rule_sets"
      )
      .select(`
        id,
        jurisdiction_id,
        name,
        version,
        status,
        is_active,
        approved_at,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      }),

    supabaseAdmin
      .from(
        "organization_real_estate_licenses"
      )
      .select(`
        id,
        jurisdiction_id,
        licensed_business_name,
        brokerage_license_number,
        license_status,
        verified_at
      `)
      .eq(
        "organization_id",
        organizationId
      )
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (
    organizationResult.error ||
    !organizationResult.data
  ) {
    throw new Error(
      organizationResult.error
        ?.message ||
      "Organization not found."
    );
  }

  if (jurisdictionResult.error) {
    throw new Error(
      jurisdictionResult
        .error.message
    );
  }

  if (marketResult.error) {
    throw new Error(
      marketResult.error.message
    );
  }

  if (ruleSetResult.error) {
    throw new Error(
      ruleSetResult.error.message
    );
  }

  if (licenseResult.error) {
    throw new Error(
      licenseResult.error.message
    );
  }

  const organization =
    organizationResult.data;

  const jurisdictions =
    (jurisdictionResult.data ||
      []) as JurisdictionRow[];

  const states =
    jurisdictions.filter(
      (row) =>
        row.jurisdiction_type ===
        "state"
    );

  const federal =
    jurisdictions.find(
      (row) =>
        row.code === "US-FED"
    ) || null;

  const markets =
    marketResult.data || [];

  const stateIdSet =
    new Set(
      states.map(
        (state) => state.id
      )
    );

  const selectedMarket =
    markets.find(
      (market) =>
        stateIdSet.has(
          String(
            market.jurisdiction_id
          )
        )
    ) || null;

  const selectedState =
    states.find(
      (state) =>
        state.id ===
        selectedMarket
          ?.jurisdiction_id
    ) ||
    states.find(
      (state) =>
        state.state_code ===
        organization.state
    ) ||
    states.find(
      (state) =>
        state.name
          .toLowerCase() ===
        String(
          organization
            .marketing_license_state ||
          ""
        ).toLowerCase()
    ) ||
    null;

  const ruleSets =
    (ruleSetResult.data ||
      []) as RuleSetRow[];

  const selectedLicense =
    selectedState
      ? (
          licenseResult.data ||
          []
        ).find(
          (license) =>
            license
              .jurisdiction_id ===
            selectedState.id
        ) || null
      : null;

  return {
    ok: true,
    can_edit: true,

    organization: {
      ...organization,
      state_jurisdiction_id:
        selectedState?.id ||
        "",
    },

    jurisdictions:
      states,

    compliance_package: {
      federal:
        packageEntry(
          federal,
          ruleSets
        ),

      state:
        packageEntry(
          selectedState,
          ruleSets
        ),
    },

    organization_market: {
      federal:
        federal
          ? markets.find(
              (market) =>
                market
                  .jurisdiction_id ===
                federal.id
            ) || null
          : null,

      state:
        selectedMarket,
    },

    selected_license:
      selectedLicense,
  };
}

export async function GET(
  request: Request
) {
  try {
    const profile =
      await requireAuthenticatedProfile(
        request
      );

    assertOrganizationAdmin(
      profile.role
    );

    return NextResponse.json(
      await loadSetup(
        profile.org_id
      )
    );
  }
  catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Could not load organization compliance setup.",
      },
      {
        status:
          requestErrorStatus(error),
      }
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const profile =
      await requireAuthenticatedProfile(
        request
      );

    assertOrganizationAdmin(
      profile.role
    );

    const body =
      await request.json();

    const stateJurisdictionId =
      String(
        body
          ?.state_jurisdiction_id ||
        ""
      ).trim();

    const timeZone =
      String(
        body?.timezone || ""
      ).trim();

    if (!stateJurisdictionId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A state must be selected.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !timeZone ||
      !isValidTimeZone(timeZone)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid organization timezone must be selected.",
        },
        {
          status: 400,
        }
      );
    }

    const [
      selectedStateResult,
      federalResult,
      allStatesResult,
      organizationResult,
    ] = await Promise.all([
      supabaseAdmin
        .from(
          "marketing_jurisdictions"
        )
        .select(`
          id,
          code,
          state_code,
          name,
          jurisdiction_type
        `)
        .eq(
          "id",
          stateJurisdictionId
        )
        .eq(
          "country_code",
          "US"
        )
        .eq(
          "jurisdiction_type",
          "state"
        )
        .single(),

      supabaseAdmin
        .from(
          "marketing_jurisdictions"
        )
        .select(`
          id,
          code,
          name
        `)
        .eq("code", "US-FED")
        .eq(
          "jurisdiction_type",
          "federal"
        )
        .single(),

      supabaseAdmin
        .from(
          "marketing_jurisdictions"
        )
        .select("id")
        .eq(
          "country_code",
          "US"
        )
        .eq(
          "jurisdiction_type",
          "state"
        ),

      supabaseAdmin
        .from("organizations")
        .select(`
          id,
          name,
          org_display,
          market_name,
          marketing_licensed_business_name,
          marketing_broker_license_number
        `)
        .eq(
          "id",
          profile.org_id
        )
        .single(),
    ]);

    if (
      selectedStateResult.error ||
      !selectedStateResult.data
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The selected state is not a valid United States jurisdiction.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      federalResult.error ||
      !federalResult.data
    ) {
      throw new Error(
        federalResult.error
          ?.message ||
        "The United States Federal jurisdiction is missing."
      );
    }

    if (allStatesResult.error) {
      throw new Error(
        allStatesResult
          .error.message
      );
    }

    if (
      organizationResult.error ||
      !organizationResult.data
    ) {
      throw new Error(
        organizationResult.error
          ?.message ||
        "Organization not found."
      );
    }

    const selectedState =
      selectedStateResult.data;

    const federal =
      federalResult.data;

    const organization =
      organizationResult.data;

    const {
      error:
        organizationUpdateError,
    } = await supabaseAdmin
      .from("organizations")
      .update({
        state:
          selectedState.state_code,
        timezone:
          timeZone,
        marketing_license_state:
          selectedState.name,
      })
      .eq(
        "id",
        profile.org_id
      );

    if (
      organizationUpdateError
    ) {
      throw new Error(
        organizationUpdateError
          .message
      );
    }

    const otherStateIds =
      (
        allStatesResult.data ||
        []
      )
        .map(
          (row) =>
            String(row.id)
        )
        .filter(
          (id) =>
            id !==
            selectedState.id
        );

    if (
      otherStateIds.length > 0
    ) {
      const {
        error:
          oldMarketDeleteError,
      } = await supabaseAdmin
        .from(
          "organization_markets"
        )
        .delete()
        .eq(
          "organization_id",
          profile.org_id
        )
        .in(
          "jurisdiction_id",
          otherStateIds
        );

      if (
        oldMarketDeleteError
      ) {
        throw new Error(
          oldMarketDeleteError
            .message
        );
      }
    }

    const requiredJurisdictionIds =
      [
        federal.id,
        selectedState.id,
      ];

    const {
      data: existingMarkets,
      error:
        existingMarketsError,
    } = await supabaseAdmin
      .from(
        "organization_markets"
      )
      .select(
        "jurisdiction_id"
      )
      .eq(
        "organization_id",
        profile.org_id
      )
      .in(
        "jurisdiction_id",
        requiredJurisdictionIds
      );

    if (
      existingMarketsError
    ) {
      throw new Error(
        existingMarketsError
          .message
      );
    }

    const existingIds =
      new Set(
        (
          existingMarkets || []
        ).map(
          (row) =>
            String(
              row.jurisdiction_id
            )
        )
      );

    const displayName =
      organization.org_display ||
      organization.name ||
      "Organization";

    const marketsToInsert: Array<{
      organization_id: string;
      jurisdiction_id: string;
      market_name: string;
      market_status: "pending_review";
      marketing_enabled: boolean;
      notes: string;
    }> = [];

    if (
      !existingIds.has(
        String(federal.id)
      )
    ) {
      marketsToInsert.push({
        organization_id:
          profile.org_id,
        jurisdiction_id:
          federal.id,
        market_name:
          `${displayName} - Federal`,
        market_status:
          "pending_review",
        marketing_enabled:
          false,
        notes:
          "Federal compliance package attached automatically. Platform administration controls research, review and activation.",
      });
    }

    if (
      !existingIds.has(
        String(
          selectedState.id
        )
      )
    ) {
      marketsToInsert.push({
        organization_id:
          profile.org_id,
        jurisdiction_id:
          selectedState.id,
        market_name:
          `${displayName} - ${selectedState.name}`,
        market_status:
          "pending_review",
        marketing_enabled:
          false,
        notes:
          "State selected by the organization administrator. Platform administration controls the underlying state rule package.",
      });
    }

    if (
      marketsToInsert.length > 0
    ) {
      const {
        error: marketInsertError,
      } = await supabaseAdmin
        .from(
          "organization_markets"
        )
        .insert(
          marketsToInsert
        );

      if (marketInsertError) {
        throw new Error(
          marketInsertError
            .message
        );
      }
    }

    const {
      data: existingLicense,
      error:
        existingLicenseError,
    } = await supabaseAdmin
      .from(
        "organization_real_estate_licenses"
      )
      .select("id")
      .eq(
        "organization_id",
        profile.org_id
      )
      .eq(
        "jurisdiction_id",
        selectedState.id
      )
      .maybeSingle();

    if (
      existingLicenseError
    ) {
      throw new Error(
        existingLicenseError
          .message
      );
    }

    if (!existingLicense) {
      const {
        error:
          licenseInsertError,
      } = await supabaseAdmin
        .from(
          "organization_real_estate_licenses"
        )
        .insert({
          organization_id:
            profile.org_id,
          jurisdiction_id:
            selectedState.id,
          dba_name:
            organization
              .org_display ||
            organization.name ||
            null,
          licensed_business_name:
            organization
              .marketing_licensed_business_name ||
            null,
          brokerage_license_number:
            organization
              .marketing_broker_license_number ||
            null,
          license_status:
            "pending_review",
          notes:
            "Created automatically when the organization selected its state. Platform verification is required before activation.",
        });

      if (
        licenseInsertError
      ) {
        throw new Error(
          licenseInsertError
            .message
        );
      }
    }

    return NextResponse.json(
      await loadSetup(
        profile.org_id
      )
    );
  }
  catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Could not save organization compliance setup.",
      },
      {
        status:
          requestErrorStatus(error),
      }
    );
  }
}