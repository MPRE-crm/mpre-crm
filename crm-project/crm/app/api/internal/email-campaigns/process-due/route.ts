import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  supabaseAdmin,
} from '../../../../../lib/supabaseAdmin';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

export const maxDuration =
  60;

const MAX_BATCH_SIZE =
  25;

const PUBLIC_SITE_URL =
  'https://www.easyrealtor.homes';

type DueRecipient = {
  id: string;
  campaign_id: string;
  email: string;
  email_normalized:
    | string
    | null;
  scheduled_at:
    | string
    | null;
};

type CampaignRow = {
  id: string;
  owner_user_id:
    | string
    | null;
  status: string;
};

type JsonRecord =
  Record<string, unknown>;

function clean(
  value: unknown
): string {
  return typeof value ===
    'string'
    ? value.trim()
    : '';
}

function normalizedEmail(
  value: unknown
): string {
  return clean(value)
    .toLowerCase();
}

async function responsePayload(
  response: Response
): Promise<JsonRecord> {
  return await response
    .json()
    .catch(() => ({})) as
      JsonRecord;
}

async function markRecipientFailed(
  recipientId: string,
  message: string
) {
  const failedAt =
    new Date()
      .toISOString();

  await supabaseAdmin
    .from(
      'email_campaign_recipients'
    )
    .update({
      status:
        'failed',

      failed_at:
        failedAt,

      error_message:
        message.slice(
          0,
          2000
        ),

      updated_at:
        failedAt,
    })
    .eq(
      'id',
      recipientId
    )
    .eq(
      'status',
      'queued'
    );
}

