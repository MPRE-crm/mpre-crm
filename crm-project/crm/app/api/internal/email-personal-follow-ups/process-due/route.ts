import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  supabaseAdmin,
} from '../../../../../lib/supabaseAdmin';

import {
  buildQuickNoteEmail,
  QUICK_NOTE_AUDIENCES,
  type QuickNoteAudience,
} from '../../../../../lib/quick-note-email';

import {
  normalizeLuxuryEmailEdition,
  type Listing,
  type Profile,
} from '../../../../../lib/listing-email-creative';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

export const maxDuration =
  60;

const MAX_BATCH_SIZE =
  25;

const CLAIM_SECONDS =
  900;

const PUBLIC_SITE_URL =
  'https://easyrealtor.homes';

type JsonRecord =
  Record<string, unknown>;

type ClaimedDelivery = {
  delivery_id: string;
  enrollment_id: string;
  org_id: string;
  owner_user_id: string;
  listing_id: string;
  source_campaign_id: string;
  source_recipient_id: string;
  sequence_step_id: string;
  email: string;
  email_normalized: string;
  first_name:
    | string
    | null;
  category: string;
  subject: string;
  preview_text:
    | string
    | null;
  follow_up_paragraph: string;
  content_snapshot:
    | JsonRecord
    | null;
  scheduled_at: string;
  attempt_count: number;
  idempotency_key: string;
};

class DeliveryProcessingError
  extends Error {
  code: string;
  retryable: boolean;

  constructor(
    message: string,
    code: string,
    retryable: boolean
  ) {
    super(message);

    this.name =
      'DeliveryProcessingError';

    this.code =
      code;

    this.retryable =
      retryable;
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

function errorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error
    ? error.message
    : fallback;
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

function quickNoteAudience(
  value: unknown
): QuickNoteAudience {
  const candidate =
    clean(value) as
      QuickNoteAudience;

  return QUICK_NOTE_AUDIENCES
    .includes(candidate)
    ? candidate
    : 'unknown';
}

async function resendPayload(
  response: Response
): Promise<JsonRecord> {
  return await response
    .json()
    .catch(() => ({})) as
      JsonRecord;
}

async function finalizeBlocked(
  delivery: ClaimedDelivery,
  status:
    | 'suppressed'
    | 'stopped',
  reason: string
): Promise<JsonRecord> {
  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    'finalize_email_personal_follow_up_blocked',
    {
      p_delivery_id:
        delivery.delivery_id,

      p_status:
        status,

      p_reason:
        reason,
    }
  );

  if (error) {
    return {
      delivery_id:
        delivery.delivery_id,

      enrollment_id:
        delivery.enrollment_id,

      ok:
        false,

      blocked:
        false,

      status,

      code:
        'blocked_finalize_failed',

      reason,

      error:
        error.message,
    };
  }

  return {
    delivery_id:
      delivery.delivery_id,

    enrollment_id:
      delivery.enrollment_id,

    ok:
      true,

    blocked:
      true,

    status,

    reason,

    finalization:
      data || null,
  };
}

async function finalizeFailure(
  delivery: ClaimedDelivery,
  code: string,
  message: string,
  retryable: boolean
): Promise<JsonRecord> {
  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    'finalize_email_personal_follow_up_failure',
    {
      p_delivery_id:
        delivery.delivery_id,

      p_error_code:
        code,

      p_error_message:
        message.slice(
          0,
          2000
        ),

      p_retryable:
        retryable,
    }
  );

  if (error) {
    throw new Error(
      (
        'The delivery failure could not be finalized: ' +
        error.message
      )
    );
  }

  return recordValue(data);
}

