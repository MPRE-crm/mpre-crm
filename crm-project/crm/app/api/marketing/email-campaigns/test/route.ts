import {
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const dynamic =
  'force-dynamic';

function bearerToken(
  request: Request
) {
  const header =
    request.headers.get(
      'authorization'
    ) || '';

  if (
    !header
      .toLowerCase()
      .startsWith('bearer ')
  ) {
    return '';
  }

  return header
    .slice(7)
    .trim();
}

export async function POST(
  request: Request
) {
  try {
    const token =
      bearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Missing authentication token.',
        },
        {
          status: 401,
        }
      );
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const anonKey =
      process.env
        .SUPABASE_ANON_KEY ||
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey
    ) {
      throw new Error(
        'Supabase server environment variables are incomplete.'
      );
    }

    const authClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
          },

          global: {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        }
      );

    const {
      data: userResult,
      error: userError,
    } =
      await authClient.auth.getUser(
        token
      );

    if (
      userError ||
      !userResult.user
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            userError?.message ||
            'Not authenticated.',
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const campaignId =
      String(
        body?.campaign_id ||
          ''
      ).trim();

    if (!campaignId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'campaign_id is required.',
        },
        {
          status: 400,
        }
      );
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
          },
        }
      );

    const {
      data: profile,
      error: profileError,
    } = await admin
      .from('profiles')
      .select(`
        id,
        email,
        org_id,
        role,
        marketing_from_name,
        marketing_from_email,
        marketing_reply_to_email,
        marketing_physical_address,
        marketing_email_enabled
      `)
      .eq(
        'id',
        userResult.user.id
      )
      .single();

    if (
      profileError ||
      !profile
    ) {
      throw new Error(
        profileError?.message ||
          'Profile not found.'
      );
    }

    const {
      data: campaign,
      error: campaignError,
    } = await admin
      .from('email_campaigns')
      .select(`
        id,
        org_id,
        owner_user_id,
        name,
        subject,
        html_body,
        physical_address,
        reply_to_email
      `)
      .eq(
        'id',
        campaignId
      )
      .single();

    if (
      campaignError ||
      !campaign
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            campaignError?.message ||
            'Campaign not found.',
        },
        {
          status: 404,
        }
      );
    }

    const sameOrganization =
      profile.org_id ===
      campaign.org_id;

    const isAdmin =
      profile.role ===
        'platform_admin' ||
      profile.role ===
        'admin' ||
      profile.role ===
        'org_admin';

    const ownsCampaign =
      campaign.owner_user_id ===
      profile.id;

    const canAccess =
      profile.role ===
        'platform_admin' ||
      (sameOrganization &&
        (isAdmin ||
          ownsCampaign));

    if (!canAccess) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'You do not have access to this campaign.',
        },
        {
          status: 403,
        }
      );
    }

    if (
      !profile
        .marketing_email_enabled
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Marketing email is not enabled for this CRM profile.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      !campaign.html_body
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Campaign HTML is empty.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      !campaign
        .physical_address
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'A business mailing address is required.',
        },
        {
          status: 400,
        }
      );
    }

    const testRecipient =
      profile.email ||
      profile
        .marketing_reply_to_email;

    if (!testRecipient) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Your CRM profile does not have a test email address.',
        },
        {
          status: 400,
        }
      );
    }

    const resendApiKey =
      process.env.RESEND_API_KEY;

    const resendFromEmail =
      process.env.RESEND_FROM_EMAIL;

    if (
      !resendApiKey ||
      !resendFromEmail
    ) {
      throw new Error(
        'Resend environment variables are incomplete.'
      );
    }

    const senderName =
      profile
        .marketing_from_name ||
      'MPRE Boise';

    const fromValue =
      resendFromEmail.includes(
        '<'
      )
        ? resendFromEmail
        : `${senderName} <${resendFromEmail}>`;

    const testHtml =
      String(
        campaign.html_body
      )
        .replaceAll(
          '{{unsubscribe_url}}',
          '#'
        )
        .replaceAll(
          '{{preferences_url}}',
          '#'
        );

    const resendResponse =
      await fetch(
        'https://api.resend.com/emails',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${resendApiKey}`,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            from: fromValue,

            to: [
              testRecipient,
            ],

            subject:
              `[TEST] ${campaign.subject}`,

            html: testHtml,

            reply_to:
              campaign
                .reply_to_email ||
              profile
                .marketing_reply_to_email ||
              undefined,
          }),
        }
      );

    const resendPayload =
      await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(
        resendPayload?.message ||
          resendPayload?.error ||
          'Resend rejected the test email.'
      );
    }

    await admin
      .from('email_campaigns')
      .update({
        test_sent_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        campaign.id
      );

    return NextResponse.json({
      ok: true,

      to: testRecipient,

      resend_email_id:
        resendPayload?.id ||
        null,
    });
  } catch (error: any) {
    console.error(
      'campaign test email error',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error?.message ||
          'Test email failed.',
      },
      {
        status: 500,
      }
    );
  }
}