export async function GET(
  request: NextRequest
) {
  const cronSecret =
    clean(
      process.env
        .CRON_SECRET
    );

  if (!cronSecret) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          'CRON_SECRET is not configured.',
      },
      {
        status:
          503,
      }
    );
  }

  if (
    request.headers.get(
      'authorization'
    ) !==
      `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          'Unauthorized.',
      },
      {
        status:
          401,
      }
    );
  }

  try {
    const startedAt =
      new Date()
        .toISOString();

    const {
      data:
        dueData,

      error:
        dueError,
    } = await supabaseAdmin
      .from(
        'email_campaign_recipients'
      )
      .select(`
        id,
        campaign_id,
        email,
        email_normalized,
        scheduled_at
      `)
      .eq(
        'status',
        'queued'
      )
      .not(
        'scheduled_at',
        'is',
        null
      )
      .lte(
        'scheduled_at',
        startedAt
      )
      .order(
        'scheduled_at',
        {
          ascending:
            true,
        }
      )
      .limit(
        MAX_BATCH_SIZE
      );

    if (dueError) {
      throw new Error(
        dueError.message
      );
    }

    const dueRecipients =
      (
        dueData ||
        []
      ) as DueRecipient[];

    if (
      dueRecipients.length ===
      0
    ) {
      return NextResponse.json({
        ok:
          true,

        started_at:
          startedAt,

        batch_limit:
          MAX_BATCH_SIZE,

        scanned:
          0,

        attempted:
          0,

        sent:
          0,

        failed:
          0,

        skipped:
          0,

        results:
          [],
      });
    }

    const campaignIds =
      Array.from(
        new Set(
          dueRecipients.map(
            (recipient) =>
              recipient
                .campaign_id
          )
        )
      );

    const {
      data:
        campaignData,

      error:
        campaignError,
    } = await supabaseAdmin
      .from(
        'email_campaigns'
      )
      .select(`
        id,
        owner_user_id,
        status
      `)
      .in(
        'id',
        campaignIds
      );

    if (campaignError) {
      throw new Error(
        campaignError.message
      );
    }

    const campaigns =
      (
        campaignData ||
        []
      ) as CampaignRow[];

    const campaignById =
      new Map(
        campaigns.map(
          (campaign) => [
            campaign.id,
            campaign,
          ]
        )
      );

    const results:
      JsonRecord[] =
        [];

    const attemptedCampaignIds =
      new Set<string>();

    for (
      const recipient of
        dueRecipients
    ) {
      const campaign =
        campaignById.get(
          recipient
            .campaign_id
        );

      if (
        !campaign ||
        ![
          'scheduled',
          'sending',
        ].includes(
          campaign.status
        )
      ) {
        results.push({
          recipient_id:
            recipient.id,

          campaign_id:
            recipient
              .campaign_id,

          ok:
            false,

          skipped:
            true,

          reason:
            'campaign_not_active',
        });

        continue;
      }

      if (
        !campaign
          .owner_user_id
      ) {
        const message =
          'The scheduled campaign owner is missing.';

        await markRecipientFailed(
          recipient.id,
          message
        );

        results.push({
          recipient_id:
            recipient.id,

          campaign_id:
            campaign.id,

          ok:
            false,

          code:
            'campaign_owner_missing',

          error:
            message,
        });

        attemptedCampaignIds.add(
          campaign.id
        );

        continue;
      }

      const recipientEmail =
        normalizedEmail(
          recipient
            .email_normalized ||
          recipient.email
        );

      if (!recipientEmail) {
        const message =
          'The scheduled recipient email is missing.';

        await markRecipientFailed(
          recipient.id,
          message
        );

        results.push({
          recipient_id:
            recipient.id,

          campaign_id:
            campaign.id,

          ok:
            false,

          code:
            'recipient_email_missing',

          error:
            message,
        });

        attemptedCampaignIds.add(
          campaign.id
        );

        continue;
      }

      attemptedCampaignIds.add(
        campaign.id
      );

      try {
        const sendResponse =
          await fetch(
            (
              PUBLIC_SITE_URL +
              '/api/marketing/email-campaigns/send-one'
            ),
            {
              method:
                'POST',

              cache:
                'no-store',

              headers: {
                Authorization:
                  `Bearer ${cronSecret}`,

                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  campaign_id:
                    campaign.id,

                  recipient_id:
                    recipient.id,

                  confirm_email:
                    recipientEmail,

                  internal_cron:
                    true,

                  internal_owner_user_id:
                    campaign
                      .owner_user_id,
                }),
            }
          );

        const payload =
          await responsePayload(
            sendResponse
          );

        results.push({
          recipient_id:
            recipient.id,

          campaign_id:
            campaign.id,

          ok:
            sendResponse.ok &&
            payload.ok ===
              true,

          status:
            sendResponse.status,

          code:
            payload.code ||
            null,

          sent_at:
            payload.sent_at ||
            null,

          resend_email_id:
            payload
              .resend_email_id ||
            null,

          warning:
            payload.warning ||
            null,

          error:
            payload.error ||
            null,
        });
      }
      catch (
        sendError:
          unknown
      ) {
        results.push({
          recipient_id:
            recipient.id,

          campaign_id:
            campaign.id,

          ok:
            false,

          status:
            500,

          code:
            'processor_request_failed',

          error:
            sendError instanceof
              Error
              ? sendError.message
              : 'Scheduled recipient delivery failed.',
        });
      }
    }

    const completedCampaignIds:
      string[] =
        [];

    for (
      const campaignId of
        attemptedCampaignIds
    ) {
      const {
        count:
          unfinishedCount,

        error:
          unfinishedError,
      } = await supabaseAdmin
        .from(
          'email_campaign_recipients'
        )
        .select(
          'id',
          {
            count:
              'exact',

            head:
              true,
          }
        )
        .eq(
          'campaign_id',
          campaignId
        )
        .in(
          'status',
          [
            'queued',
            'sending',
          ]
        );

      if (unfinishedError) {
        results.push({
          campaign_id:
            campaignId,

          ok:
            false,

          code:
            'campaign_completion_check_failed',

          error:
            unfinishedError.message,
        });

        continue;
      }

      if (
        Number(
          unfinishedCount ||
          0
        ) >
        0
      ) {
        continue;
      }

      const campaignFailures =
        results.filter(
          (result) =>
            result.campaign_id ===
              campaignId &&
            result.ok !==
              true &&
            result.skipped !==
              true
        ).length;

      const completedAt =
        new Date()
          .toISOString();

      const {
        error:
          completionError,
      } = await supabaseAdmin
        .from(
          'email_campaigns'
        )
        .update({
          status:
            'sent',

          sent_at:
            completedAt,

          last_error:
            campaignFailures >
            0
              ? `${campaignFailures} recipient delivery failure(s) require internal review.`
              : null,

          updated_at:
            completedAt,
        })
        .eq(
          'id',
          campaignId
        )
        .in(
          'status',
          [
            'scheduled',
            'sending',
          ]
        );

      if (completionError) {
        results.push({
          campaign_id:
            campaignId,

          ok:
            false,

          code:
            'campaign_completion_failed',

          error:
            completionError.message,
        });

        continue;
      }

      completedCampaignIds.push(
        campaignId
      );
    }

    const sent =
      results.filter(
        (result) =>
          result.ok ===
          true
      ).length;

    const skipped =
      results.filter(
        (result) =>
          result.skipped ===
          true
      ).length;

    const failed =
      results.filter(
        (result) =>
          result.ok !==
            true &&
          result.skipped !==
            true
      ).length;

    return NextResponse.json({
      ok:
        failed ===
        0,

      started_at:
        startedAt,

      completed_at:
        new Date()
          .toISOString(),

      batch_limit:
        MAX_BATCH_SIZE,

      scanned:
        dueRecipients.length,

      attempted:
        results.length -
        skipped,

      sent,

      failed,

      skipped,

      completed_campaign_ids:
        completedCampaignIds,

      results,
    });
  }
  catch (
    error:
      unknown
  ) {
    console.error(
      'scheduled email processor error',
      error
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof
            Error
            ? error.message
            : 'Scheduled email processing failed.',
      },
      {
        status:
          500,
      }
    );
  }
}

export const POST =
  GET;