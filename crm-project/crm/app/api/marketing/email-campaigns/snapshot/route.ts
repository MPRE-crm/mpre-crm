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

type SnapshotResult = {
  campaign_id?: unknown;
  snapshotted_at?: unknown;
  saved_recipients?: unknown;
  stale_recipients_removed?: unknown;
  mass_send_unlocked?: unknown;
};

type RecipientContext = {
  contact?: {
    contact_category?: unknown;
  } | null;

  samantha_classification?: {
    audience?: unknown;
  } | null;

  verified_listing_buyer_match?: unknown;
};

type ProofRow = {
  id: string;
  email_normalized: string | null;
  first_name: string | null;
  display_name: string | null;
  realtor_match_id: string | null;
  unsubscribe_token: string | null;
  tracking_token: string | null;
  preferences_token: string | null;
  recipient_context:
    | RecipientContext
    | null;
};

class SnapshotError extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 400,
    code = 'recipient_snapshot_error'
  ) {
    super(message);
    this.name = 'SnapshotError';
    this.status = status;
    this.code = code;
  }
}

function clean(
  value: unknown
): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function normalizedEmail(
  value: unknown
): string {
  return clean(value).toLowerCase();
}

function integerValue(
  value: unknown
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? Math.trunc(parsed)
    : 0;
}

function snapshotRpcError(
  message: string
): SnapshotError {
  const normalized =
    clean(message) ||
    'Recipient snapshot failed.';

  if (
    normalized.includes(
      'Campaign was not found'
    )
  ) {
    return new SnapshotError(
      normalized,
      404,
      'campaign_not_found'
    );
  }

  if (
    normalized.includes(
      'Requester cannot manage this campaign'
    )
  ) {
    return new SnapshotError(
      normalized,
      403,
      'campaign_access_denied'
    );
  }

  if (
    normalized.includes(
      'Requester profile was not found'
    )
  ) {
    return new SnapshotError(
      normalized,
      403,
      'requester_profile_not_found'
    );
  }

  if (
    normalized.includes(
      'Recipients can be rebuilt only while the campaign is a draft'
    )
  ) {
    return new SnapshotError(
      normalized,
      409,
      'campaign_not_draft'
    );
  }

  if (
    normalized.includes(
      'recipient delivery history'
    )
  ) {
    return new SnapshotError(
      normalized,
      409,
      'recipient_history_exists'
    );
  }

  if (
    normalized.includes(
      'audience source is not yet supported'
    )
  ) {
    return new SnapshotError(
      normalized,
      409,
      'unsupported_audience_source'
    );
  }

  if (
    normalized.includes(
      'A listing is required'
    )
  ) {
    return new SnapshotError(
      normalized,
      409,
      'listing_required'
    );
  }

  return new SnapshotError(
    normalized,
    500,
    'recipient_snapshot_rpc_failed'
  );
}

function responseStatus(
  error: unknown
): number {
  if (
    error instanceof SnapshotError
  ) {
    return error.status;
  }

  return requestErrorStatus(error);
}

function responseCode(
  error: unknown
): string {
  if (
    error instanceof SnapshotError
  ) {
    return error.code;
  }

  if (
    error instanceof RequestAuthError
  ) {
    return 'authorization_error';
  }

  return 'unexpected_error';
}

export async function POST(
  request: Request
) {
  try {
    const profile =
      await requireAuthenticatedProfile(
        request
      );

    const body =
      await request
        .json()
        .catch(() => null) as
          | Record<string, unknown>
          | null;

    const campaignId =
      clean(body?.campaign_id);

    if (!campaignId) {
      throw new SnapshotError(
        'campaign_id is required.'
      );
    }

    const proofEmailInput =
      body?.proof_emails;

    const proofEmails =
      Array.isArray(proofEmailInput)
        ? Array.from(
            new Set(
              proofEmailInput
                .map(normalizedEmail)
                .filter(Boolean)
            )
          ).slice(0, 20)
        : [];

    const {
      data: snapshotData,
      error: snapshotError,
    } = await supabaseAdmin.rpc(
      'replace_email_campaign_recipient_snapshot',
      {
        p_campaign_id: campaignId,
        p_requester_id: profile.id,
      }
    );

    if (snapshotError) {
      throw snapshotRpcError(
        snapshotError.message
      );
    }

    const snapshot =
      (snapshotData || {}) as
        SnapshotResult;

    const savedRecipients =
      integerValue(
        snapshot.saved_recipients
      );

    const staleRecipientsRemoved =
      integerValue(
        snapshot
          .stale_recipients_removed
      );

    let proofQuery =
      supabaseAdmin
        .from(
          'email_campaign_recipients'
        )
        .select(`
          id,
          email_normalized,
          first_name,
          display_name,
          realtor_match_id,
          unsubscribe_token,
          tracking_token,
          preferences_token,
          recipient_context
        `)
        .eq(
          'campaign_id',
          campaignId
        )
        .order(
          'email_normalized',
          {
            ascending: true,
          }
        );

    if (proofEmails.length > 0) {
      proofQuery =
        proofQuery.in(
          'email_normalized',
          proofEmails
        );
    }

    const {
      data: proofData,
      error: proofError,
    } = await proofQuery.limit(20);

    if (proofError) {
      throw new SnapshotError(
        proofError.message,
        500,
        'recipient_proof_query_failed'
      );
    }

    const proof =
      (
        (proofData || []) as
          ProofRow[]
      ).map((row) => {
        const context =
          row.recipient_context;

        return {
          id: row.id,

          email_normalized:
            row.email_normalized,

          first_name:
            row.first_name,

          display_name:
            row.display_name,

          contact_category:
            clean(
              context
                ?.contact
                ?.contact_category
            ) || null,

          audience:
            clean(
              context
                ?.samantha_classification
                ?.audience
            ) || null,

          verified_listing_buyer_match:
            context
              ?.verified_listing_buyer_match ===
            true,

          realtor_match_id:
            row.realtor_match_id,

          has_unsubscribe_token:
            Boolean(
              row.unsubscribe_token
            ),

          has_tracking_token:
            Boolean(
              row.tracking_token
            ),

          has_preferences_token:
            Boolean(
              row.preferences_token
            ),
        };
      });

    return NextResponse.json({
      ok: true,

      campaign_id:
        clean(
          snapshot.campaign_id
        ) || campaignId,

      snapshotted_at:
        clean(
          snapshot.snapshotted_at
        ) || null,

      eligible_contacts:
        savedRecipients,

      saved_recipients:
        savedRecipients,

      stale_recipients_removed:
        staleRecipientsRemoved,

      proof,

      mass_send_unlocked:
        false,
    });
  }
  catch (error: unknown) {
    console.error(
      'campaign recipient snapshot error',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        code:
          responseCode(error),

        error:
          error instanceof Error
            ? error.message
            : 'Recipient snapshot failed.',
      },
      {
        status:
          responseStatus(error),
      }
    );
  }
}