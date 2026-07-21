import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function GET(
  request: Request
) {
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const anonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey
    ) {
      return jsonError(
        'Compliance API environment variables are missing.',
        500
      );
    }

    const authorization =
      request.headers.get(
        'authorization'
      ) || '';

    const accessToken =
      authorization.startsWith(
        'Bearer '
      )
        ? authorization
            .slice(7)
            .trim()
        : '';

    if (!accessToken) {
      return jsonError(
        'Not authenticated.',
        401
      );
    }

    const authClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

    const {
      data: userResult,
      error: userError,
    } =
      await authClient.auth.getUser(
        accessToken
      );

    if (
      userError ||
      !userResult.user
    ) {
      return jsonError(
        userError?.message ||
          'Your session is invalid.',
        401
      );
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      data: profile,
      error: profileError,
    } = await admin
      .from('profiles')
      .select('id, role')
      .eq(
        'id',
        userResult.user.id
      )
      .single();

    if (
      profileError ||
      !profile
    ) {
      return jsonError(
        profileError?.message ||
          'CRM profile not found.',
        403
      );
    }

    if (
      profile.role !==
      'platform_admin'
    ) {
      return jsonError(
        'Platform-admin access is required.',
        403
      );
    }

    const [
      jurisdictionResult,
      ruleSetResult,
      requirementResult,
      sourceResult,
      linkResult,
    ] = await Promise.all([
      admin
        .from(
          'marketing_jurisdictions'
        )
        .select(`
          id,
          code,
          name,
          jurisdiction_type
        `),

      admin
        .from(
          'marketing_compliance_rule_sets'
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
          broker_reviewed_at
        `)
        .order(
          'created_at',
          {
            ascending: true,
          }
        ),

      admin
        .from(
          'marketing_compliance_requirements'
        )
        .select(`
          id,
          rule_set_id,
          is_required
        `),

      admin
        .from(
          'marketing_compliance_rule_sources'
        )
        .select(`
          id,
          rule_set_id,
          last_verified_at,
          verified_by,
          last_checked_at,
          last_check_status,
          last_content_hash
        `),

      admin
        .from(
          'marketing_compliance_requirement_sources'
        )
        .select(`
          requirement_id
        `),
    ]);

    if (
      jurisdictionResult.error
    ) {
      throw jurisdictionResult.error;
    }

    if (ruleSetResult.error) {
      throw ruleSetResult.error;
    }

    if (
      requirementResult.error
    ) {
      throw requirementResult.error;
    }

    if (sourceResult.error) {
      throw sourceResult.error;
    }

    if (linkResult.error) {
      throw linkResult.error;
    }

    const jurisdictionById =
      new Map<
        string,
        {
          code: string;
          name: string;
          jurisdiction_type: string;
        }
      >();

    for (
      const jurisdiction of
        jurisdictionResult.data || []
    ) {
      jurisdictionById.set(
        jurisdiction.id,
        {
          code: jurisdiction.code,
          name: jurisdiction.name,
          jurisdiction_type:
            jurisdiction.jurisdiction_type,
        }
      );
    }

    const requirementsByRuleSet =
      new Map<
        string,
        {
          total: number;
          required: number;
          ids: string[];
        }
      >();

    const requirementRuleSetById =
      new Map<string, string>();

    for (
      const requirement of
        requirementResult.data || []
    ) {
      const current =
        requirementsByRuleSet.get(
          requirement.rule_set_id
        ) || {
          total: 0,
          required: 0,
          ids: [],
        };

      current.total += 1;

      if (requirement.is_required) {
        current.required += 1;
      }

      current.ids.push(
        requirement.id
      );

      requirementsByRuleSet.set(
        requirement.rule_set_id,
        current
      );

      requirementRuleSetById.set(
        requirement.id,
        requirement.rule_set_id
      );
    }

    const sourcesByRuleSet =
      new Map<
        string,
        {
          total: number;
          verified: number;
        }
      >();

    for (
      const source of
        sourceResult.data || []
    ) {
      const current =
        sourcesByRuleSet.get(
          source.rule_set_id
        ) || {
          total: 0,
          verified: 0,
        };

      current.total += 1;

      const manuallyVerified =
        Boolean(
          source
            .last_verified_at &&
          source.verified_by
        );

      const samanthaVerified =
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
            String(
              source
                .last_check_status ||
              ""
            )
          )
        );

      if (
        manuallyVerified ||
        samanthaVerified
      ) {
        current.verified += 1;
      }

      sourcesByRuleSet.set(
        source.rule_set_id,
        current
      );
    }

    const linkedRequirementIds =
      new Set<string>();

    for (
      const link of
        linkResult.data || []
    ) {
      linkedRequirementIds.add(
        link.requirement_id
      );
    }

    const rulePacks =
      (
        ruleSetResult.data || []
      ).map((ruleSet) => {
        const jurisdiction =
          jurisdictionById.get(
            ruleSet.jurisdiction_id
          );

        const requirements =
          requirementsByRuleSet.get(
            ruleSet.id
          ) || {
            total: 0,
            required: 0,
            ids: [],
          };

        const sources =
          sourcesByRuleSet.get(
            ruleSet.id
          ) || {
            total: 0,
            verified: 0,
          };

        const linkedRequirementCount =
          requirements.ids.filter(
            (requirementId) =>
              linkedRequirementIds.has(
                requirementId
              )
          ).length;

        return {
          id: ruleSet.id,

          jurisdictionId:
            ruleSet.jurisdiction_id,

          jurisdictionCode:
            jurisdiction?.code ||
            'UNKNOWN',

          jurisdictionName:
            jurisdiction?.name ||
            'Unknown jurisdiction',

          jurisdictionType:
            jurisdiction
              ?.jurisdiction_type ||
            'unknown',

          channel: ruleSet.channel,

          materialType:
            ruleSet.material_type,

          campaignType:
            ruleSet.campaign_type,

          name: ruleSet.name,

          version: ruleSet.version,

          status: ruleSet.status,

          isActive:
            ruleSet.is_active,

          effectiveDate:
            ruleSet.effective_date,

          expirationDate:
            ruleSet.expiration_date,

          lastReviewedAt:
            ruleSet.last_reviewed_at,

          nextReviewDue:
            ruleSet.next_review_due,

          approvedAt:
            ruleSet.approved_at,

          requiresBrokerApproval:
            ruleSet
              .requires_broker_approval,

          requiresLegalReview:
            ruleSet
              .requires_legal_review,

          legalReviewedAt:
            ruleSet
              .legal_reviewed_at,

          brokerReviewedAt:
            ruleSet
              .broker_reviewed_at,

          requirementCount:
            requirements.total,

          requiredRequirementCount:
            requirements.required,

          linkedRequirementCount,

          unlinkedRequirementCount:
            requirements.total -
            linkedRequirementCount,

          sourceCount:
            sources.total,

          verifiedSourceCount:
            sources.verified,
        };
      });

    const summary = {
      totalRulePacks:
        rulePacks.length,

      draft:
        rulePacks.filter(
          (rulePack) =>
            rulePack.status ===
            'draft'
        ).length,

      approved:
        rulePacks.filter(
          (rulePack) =>
            rulePack.status ===
            'approved'
        ).length,

      active:
        rulePacks.filter(
          (rulePack) =>
            rulePack.isActive
        ).length,

      totalRequirements:
        rulePacks.reduce(
          (
            total,
            rulePack
          ) =>
            total +
            rulePack
              .requirementCount,
          0
        ),

      totalSources:
        rulePacks.reduce(
          (
            total,
            rulePack
          ) =>
            total +
            rulePack.sourceCount,
          0
        ),

      verifiedSources:
        rulePacks.reduce(
          (
            total,
            rulePack
          ) =>
            total +
            rulePack
              .verifiedSourceCount,
          0
        ),

      unlinkedRequirements:
        rulePacks.reduce(
          (
            total,
            rulePack
          ) =>
            total +
            rulePack
              .unlinkedRequirementCount,
          0
        ),
    };

    return NextResponse.json(
      {
        ok: true,
        summary,
        rulePacks,
      },
      {
        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error(
      'Compliance rule-pack API error:',
      error
    );

    return jsonError(
      error?.message ||
        'Could not load rule-pack data.',
      500
    );
  }
}
