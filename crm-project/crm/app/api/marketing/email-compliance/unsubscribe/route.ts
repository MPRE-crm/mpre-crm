import {
  NextResponse,
} from 'next/server';

import {
  cleanEmailComplianceToken,
  isEmailComplianceRecord,
} from '../../../../../lib/email-compliance-public';

import {
  supabaseAdmin,
} from '../../../../../lib/supabaseAdmin';

export const dynamic =
  'force-dynamic';

const noStoreHeaders = {
  'Cache-Control':
    'no-store, max-age=0',
};

function json(
  payload:
    Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    payload,
    {
      status,
      headers:
        noStoreHeaders,
    }
  );
}

async function readToken(
  request: Request
) {
  const urlToken =
    new URL(
      request.url
    ).searchParams.get(
      'token'
    );

  const contentType =
    request.headers.get(
      'content-type'
    ) || '';

  let bodyToken:
    unknown = null;

  if (
    contentType.includes(
      'application/json'
    )
  ) {
    try {
      const body =
        await request.json();

      if (
        isEmailComplianceRecord(
          body
        )
      ) {
        bodyToken =
          body.token;
      }
    }
    catch {
      bodyToken = null;
    }
  }
  else if (
    contentType.includes(
      'application/x-www-form-urlencoded'
    ) ||
    contentType.includes(
      'multipart/form-data'
    )
  ) {
    try {
      const form =
        await request.formData();

      const formTokenReader =
        (
          form as unknown as {
            get?: (
              name: string
            ) => unknown;
          }
        ).get;

      bodyToken =
        typeof formTokenReader ===
        'function'
          ? formTokenReader.call(
              form,
              'token'
            )
          : null;
    }
    catch {
      bodyToken = null;
    }
  }

  return cleanEmailComplianceToken(
    bodyToken ||
    urlToken
  );
}

export async function POST(
  request: Request
) {
  const token =
    await readToken(
      request
    );

  if (!token) {
    return json(
      {
        ok: false,
        error:
          'This unsubscribe link is invalid.',
      },
      400
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin.rpc(
      'unsubscribe_email_recipient_by_token',
      {
        p_unsubscribe_token:
          token,
      }
    );

  if (
    error ||
    !isEmailComplianceRecord(
      data
    ) ||
    data.ok !== true
  ) {
    console.error(
      'public unsubscribe failed',
      {
        code:
          error?.code ||
          'invalid_result',
      }
    );

    return json(
      {
        ok: false,
        error:
          'This unsubscribe request could not be completed.',
      },
      400
    );
  }

  return json({
    ok: true,

    email_masked:
      typeof data.email_masked ===
      'string'
        ? data.email_masked
        : 'your email address',

    already_unsubscribed:
      data
        .already_unsubscribed ===
      true,
  });
}
