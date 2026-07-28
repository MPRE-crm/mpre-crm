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

function safeRpcError(
  message:
    string | undefined
) {
  const normalized =
    String(
      message || ''
    ).toLowerCase();

  if (
    normalized.includes(
      'already unsubscribed'
    )
  ) {
    return {
      status: 409,
      message:
        'This email address is already unsubscribed.',
    };
  }

  if (
    normalized.includes(
      'blocked'
    )
  ) {
    return {
      status: 409,
      message:
        'These preferences cannot be changed from this page.',
    };
  }

  if (
    normalized.includes(
      'invalid'
    ) ||
    normalized.includes(
      'not found'
    )
  ) {
    return {
      status: 400,
      message:
        'This email-preferences link is invalid.',
    };
  }

  return {
    status: 500,
    message:
      'Your email preferences could not be updated.',
  };
}

export async function POST(
  request: Request
) {
  let body:
    unknown;

  try {
    body =
      await request.json();
  }
  catch {
    return json(
      {
        ok: false,
        error:
          'A valid request body is required.',
      },
      400
    );
  }

  if (
    !isEmailComplianceRecord(
      body
    )
  ) {
    return json(
      {
        ok: false,
        error:
          'A valid request body is required.',
      },
      400
    );
  }

  const token =
    cleanEmailComplianceToken(
      body.token
    );

  if (!token) {
    return json(
      {
        ok: false,
        error:
          'This email-preferences link is invalid.',
      },
      400
    );
  }

  const action =
    body.action;

  if (
    action ===
    'unsubscribe'
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        'unsubscribe_email_recipient_by_preferences_token',
        {
          p_preferences_token:
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
        'public preferences unsubscribe failed',
        {
          code:
            error?.code ||
            'invalid_result',
        }
      );

      const safe =
        safeRpcError(
          error?.message
        );

      return json(
        {
          ok: false,
          error:
            safe.message,
        },
        safe.status
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

  if (
    action !==
    'save'
  ) {
    return json(
      {
        ok: false,
        error:
          'A valid preferences action is required.',
      },
      400
    );
  }

  const preferences =
    body.preferences;

  if (
    !isEmailComplianceRecord(
      preferences
    )
  ) {
    return json(
      {
        ok: false,
        error:
          'All email preferences are required.',
      },
      400
    );
  }

  const requiredKeys = [
    'allow_listing_ads',
    'allow_open_house',
    'allow_price_changes',
    'allow_market_updates',
    'allow_newsletters',
  ] as const;

  for (
    const key
    of requiredKeys
  ) {
    if (
      typeof preferences[key] !==
      'boolean'
    ) {
      return json(
        {
          ok: false,
          error:
            'All email preferences are required.',
        },
        400
      );
    }
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin.rpc(
      'save_email_recipient_preferences',
      {
        p_preferences_token:
          token,

        p_allow_listing_ads:
          preferences
            .allow_listing_ads,

        p_allow_open_house:
          preferences
            .allow_open_house,

        p_allow_price_changes:
          preferences
            .allow_price_changes,

        p_allow_market_updates:
          preferences
            .allow_market_updates,

        p_allow_newsletters:
          preferences
            .allow_newsletters,
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
      'public preferences save failed',
      {
        code:
          error?.code ||
          'invalid_result',
      }
    );

    const safe =
      safeRpcError(
        error?.message
      );

    return json(
      {
        ok: false,
        error:
          safe.message,
      },
      safe.status
    );
  }

  return json({
    ok: true,

    email_masked:
      typeof data.email_masked ===
      'string'
        ? data.email_masked
        : 'your email address',

    preferences:
      isEmailComplianceRecord(
        data.preferences
      )
        ? data.preferences
        : preferences,
  });
}
