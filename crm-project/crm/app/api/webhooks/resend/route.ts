import {
  NextResponse,
} from 'next/server';

import {
  Webhook,
} from 'svix';

import {
  supabaseAdmin,
} from '../../../../lib/supabaseAdmin';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

type JsonRecord =
  Record<string, unknown>;

function asRecord(
  value: unknown
): JsonRecord {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as JsonRecord;
  }

  return {};
}

function textValue(
  value: unknown
) {
  if (
    typeof value !== 'string'
  ) {
    return '';
  }

  return value.trim();
}

function jsonResponse(
  body: unknown,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        'Cache-Control':
          'no-store, max-age=0',
      },
    }
  );
}

export async function POST(
  request: Request
) {
  const webhookSecret =
    textValue(
      process.env
        .RESEND_WEBHOOK_SECRET
    );

  if (!webhookSecret) {
    console.error(
      '[resend-webhook] RESEND_WEBHOOK_SECRET is missing.'
    );

    return jsonResponse(
      {
        ok: false,
        error:
          'Webhook verification is not configured.',
      },
      503
    );
  }

  const providerEventId =
    textValue(
      request.headers.get(
        'svix-id'
      )
    );

  const timestamp =
    textValue(
      request.headers.get(
        'svix-timestamp'
      )
    );

  const signature =
    textValue(
      request.headers.get(
        'svix-signature'
      )
    );

  if (
    !providerEventId ||
    !timestamp ||
    !signature
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          'Webhook signature headers are missing.',
      },
      400
    );
  }

  const payload =
    await request.text();

  let verifiedPayload:
    unknown;

  try {
    const webhook =
      new Webhook(
        webhookSecret
      );

    verifiedPayload =
      webhook.verify(
        payload,
        {
          'svix-id':
            providerEventId,

          'svix-timestamp':
            timestamp,

          'svix-signature':
            signature,
        }
      );
  }
  catch (
    verificationError: unknown
  ) {
    console.error(
      '[resend-webhook] Signature verification failed.',
      verificationError
    );

    return jsonResponse(
      {
        ok: false,
        error:
          'Invalid webhook signature.',
      },
      400
    );
  }

  const event =
    asRecord(
      verifiedPayload
    );

  const eventData =
    asRecord(
      event.data
    );

  const eventType =
    textValue(
      event.type
    );

  const resendEmailId =
    textValue(
      eventData.email_id
    );

  const eventAt =
    textValue(
      event.created_at
    ) ||
    new Date().toISOString();

  if (
    !eventType ||
    !resendEmailId
  ) {
    return jsonResponse({
      ok: true,
      ignored: true,
      reason:
        'Webhook does not contain a marketing email event.',
    });
  }

  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    'record_resend_email_event',
    {
      p_provider_event_id:
        providerEventId,

      p_event_type:
        eventType,

      p_resend_email_id:
        resendEmailId,

      p_event_at:
        eventAt,

      p_payload:
        event,
    }
  );

  if (error) {
    console.error(
      '[resend-webhook] Database recording failed.',
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          'Could not record the webhook event.',
      },
      500
    );
  }

  return jsonResponse({
    ok: true,
    result:
      data,
  });
}