import { NextResponse } from "next/server";

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../lib/server/authenticatedProfile";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

import {
  runAdvertisingComplianceAudit,
  type AdvertisingAuditType,
} from "../../../../lib/compliance/runAdvertisingComplianceAudit";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  300;

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

function errorResponse(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : "The compliance audit request failed.";

  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status:
        requestErrorStatus(
          error
        ),
    }
  );
}

export async function GET(
  request: Request
) {
  try {
    await requirePlatformAdmin(
      request
    );

    const [
      runResult,
      findingResult,
      sourceResult,
    ] =
      await Promise.all([
        supabaseAdmin
          .from(
            "marketing_compliance_audit_runs"
          )
          .select(`
            id,
            audit_type,
            scope,
            jurisdiction_id,
            requested_by,
            trigger_source,
            status,
            engine_version,
            model_name,
            source_count,
            checked_count,
            changed_count,
            unchanged_count,
            error_count,
            started_at,
            completed_at,
            summary,
            error_message,
            created_at,
            updated_at
          `)
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(25),

        supabaseAdmin
          .from(
            "marketing_compliance_audit_findings"
          )
          .select(`
            id,
            audit_run_id,
            source_check_id,
            source_id,
            jurisdiction_id,
            rule_set_id,
            finding_type,
            severity,
            finding_status,
            title,
            summary,
            effective_date,
            confidence,
            change_details,
            suggested_updates,
            reviewed_by,
            reviewed_at,
            resolution_notes,
            created_at,
            updated_at
          `)
          .eq(
            "finding_status",
            "open"
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(100),

        supabaseAdmin
          .from(
            "marketing_compliance_rule_sources"
          )
          .select(`
            id,
            rule_set_id,
            source_type,
            title,
            source_url,
            monitor_enabled,
            monitor_frequency,
            monitor_priority,
            last_checked_at,
            last_changed_at,
            next_check_at,
            last_check_status,
            last_content_hash,
            last_http_status,
            last_error
          `)
          .eq(
            "monitor_enabled",
            true
          )
          .order(
            "monitor_priority",
            {
              ascending: true,
            }
          )
          .order(
            "created_at",
            {
              ascending: true,
            }
          )
          .limit(100),
      ]);

    if (runResult.error) {
      throw runResult.error;
    }

    if (findingResult.error) {
      throw findingResult.error;
    }

    if (sourceResult.error) {
      throw sourceResult.error;
    }

    return NextResponse.json(
      {
        ok: true,

        runs:
          runResult.data ||
          [],

        findings:
          findingResult.data ||
          [],

        sources:
          sourceResult.data ||
          [],
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
  catch (error) {
    console.error(
      "Compliance audit GET error:",
      error
    );

    return errorResponse(
      error
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
      await request
        .json()
        .catch(
          () => ({})
        );

    const auditType =
      String(
        body?.audit_type ||
        "change_scan"
      ) as AdvertisingAuditType;

    if (
      auditType !==
        "change_scan" &&
      auditType !==
        "full_audit"
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "audit_type must be change_scan or full_audit.",
        },
        {
          status: 400,
        }
      );
    }

    const jurisdictionCode =
      String(
        body?.jurisdiction_code ||
        "all"
      );

    if (
      jurisdictionCode !==
        "all" &&
      jurisdictionCode !==
        "US-FED" &&
      jurisdictionCode !==
        "US-ID"
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "jurisdiction_code must be all, US-FED or US-ID.",
        },
        {
          status: 400,
        }
      );
    }

    const sourceId =
      body?.source_id
        ? String(
            body.source_id
          )
        : null;

    const result =
      await runAdvertisingComplianceAudit(
        {
          auditType,

          triggerSource:
            "platform_admin",

          requestedBy:
            profile.id,

          jurisdictionCode:
            jurisdictionCode ===
            "all"
              ? null
              : jurisdictionCode,

          sourceId,

          dueOnly:
            false,

          maxSources:
            body?.max_sources,
        }
      );

    return NextResponse.json(
      result,
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
  catch (error) {
    console.error(
      "Compliance audit POST error:",
      error
    );

    return errorResponse(
      error
    );
  }
}