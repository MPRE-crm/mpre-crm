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
      checklistResult,
    ] = await Promise.all([
      admin
        .from(
          'marketing_jurisdictions'
        )
        .select(`
          id,
          code,
          state_code,
          name,
          jurisdiction_type,
          launch_status,
          marketing_enabled,
          current_rule_version,
          last_reviewed_at,
          next_review_due
        `)
        .order(
          'jurisdiction_type',
          {
            ascending: true,
          }
        )
        .order(
          'name',
          {
            ascending: true,
          }
        ),

      admin
        .from(
          'marketing_state_launch_checklist_items'
        )
        .select(`
          jurisdiction_id,
          is_required,
          is_completed
        `),
    ]);

    if (
      jurisdictionResult.error
    ) {
      throw jurisdictionResult.error;
    }

    if (
      checklistResult.error
    ) {
      throw checklistResult.error;
    }

    const checklistByJurisdiction =
      new Map<
        string,
        {
          required: number;
          completed: number;
        }
      >();

    for (
      const item of
        checklistResult.data || []
    ) {
      const current =
        checklistByJurisdiction.get(
          item.jurisdiction_id
        ) || {
          required: 0,
          completed: 0,
        };

      if (item.is_required) {
        current.required += 1;

        if (item.is_completed) {
          current.completed += 1;
        }
      }

      checklistByJurisdiction.set(
        item.jurisdiction_id,
        current
      );
    }

    const jurisdictions =
      (
        jurisdictionResult.data ||
        []
      ).map((jurisdiction) => {
        const checklist =
          checklistByJurisdiction.get(
            jurisdiction.id
          ) || {
            required: 0,
            completed: 0,
          };

        return {
          id: jurisdiction.id,
          code: jurisdiction.code,
          stateCode:
            jurisdiction.state_code,
          name: jurisdiction.name,
          jurisdictionType:
            jurisdiction.jurisdiction_type,
          launchStatus:
            jurisdiction.launch_status,
          marketingEnabled:
            jurisdiction.marketing_enabled,
          currentRuleVersion:
            jurisdiction.current_rule_version,
          lastReviewedAt:
            jurisdiction.last_reviewed_at,
          nextReviewDue:
            jurisdiction.next_review_due,
          checklistRequired:
            checklist.required,
          checklistCompleted:
            checklist.completed,
        };
      });

    const stateRows =
      jurisdictions.filter(
        (jurisdiction) =>
          jurisdiction
            .jurisdictionType ===
          'state'
      );

    const summary = {
      totalJurisdictions:
        jurisdictions.length,

      states:
        stateRows.length,

      federal:
        jurisdictions.filter(
          (jurisdiction) =>
            jurisdiction
              .jurisdictionType ===
            'federal'
        ).length,

      pendingReview:
        jurisdictions.filter(
          (jurisdiction) =>
            jurisdiction
              .launchStatus ===
            'pending_review'
        ).length,

      inReview:
        jurisdictions.filter(
          (jurisdiction) =>
            jurisdiction
              .launchStatus ===
            'in_review'
        ).length,

      approved:
        jurisdictions.filter(
          (jurisdiction) =>
            jurisdiction
              .launchStatus ===
            'approved'
        ).length,

      enabled:
        jurisdictions.filter(
          (jurisdiction) =>
            jurisdiction
              .marketingEnabled
        ).length,
    };

    return NextResponse.json(
      {
        ok: true,
        summary,
        jurisdictions,
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
      'Compliance overview API error:',
      error
    );

    return jsonError(
      error?.message ||
        'Could not load compliance data.',
      500
    );
  }
}