async function processDelivery(
  delivery: ClaimedDelivery
): Promise<JsonRecord> {
  let acceptedResendEmailId =
    '';

  try {
    const recipientEmail =
      normalizedEmail(
        delivery.email_normalized ||
        delivery.email
      );

    if (!recipientEmail) {
      throw new DeliveryProcessingError(
        'The Personal Follow-Up recipient email is missing.',
        'recipient_email_missing',
        false
      );
    }

    const [
      recipientResult,
      campaignResult,
      profileResult,
      listingResult,
      organizationResult,
    ] = await Promise.all([
      supabaseAdmin
        .from(
          'email_campaign_recipients'
        )
        .select(`
          id,
          contact_id,
          status,
          unsubscribe_token,
          preferences_token,
          unsubscribed_at,
          bounced_at,
          complained_at,
          last_replied_at,
          reply_count,
          recipient_context
        `)
        .eq(
          'id',
          delivery.source_recipient_id
        )
        .eq(
          'campaign_id',
          delivery.source_campaign_id
        )
        .maybeSingle(),

      supabaseAdmin
        .from(
          'email_campaigns'
        )
        .select(`
          id,
          org_id,
          owner_user_id,
          listing_id,
          reply_to_email,
          physical_address,
          creative_key,
          design_settings
        `)
        .eq(
          'id',
          delivery.source_campaign_id
        )
        .maybeSingle(),

      supabaseAdmin
        .from('profiles')
        .select('*')
        .eq(
          'id',
          delivery.owner_user_id
        )
        .maybeSingle(),

      supabaseAdmin
        .from('listings')
        .select('*')
        .eq(
          'id',
          delivery.listing_id
        )
        .maybeSingle(),

      supabaseAdmin
        .from('organizations')
        .select('*')
        .eq(
          'id',
          delivery.org_id
        )
        .maybeSingle(),
    ]);

    if (
      recipientResult.error ||
      !recipientResult.data
    ) {
      throw new DeliveryProcessingError(
        recipientResult.error
          ?.message ||
        'The source campaign recipient was not found.',
        'source_recipient_not_found',
        Boolean(
          recipientResult.error
        )
      );
    }

    if (
      campaignResult.error ||
      !campaignResult.data
    ) {
      throw new DeliveryProcessingError(
        campaignResult.error
          ?.message ||
        'The source campaign was not found.',
        'source_campaign_not_found',
        Boolean(
          campaignResult.error
        )
      );
    }

    if (
      profileResult.error ||
      !profileResult.data
    ) {
      throw new DeliveryProcessingError(
        profileResult.error
          ?.message ||
        'The campaign owner profile was not found.',
        'owner_profile_not_found',
        Boolean(
          profileResult.error
        )
      );
    }

    if (
      listingResult.error ||
      !listingResult.data
    ) {
      throw new DeliveryProcessingError(
        listingResult.error
          ?.message ||
        'The listing was not found.',
        'listing_not_found',
        Boolean(
          listingResult.error
        )
      );
    }

    if (
      organizationResult.error ||
      !organizationResult.data
    ) {
      throw new DeliveryProcessingError(
        organizationResult.error
          ?.message ||
        'The organization was not found.',
        'organization_not_found',
        Boolean(
          organizationResult.error
        )
      );
    }

    const sourceRecipient =
      recipientResult.data;

    const sourceCampaign =
      campaignResult.data;

    const snapshot =
      recordValue(
        delivery.content_snapshot
      );

    const stopAfterReply =
      String(
        snapshot.stop_after_reply ??
        'true'
      )
        .toLowerCase() !==
      'false';

    if (
      stopAfterReply &&
      (
        sourceRecipient
          .last_replied_at ||
        Number(
          sourceRecipient
            .reply_count ||
          0
        ) > 0
      )
    ) {
      return await finalizeBlocked(
        delivery,
        'stopped',
        'reply_received_before_personal_follow_up'
      );
    }

    if (
      [
        'unsubscribed',
        'suppressed',
        'bounced',
        'complained',
      ].includes(
        sourceRecipient.status
      ) ||
      sourceRecipient
        .unsubscribed_at ||
      sourceRecipient
        .bounced_at ||
      sourceRecipient
        .complained_at
    ) {
      return await finalizeBlocked(
        delivery,
        'suppressed',
        'recipient_suppressed'
      );
    }

    if (
      sourceRecipient.status !==
      'sent'
    ) {
      return await finalizeBlocked(
        delivery,
        'stopped',
        'source_recipient_not_sent'
      );
    }

    if (
      clean(
        sourceCampaign.org_id
      ) !==
        delivery.org_id ||
      clean(
        sourceCampaign
          .owner_user_id
      ) !==
        delivery.owner_user_id ||
      clean(
        sourceCampaign
          .listing_id
      ) !==
        delivery.listing_id
    ) {
      throw new DeliveryProcessingError(
        'The Personal Follow-Up ownership links do not match the source campaign.',
        'delivery_ownership_mismatch',
        false
      );
    }

    const profileRecord =
      profileResult.data as
        JsonRecord;

    const listingRecord =
      listingResult.data as
        JsonRecord;

    const organizationRecord =
      organizationResult.data as
        JsonRecord;

    if (
      clean(
        profileRecord.org_id
      ) !==
        delivery.org_id
    ) {
      throw new DeliveryProcessingError(
        'The campaign owner does not belong to the delivery organization.',
        'owner_organization_mismatch',
        false
      );
    }

    if (
      clean(
        listingRecord.org_id
      ) !==
        delivery.org_id
    ) {
      throw new DeliveryProcessingError(
        'The listing does not belong to the delivery organization.',
        'listing_organization_mismatch',
        false
      );
    }

    const {
      data:
        suppressionData,

      error:
        suppressionError,
    } = await supabaseAdmin
      .from('email_suppressions')
      .select('id')
      .eq(
        'org_id',
        delivery.org_id
      )
      .eq(
        'email_normalized',
        recipientEmail
      )
      .limit(1)
      .maybeSingle();

    if (suppressionError) {
      throw new DeliveryProcessingError(
        suppressionError.message,
        'suppression_check_failed',
        true
      );
    }

    if (suppressionData) {
      return await finalizeBlocked(
        delivery,
        'suppressed',
        'email_suppression_exists'
      );
    }

    const {
      data:
        preferenceData,

      error:
        preferenceError,
    } = await supabaseAdmin
      .from(
        'email_contact_preferences'
      )
      .select(
        'allow_listing_ads'
      )
      .eq(
        'org_id',
        delivery.org_id
      )
      .eq(
        'email_normalized',
        recipientEmail
      )
      .limit(1)
      .maybeSingle();

    if (preferenceError) {
      throw new DeliveryProcessingError(
        preferenceError.message,
        'preference_check_failed',
        true
      );
    }

    if (
      preferenceData
        ?.allow_listing_ads ===
      false
    ) {
      return await finalizeBlocked(
        delivery,
        'suppressed',
        'listing_email_preference_disabled'
      );
    }

    const contactId =
      clean(
        sourceRecipient.contact_id
      );

    if (contactId) {
      const {
        data:
          contactData,

        error:
          contactError,
      } = await supabaseAdmin
        .from('contacts')
        .select(`
          do_not_contact,
          is_archived,
          email_marketing_status
        `)
        .eq(
          'id',
          contactId
        )
        .maybeSingle();

      if (contactError) {
        throw new DeliveryProcessingError(
          contactError.message,
          'contact_safeguard_check_failed',
          true
        );
      }

      if (
        contactData &&
        (
          contactData
            .do_not_contact ===
            true ||
          contactData
            .is_archived ===
            true ||
          clean(
            contactData
              .email_marketing_status
          ) !==
            'active'
        )
      ) {
        return await finalizeBlocked(
          delivery,
          'suppressed',
          'contact_marketing_disabled'
        );
      }
    }

    const unsubscribeUrl =
      complianceUrl(
        '/unsubscribe',
        sourceRecipient
          .unsubscribe_token
      );

    const preferencesUrl =
      complianceUrl(
        '/email-preferences',
        sourceRecipient
          .preferences_token
      );

    if (
      !unsubscribeUrl ||
      !preferencesUrl
    ) {
      throw new DeliveryProcessingError(
        'The source recipient is missing required compliance tokens.',
        'compliance_tokens_missing',
        false
      );
    }

    const profile = {
      ...organizationRecord,
      ...profileRecord,

      marketing_physical_address:
        clean(
          sourceCampaign
            .physical_address
        ) ||
        clean(
          profileRecord
            .marketing_physical_address
        ) ||
        clean(
          organizationRecord
            .marketing_physical_address
        ),
    } as unknown as
      Profile;

    const listing =
      listingResult.data as
        unknown as Listing;

    if (
      profile
        .marketing_email_enabled !==
      true
    ) {
      throw new DeliveryProcessingError(
        'Marketing email is disabled for the campaign owner.',
        'marketing_email_disabled',
        false
      );
    }

    if (
      !clean(
        profile
          .marketing_physical_address
      )
    ) {
      throw new DeliveryProcessingError(
        'A business mailing address is required for the Personal Follow-Up.',
        'physical_address_missing',
        false
      );
    }

    const designSettings =
      recordValue(
        sourceCampaign
          .design_settings
      );

    const personalFollowUp =
      recordValue(
        designSettings
          .personal_follow_up
      );

    const luxuryEdition =
      normalizeLuxuryEmailEdition(
        snapshot.luxury_edition ||
        personalFollowUp
          .luxury_edition ||
        sourceCampaign
          .creative_key ||
        designSettings
          .luxury_edition
      );

    const audience =
      quickNoteAudience(
        delivery.category
      );

    const draft =
      buildQuickNoteEmail({
        listing,

        profile,

        audience,

        contact: {
          first_name:
            delivery.first_name,

          contact_type:
            delivery.category,
        },

        luxury_edition:
          luxuryEdition,

        edition_message_override:
          delivery
            .follow_up_paragraph,

        subject_override:
          delivery.subject,

        preview_text_override:
          delivery.preview_text,

        unsubscribe_url:
          unsubscribeUrl,

        preferences_url:
          preferencesUrl,
      });

    if (
      !clean(
        draft.html
      ) ||
      !clean(
        draft.text
      ) ||
      !clean(
        draft.subject
      )
    ) {
      throw new DeliveryProcessingError(
        'The Personal Follow-Up renderer returned incomplete email content.',
        'follow_up_render_incomplete',
        false
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
      throw new DeliveryProcessingError(
        'Resend environment variables are incomplete.',
        'resend_not_configured',
        true
      );
    }

    const senderName =
      clean(
        profile
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

    const resendResponse =
      await fetch(
        'https://api.resend.com/emails',
        {
          method:
            'POST',

          cache:
            'no-store',

          headers: {
            Authorization:
              `Bearer ${resendApiKey}`,

            'Content-Type':
              'application/json',

            'Idempotency-Key':
              delivery
                .idempotency_key,
          },

          body:
            JSON.stringify({
              from:
                fromValue,

              to: [
                recipientEmail,
              ],

              subject:
                draft.subject,

              html:
                draft.html,

              text:
                draft.text,

              reply_to:
                clean(
                  sourceCampaign
                    .reply_to_email
                ) ||
                clean(
                  profile
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
      throw new DeliveryProcessingError(
        clean(
          resendResult.message
        ) ||
        clean(
          resendResult.error
        ) ||
        'Resend rejected the Personal Follow-Up email.',

        'resend_send_failed',

        resendResponse.status ===
          429 ||
        resendResponse.status >=
          500
      );
    }

    const resendEmailId =
      clean(
        resendResult.id
      );

    if (!resendEmailId) {
      throw new DeliveryProcessingError(
        'Resend accepted the request but did not return an email ID.',
        'resend_email_id_missing',
        true
      );
    }

    acceptedResendEmailId =
      resendEmailId;

    const sentAt =
      new Date()
        .toISOString();

    const {
      data:
        finalizedData,

      error:
        finalizeError,
    } = await supabaseAdmin.rpc(
      'finalize_email_personal_follow_up_sent',
      {
        p_delivery_id:
          delivery.delivery_id,

        p_resend_email_id:
          resendEmailId,

        p_sent_at:
          sentAt,
      }
    );

    if (finalizeError) {
      throw new Error(
        (
          'Resend accepted the Personal Follow-Up, ' +
          'but finalization failed: ' +
          finalizeError.message
        )
      );
    }

    return {
      delivery_id:
        delivery.delivery_id,

      enrollment_id:
        delivery.enrollment_id,

      source_campaign_id:
        delivery.source_campaign_id,

      source_recipient_id:
        delivery.source_recipient_id,

      ok:
        true,

      status:
        'sent',

      sent_at:
        sentAt,

      resend_email_id:
        resendEmailId,

      idempotency_key:
        delivery.idempotency_key,

      finalization:
        finalizedData || null,
    };
  }
  catch (
    error:
      unknown
  ) {
    const message =
      errorMessage(
        error,
        'Personal Follow-Up delivery failed.'
      );

    console.error(
      'Personal Follow-Up delivery error',
      {
        delivery_id:
          delivery.delivery_id,

        accepted_resend_email_id:
          acceptedResendEmailId ||
          null,

        error:
          message,
      }
    );

    if (acceptedResendEmailId) {
      return {
        delivery_id:
          delivery.delivery_id,

        enrollment_id:
          delivery.enrollment_id,

        ok:
          false,

        accepted_by_resend:
          true,

        resend_email_id:
          acceptedResendEmailId,

        code:
          'delivery_finalize_failed',

        error:
          message,
      };
    }

    const controlledError =
      error instanceof
        DeliveryProcessingError
        ? error
        : new DeliveryProcessingError(
            message,
            'unexpected_delivery_error',
            true
          );

    try {
      const failureResult =
        await finalizeFailure(
          delivery,
          controlledError.code,
          controlledError.message,
          controlledError.retryable
        );

      return {
        delivery_id:
          delivery.delivery_id,

        enrollment_id:
          delivery.enrollment_id,

        ok:
          false,

        accepted_by_resend:
          false,

        code:
          controlledError.code,

        retryable:
          controlledError.retryable,

        will_retry:
          failureResult
            .will_retry ===
          true,

        retry_at:
          failureResult
            .retry_at ||
          null,

        error:
          controlledError.message,

        finalization:
          failureResult,
      };
    }
    catch (
      finalizationError:
        unknown
    ) {
      return {
        delivery_id:
          delivery.delivery_id,

        enrollment_id:
          delivery.enrollment_id,

        ok:
          false,

        accepted_by_resend:
          false,

        code:
          'failure_finalize_failed',

        original_code:
          controlledError.code,

        error:
          errorMessage(
            finalizationError,
            'The delivery failure could not be finalized.'
          ),
      };
    }
  }
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

  const processingEnabled =
    clean(
      process.env
        .EMAIL_PERSONAL_FOLLOW_UPS_ENABLED
    )
      .toLowerCase() ===
    'true';

  if (!processingEnabled) {
    return NextResponse.json({
      ok:
        true,

      enabled:
        false,

      checked_at:
        new Date()
          .toISOString(),

      claimed:
        0,

      sent:
        0,

      blocked:
        0,

      failed:
        0,

      message:
        'Personal Follow-Up processing is safely disabled.',
    });
  }

  const startedAt =
    new Date()
      .toISOString();

  try {
    const {
      data:
        claimedData,

      error:
        claimError,
    } = await supabaseAdmin.rpc(
      'claim_email_personal_follow_up_deliveries',
      {
        p_limit:
          MAX_BATCH_SIZE,

        p_claim_seconds:
          CLAIM_SECONDS,
      }
    );

    if (claimError) {
      throw new Error(
        claimError.message
      );
    }

    const deliveries =
      (
        claimedData ||
        []
      ) as ClaimedDelivery[];

    const results:
      JsonRecord[] =
        [];

    for (
      const delivery of
        deliveries
    ) {
      results.push(
        await processDelivery(
          delivery
        )
      );
    }

    const sent =
      results.filter(
        (result) =>
          result.ok ===
            true &&
          result.status ===
            'sent'
      ).length;

    const blocked =
      results.filter(
        (result) =>
          result.blocked ===
          true
      ).length;

    const failed =
      results.filter(
        (result) =>
          result.ok !==
            true &&
          result.blocked !==
            true
      ).length;

    const acceptedButUnfinalized =
      results.filter(
        (result) =>
          result.accepted_by_resend ===
          true
      ).length;

    return NextResponse.json({
      ok:
        failed ===
        0,

      enabled:
        true,

      started_at:
        startedAt,

      completed_at:
        new Date()
          .toISOString(),

      batch_limit:
        MAX_BATCH_SIZE,

      claim_seconds:
        CLAIM_SECONDS,

      claimed:
        deliveries.length,

      sent,

      blocked,

      failed,

      accepted_but_unfinalized:
        acceptedButUnfinalized,

      results,
    });
  }
  catch (
    error:
      unknown
  ) {
    console.error(
      'Personal Follow-Up processor error',
      error
    );

    return NextResponse.json(
      {
        ok:
          false,

        started_at:
          startedAt,

        error:
          errorMessage(
            error,
            'Personal Follow-Up processing failed.'
          ),
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