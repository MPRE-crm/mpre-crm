import {
  NextResponse,
} from 'next/server';

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from '../../../../../lib/server/authenticatedProfile';

import {
  supabaseAdmin,
} from '../../../../../lib/supabaseAdmin';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

export const maxDuration =
  60;

const PUBLIC_SITE_URL =
  'https://easyrealtor.homes';

type JsonRecord =
  Record<string, unknown>;

class ControlledSendError
  extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 400,
    code = 'controlled_send_error'
  ) {
    super(message);

    this.name =
      'ControlledSendError';

    this.status =
      status;

    this.code =
      code;
  }
}

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

function recordValue(
  value: unknown
): JsonRecord {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as
    JsonRecord;
}

function responseStatus(
  error: unknown
): number {
  if (
    error instanceof
      ControlledSendError
  ) {
    return error.status;
  }

  return requestErrorStatus(
    error
  );
}

function responseCode(
  error: unknown
): string {
  if (
    error instanceof
      ControlledSendError
  ) {
    return error.code;
  }

  if (
    error instanceof
      RequestAuthError
  ) {
    return 'authorization_error';
  }

  return 'unexpected_error';
}

function complianceUrl(
  path: string,
  token: unknown
): string {
  const cleanToken =
    clean(token);

  if (!cleanToken) {
    return '';
  }

  return (
    `${PUBLIC_SITE_URL}${path}` +
    `?token=${encodeURIComponent(
      cleanToken
    )}`
  );
}

function replaceComplianceLinks(
  html: unknown,
  unsubscribeUrl: string,
  preferencesUrl: string
): string {
  return String(
    html || ''
  )
    .replaceAll(
      '{{unsubscribe_url}}',
      unsubscribeUrl
    )
    .replaceAll(
      '{{preferences_url}}',
      preferencesUrl
    );
}

async function resendPayload(
  response: Response
): Promise<JsonRecord> {
  return await response
    .json()
    .catch(() => ({})) as
      JsonRecord;
}

export async function POST(
  request: Request
) {
  let claimedRecipientId =
    '';

  let acceptedResendEmailId =
    '';

  try {
    const body =
      await request
        .json()
        .catch(() => null) as
          | JsonRecord
          | null;

    const internalCron =
      body?.internal_cron ===
      true;

    const internalOwnerUserId =
      clean(
        body?.internal_owner_user_id
      );

    const cronSecret =
      clean(
        process.env
          .CRON_SECRET
      );

    const cronAuthorized =
      Boolean(
        internalCron &&
        internalOwnerUserId &&
        cronSecret &&
        request.headers.get(
          'authorization'
        ) ===
          `Bearer ${cronSecret}`
      );

    if (
      internalCron &&
      !cronAuthorized
    ) {
      throw new ControlledSendError(
        'The scheduled-email processor is not authorized.',
        401,
        'cron_authorization_failed'
      );
    }

    const authenticatedProfile =
      cronAuthorized
        ? {
            id:
              internalOwnerUserId,
          }
        : await requireAuthenticatedProfile(
            request
          );

    const sendMode =
      cronAuthorized
        ? 'scheduled_cron'
        : 'controlled_one_recipient';

    const campaignId =
      clean(
        body?.campaign_id
      );

    const recipientId =
      clean(
        body?.recipient_id
      );

    const confirmedEmail =
      normalizedEmail(
        body?.confirm_email
      );

    const dryRun =
      body?.dry_run ===
      true;

    if (!campaignId) {
      throw new ControlledSendError(
        'campaign_id is required.'
      );
    }

    if (!recipientId) {
      throw new ControlledSendError(
        'recipient_id is required.'
      );
    }

    if (!confirmedEmail) {
      throw new ControlledSendError(
        'confirm_email is required.'
      );
    }

    const {
      data: senderProfile,
      error: senderProfileError,
    } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        org_id,
        role,
        email,
        marketing_from_name,
        marketing_from_email,
        marketing_reply_to_email,
        marketing_physical_address,
        marketing_email_enabled
      `)
      .eq(
        'id',
        authenticatedProfile.id
      )
      .single();

    if (
      senderProfileError ||
      !senderProfile
    ) {
      throw new ControlledSendError(
        senderProfileError
          ?.message ||
        'Sender profile was not found.',
        404,
        'sender_profile_not_found'
      );
    }

    const {
      data: campaign,
      error: campaignError,
    } = await supabaseAdmin
      .from('email_campaigns')
      .select(`
        id,
        org_id,
        owner_user_id,
        name,
        status,
        subject,
        html_body,
        physical_address,
        reply_to_email,
        design_settings,
        scheduled_at,
        send_started_at
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
      throw new ControlledSendError(
        campaignError?.message ||
          'Campaign was not found.',
        404,
        'campaign_not_found'
      );
    }

    if (
      cronAuthorized &&
      campaign.owner_user_id !==
        internalOwnerUserId
    ) {
      throw new ControlledSendError(
        'The scheduled-email campaign owner did not match the processor request.',
        409,
        'cron_campaign_owner_mismatch'
      );
    }

    const sameOrganization =
      senderProfile.org_id ===
      campaign.org_id;

    const isAdministrator =
      senderProfile.role ===
        'platform_admin' ||
      senderProfile.role ===
        'admin' ||
      senderProfile.role ===
        'org_admin';

    const ownsCampaign =
      campaign.owner_user_id ===
      senderProfile.id;

    const canManage =
      cronAuthorized ||
      senderProfile.role ===
        'platform_admin' ||
      (
        sameOrganization &&
        (
          isAdministrator ||
          ownsCampaign
        )
      );

    if (!canManage) {
      throw new ControlledSendError(
        'You do not have access to this campaign.',
        403,
        'campaign_access_denied'
      );
    }

    if (
      !campaign.owner_user_id
    ) {
      throw new ControlledSendError(
        'The campaign owner is missing.',
        409,
        'campaign_owner_missing'
      );
    }

    const {
      data: deliveryProfile,
      error: deliveryProfileError,
    } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        org_id,
        marketing_from_name,
        marketing_from_email,
        marketing_reply_to_email,
        marketing_physical_address,
        marketing_email_enabled
      `)
      .eq(
        'id',
        campaign.owner_user_id
      )
      .single();

    if (
      deliveryProfileError ||
      !deliveryProfile
    ) {
      throw new ControlledSendError(
        deliveryProfileError?.message ||
          'The campaign owner profile was not found.',
        404,
        'campaign_owner_profile_not_found'
      );
    }

    if (
      deliveryProfile.org_id !==
      campaign.org_id
    ) {
      throw new ControlledSendError(
        'The campaign owner does not belong to the campaign organization.',
        409,
        'campaign_owner_org_mismatch'
      );
    }

    if (
      !deliveryProfile
        .marketing_email_enabled
    ) {
      throw new ControlledSendError(
        'Marketing email is not enabled for the campaign owner.',
        409,
        'marketing_email_disabled'
      );
    }

    if (
      campaign.status !==
        'scheduled' &&
      campaign.status !==
        'sending'
    ) {
      throw new ControlledSendError(
        'The campaign must be scheduled before a production recipient can be sent.',
        409,
        'campaign_not_scheduled'
      );
    }

    if (
      !clean(
        campaign.subject
      )
    ) {
      throw new ControlledSendError(
        'The campaign subject is empty.',
        409,
        'campaign_subject_missing'
      );
    }

    const campaignHtml =
      clean(
        campaign.html_body
      );

    if (!campaignHtml) {
      throw new ControlledSendError(
        'The campaign HTML is empty.',
        409,
        'campaign_html_missing'
      );
    }

    if (
      !campaignHtml.includes(
        '{{unsubscribe_url}}'
      ) ||
      !campaignHtml.includes(
        '{{preferences_url}}'
      )
    ) {
      throw new ControlledSendError(
        'The campaign HTML is missing required unsubscribe or email-preferences placeholders.',
        409,
        'campaign_compliance_placeholders_missing'
      );
    }

    if (
      !clean(
        campaign.physical_address
      ) &&
      !clean(
        deliveryProfile
          .marketing_physical_address
      )
    ) {
      throw new ControlledSendError(
        'A business mailing address is required.',
        409,
        'physical_address_missing'
      );
    }

    const {
      data: recipient,
      error: recipientError,
    } = await supabaseAdmin
      .from(
        'email_campaign_recipients'
      )
      .select(`
        id,
        campaign_id,
        email,
        email_normalized,
        first_name,
        display_name,
        status,
        resend_email_id,
        send_attempts,
        scheduled_at,
        sent_at,
        unsubscribe_token,
        preferences_token,
        recipient_context
      `)
      .eq(
        'id',
        recipientId
      )
      .eq(
        'campaign_id',
        campaignId
      )
      .single();

    if (
      recipientError ||
      !recipient
    ) {
      throw new ControlledSendError(
        recipientError?.message ||
          'Campaign recipient was not found.',
        404,
        'recipient_not_found'
      );
    }

    const recipientEmail =
      normalizedEmail(
        recipient.email_normalized ||
        recipient.email
      );

    if (
      recipientEmail !==
      confirmedEmail
    ) {
      throw new ControlledSendError(
        'The confirmation email does not match the selected recipient.',
        409,
        'recipient_confirmation_mismatch'
      );
    }

    if (
      recipient.status !==
      'queued'
    ) {
      throw new ControlledSendError(
        `The recipient is ${recipient.status} and cannot be sent as a new delivery.`,
        409,
        'recipient_not_queued'
      );
    }

    if (
      recipient
        .resend_email_id ||
      recipient.sent_at
    ) {
      throw new ControlledSendError(
        'This recipient already has delivery history.',
        409,
        'recipient_history_exists'
      );
    }

    const unsubscribeUrl =
      complianceUrl(
        '/unsubscribe',
        recipient
          .unsubscribe_token
      );

    const preferencesUrl =
      complianceUrl(
        '/email-preferences',
        recipient
          .preferences_token
      );

    if (
      !unsubscribeUrl ||
      !preferencesUrl
    ) {
      throw new ControlledSendError(
        'The recipient is missing required compliance tokens.',
        409,
        'compliance_tokens_missing'
      );
    }

    const scheduledAt =
      clean(
        recipient.scheduled_at
      );

    const scheduledTime =
      scheduledAt
        ? new Date(
            scheduledAt
          )
        : null;

    const scheduledTimeValid =
      scheduledTime &&
      Number.isFinite(
        scheduledTime.getTime()
      );

    const dueNow =
      Boolean(
        scheduledTimeValid &&
        scheduledTime!.getTime() <=
          Date.now()
      );

    const html =
      replaceComplianceLinks(
        campaignHtml,
        unsubscribeUrl,
        preferencesUrl
      );

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        ready:
          dueNow,
        campaign_id:
          campaign.id,
        campaign_status:
          campaign.status,
        recipient_id:
          recipient.id,
        to:
          recipientEmail,
        recipient_status:
          recipient.status,
        scheduled_at:
          scheduledAt ||
          null,
        due_now:
          dueNow,
        has_unsubscribe_url:
          Boolean(
            unsubscribeUrl
          ),
        has_preferences_url:
          Boolean(
            preferencesUrl
          ),
        html_length:
          html.length,
      });
    }

    if (!scheduledTimeValid) {
      throw new ControlledSendError(
        'The recipient does not have a valid scheduled delivery time.',
        409,
        'recipient_not_scheduled'
      );
    }

    if (!dueNow) {
      throw new ControlledSendError(
        `The recipient is scheduled for ${scheduledAt} and is not due yet.`,
        409,
        'recipient_not_due'
      );
    }

    const resendApiKey =
      clean(
        process.env
          .RESEND_API_KEY
      );

    const resendFromEmail =
      clean(
        process.env
          .RESEND_FROM_EMAIL
      );

    if (
      !resendApiKey ||
      !resendFromEmail
    ) {
      throw new ControlledSendError(
        'Resend environment variables are incomplete.',
        503,
        'resend_not_configured'
      );
    }

    const now =
      new Date()
        .toISOString();

    const nextAttempt =
      Math.max(
        0,
        Number(
          recipient
            .send_attempts ||
          0
        )
      ) + 1;

    const {
      data: claimedRecipient,
      error: claimError,
    } = await supabaseAdmin
      .from(
        'email_campaign_recipients'
      )
      .update({
        status:
          'sending',
        send_attempts:
          nextAttempt,
        error_message:
          null,
        updated_at:
          now,
      })
      .eq(
        'id',
        recipient.id
      )
      .eq(
        'status',
        'queued'
      )
      .lte(
        'scheduled_at',
        now
      )
      .select('id')
      .maybeSingle();

    if (
      claimError ||
      !claimedRecipient
    ) {
      throw new ControlledSendError(
        claimError?.message ||
          'The recipient could not be claimed for delivery.',
        409,
        'recipient_claim_failed'
      );
    }

    claimedRecipientId =
      recipient.id;

    const {
      data: sendingCampaign,
      error: campaignStartError,
    } = await supabaseAdmin
      .from('email_campaigns')
      .update({
        status:
          'sending',
        send_started_at:
          campaign
            .send_started_at ||
          now,
        last_error:
          null,
        updated_at:
          now,
      })
      .eq(
        'id',
        campaign.id
      )
      .in(
        'status',
        [
          'scheduled',
          'sending',
        ]
      )
      .select('id')
      .maybeSingle();

    if (
      campaignStartError ||
      !sendingCampaign
    ) {
      throw new ControlledSendError(
        campaignStartError?.message ||
          'The campaign could not be moved into sending status.',
        409,
        'campaign_start_failed'
      );
    }

    const senderName =
      clean(
        deliveryProfile
          .marketing_from_name
      ) ||
      'MPRE Boise';

    const fromValue =
      resendFromEmail
        .includes('<')
        ? resendFromEmail
        : (
            `${senderName} ` +
            `<${resendFromEmail}>`
          );

    const idempotencyKey =
      (
        `campaign-${campaign.id}` +
        `-recipient-${recipient.id}` +
        '-v1'
      );

    const resendResponse =
      await fetch(
        'https://api.resend.com/emails',
        {
          method:
            'POST',

          headers: {
            Authorization:
              `Bearer ${resendApiKey}`,

            'Content-Type':
              'application/json',

            'Idempotency-Key':
              idempotencyKey,
          },

          body:
            JSON.stringify({
              from:
                fromValue,

              to: [
                recipientEmail,
              ],

              subject:
                campaign.subject,

              html,

              reply_to:
                clean(
                  campaign
                    .reply_to_email
                ) ||
                clean(
                  deliveryProfile
                    .marketing_reply_to_email
                ) ||
                undefined,
            }),
        }
      );

    const resendResult =
      await resendPayload(
        resendResponse
      );

    if (!resendResponse.ok) {
      throw new ControlledSendError(
        clean(
          resendResult.message
        ) ||
        clean(
          resendResult.error
        ) ||
        'Resend rejected the recipient email.',
        502,
        'resend_send_failed'
      );
    }

    const resendEmailId =
      clean(
        resendResult.id
      );

    if (!resendEmailId) {
      throw new ControlledSendError(
        'Resend accepted the request but did not return an email ID.',
        502,
        'resend_email_id_missing'
      );
    }

    acceptedResendEmailId =
      resendEmailId;

    const sentAt =
      new Date()
        .toISOString();

    const existingContext =
      recordValue(
        recipient
          .recipient_context
      );

    const {
      data: finalizedRecipient,
      error: sentUpdateError,
    } = await supabaseAdmin
      .from(
        'email_campaign_recipients'
      )
      .update({
        status:
          'sent',
        resend_email_id:
          resendEmailId,
        sent_at:
          sentAt,
        failed_at:
          null,
        error_message:
          null,
        recipient_context: {
          ...existingContext,

          production_send: {
            version:
              1,
            mode:
              sendMode,
            accepted_at:
              sentAt,
            resend_email_id:
              resendEmailId,
            idempotency_key:
              idempotencyKey,
          },
        },
        updated_at:
          sentAt,
      })
      .eq(
        'id',
        recipient.id
      )
      .eq(
        'status',
        'sending'
      )
      .select('id')
      .maybeSingle();

    if (
      sentUpdateError ||
      !finalizedRecipient
    ) {
      throw new ControlledSendError(
        `Resend accepted the email, but the recipient record could not be finalized: ${sentUpdateError?.message || 'no recipient row was updated'}`,
        500,
        'recipient_finalize_failed'
      );
    }

    claimedRecipientId =
      '';

    const {
      data: followUpData,
      error: followUpError,
    } = await supabaseAdmin.rpc(
      'register_email_personal_follow_up',
      {
        p_campaign_id:
          campaign.id,
        p_recipient_id:
          recipient.id,
        p_sent_at:
          sentAt,
      }
    );

    let followUpWarning:
      string | null =
        null;

    if (followUpError) {
      followUpWarning =
        followUpError.message;

      const warningContext = {
        ...existingContext,

        production_send: {
          version:
            1,
          mode:
            sendMode,
          accepted_at:
            sentAt,
          resend_email_id:
            resendEmailId,
          idempotency_key:
            idempotencyKey,
          follow_up_error:
            followUpError.message,
        },
      };

      await supabaseAdmin
        .from(
          'email_campaign_recipients'
        )
        .update({
          recipient_context:
            warningContext,
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'id',
          recipient.id
        );
    }

    return NextResponse.json({
      ok: true,
      dry_run: false,
      campaign_id:
        campaign.id,
      recipient_id:
        recipient.id,
      to:
        recipientEmail,
      status:
        'sent',
      sent_at:
        sentAt,
      resend_email_id:
        resendEmailId,
      personal_follow_up:
        followUpData ||
        null,
      warning:
        followUpWarning,
    });
  }
  catch (error: unknown) {
    console.error(
      'controlled campaign recipient send error',
      error
    );

    if (
      claimedRecipientId &&
      !acceptedResendEmailId
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
            error instanceof Error
              ? error.message
              : 'Recipient send failed.',
          updated_at:
            failedAt,
        })
        .eq(
          'id',
          claimedRecipientId
        )
        .eq(
          'status',
          'sending'
        );
    }

    return NextResponse.json(
      {
        ok: false,
        code:
          responseCode(error),
        error:
          error instanceof Error
            ? error.message
            : 'Controlled recipient send failed.',

        accepted_by_resend:
          Boolean(
            acceptedResendEmailId
          ),

        resend_email_id:
          acceptedResendEmailId ||
          null,
      },
      {
        status:
          responseStatus(error),
      }
    );
  }
}