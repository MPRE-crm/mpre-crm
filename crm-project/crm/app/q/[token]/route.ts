import {
  createHmac,
} from 'node:crypto';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  supabaseAdmin,
} from '../../../lib/supabaseAdmin';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type ScanRpcRow = {
  qr_code_id:
    | string
    | null;

  qr_assignment_id:
    | string
    | null;

  qr_listing_id:
    | string
    | null;

  qr_org_id:
    | string
    | null;

  qr_code_number:
    | number
    | null;

  qr_public_token:
    | string
    | null;

  destination_url:
    | string
    | null;

  assignment_active:
    | boolean
    | null;
};

type DestinationResolution = {
  codeFound: boolean;
  destination: URL | null;
};

const TOKEN_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{3}$/;

const SOURCE_PATTERN =
  /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

const BOT_PATTERN =
  /bot|crawler|spider|slurp|preview|facebookexternalhit|whatsapp|discordbot|telegrambot|linkedinbot|headless|python-requests|curl|wget/i;

function cleanText(
  value: string,
  maximumLength: number
) {
  const cleaned =
    value
      .replace(
        /[\u0000-\u001f\u007f]/g,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim()
      .slice(
        0,
        maximumLength
      );

  return cleaned || null;
}

function normalizeToken(
  value: string | null | undefined
) {
  const token =
    String(
      value || ''
    )
      .trim()
      .toLowerCase();

  if (
    token.length < 5 ||
    token.length > 140 ||
    !TOKEN_PATTERN.test(token)
  ) {
    return null;
  }

  return token;
}

function normalizeSource(
  value: string | null
) {
  const source =
    String(
      value || ''
    )
      .trim()
      .toLowerCase();

  if (
    !source ||
    source.length > 80 ||
    !SOURCE_PATTERN.test(source)
  ) {
    return null;
  }

  return source;
}

function decodeLocationHeader(
  value: string | null,
  maximumLength: number
) {
  const raw =
    String(
      value || ''
    ).trim();

  if (!raw) {
    return null;
  }

  try {
    return cleanText(
      decodeURIComponent(raw),
      maximumLength
    );
  }
  catch {
    return cleanText(
      raw,
      maximumLength
    );
  }
}

function normalizeCountryCode(
  value: string | null
) {
  const countryCode =
    String(
      value || ''
    )
      .trim()
      .toUpperCase();

  return /^[A-Z]{2}$/.test(
    countryCode
  )
    ? countryCode
    : null;
}

function detectProbableBot(
  userAgent: string
) {
  if (!userAgent.trim()) {
    return true;
  }

  return BOT_PATTERN.test(
    userAgent
  );
}

function detectDeviceCategory(
  userAgent: string
):
  | 'mobile'
  | 'tablet'
  | 'desktop'
  | 'other'
  | 'unknown' {
  const normalized =
    userAgent.toLowerCase();

  if (!normalized) {
    return 'unknown';
  }

  if (
    /ipad|tablet|kindle|silk|playbook/.test(
      normalized
    ) ||
    (
      normalized.includes(
        'android'
      ) &&
      !normalized.includes(
        'mobile'
      )
    )
  ) {
    return 'tablet';
  }

  if (
    /mobile|iphone|ipod|android|windows phone/.test(
      normalized
    )
  ) {
    return 'mobile';
  }

  if (
    /windows|macintosh|cros|x11|linux/.test(
      normalized
    )
  ) {
    return 'desktop';
  }

  return 'other';
}

function getReferrerHost(
  request: NextRequest
) {
  const referrer =
    request.headers.get(
      'referer'
    );

  if (!referrer) {
    return null;
  }

  try {
    return cleanText(
      new URL(
        referrer
      ).hostname.toLowerCase(),
      255
    );
  }
  catch {
    return null;
  }
}

function getClientIp(
  request: NextRequest
) {
  const vercelForwardedFor =
    request.headers
      .get(
        'x-vercel-forwarded-for'
      )
      ?.split(',')[0]
      ?.trim();

  if (vercelForwardedFor) {
    return vercelForwardedFor;
  }

  const forwardedFor =
    request.headers
      .get(
        'x-forwarded-for'
      )
      ?.split(',')[0]
      ?.trim();

  if (forwardedFor) {
    return forwardedFor;
  }

  return (
    request.headers
      .get(
        'x-real-ip'
      )
      ?.trim() ||
    null
  );
}

function createAnonymousScannerHash(
  request: NextRequest,
  token: string,
  userAgent: string
) {
  const secret =
    String(
      process.env
        .QR_SCAN_HASH_SECRET ||
      ''
    ).trim();

  const clientIp =
    getClientIp(
      request
    );

  if (
    secret.length < 32 ||
    !clientIp
  ) {
    return null;
  }

  /*
   * The month bucket prevents the anonymous identifier
   * from becoming a permanent cross-period fingerprint.
   *
   * Neither the raw IP address nor the full user-agent
   * string is written to the database.
   */
  const monthBucket =
    new Date()
      .toISOString()
      .slice(
        0,
        7
      );

  const fingerprintInput = [
    token,
    monthBucket,
    clientIp,
    userAgent.slice(
      0,
      500
    ),
  ].join('|');

  return createHmac(
    'sha256',
    secret
  )
    .update(
      fingerprintInput,
      'utf8'
    )
    .digest(
      'hex'
    );
}

function firstRpcRow(
  value: unknown
) {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    return null;
  }

  const firstRow =
    value[0];

  if (
    !firstRow ||
    typeof firstRow !==
      'object'
  ) {
    return null;
  }

  return firstRow as ScanRpcRow;
}

function validDestination(
  value: unknown
) {
  const destination =
    typeof value ===
      'string'
      ? value.trim()
      : '';

  if (!destination) {
    return null;
  }

  try {
    const parsed =
      new URL(
        destination
      );

    if (
      parsed.protocol ===
      'https:'
    ) {
      return parsed;
    }

    const localDevelopmentUrl =
      process.env.NODE_ENV !==
        'production' &&
      parsed.protocol ===
        'http:' &&
      (
        parsed.hostname ===
          'localhost' ||
        parsed.hostname ===
          '127.0.0.1'
      );

    return localDevelopmentUrl
      ? parsed
      : null;
  }
  catch {
    return null;
  }
}

function redirectResponse(
  destination: URL
) {
  const response =
    NextResponse.redirect(
      destination,
      307
    );

  response.headers.set(
    'Cache-Control',
    'no-store, max-age=0'
  );

  response.headers.set(
    'Pragma',
    'no-cache'
  );

  response.headers.set(
    'X-Robots-Tag',
    'noindex, nofollow'
  );

  return response;
}

function unavailableResponse(
  status:
    | 404
    | 410
    | 503
) {
  const heading =
    status === 503
      ? 'Temporarily unavailable'
      : 'Property link unavailable';

  const message =
    status === 503
      ? 'Please try this property link again shortly.'
      : 'This QR code is not currently connected to an available property website.';

  const html =
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${heading}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f8fafc;
      color: #0f172a;
      font-family: Arial, sans-serif;
    }

    main {
      width: min(560px, calc(100% - 40px));
      padding: 40px;
      box-sizing: border-box;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      background: #ffffff;
      text-align: center;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
    }

    h1 {
      margin: 0 0 14px;
      font-size: 28px;
    }

    p {
      margin: 0;
      color: #475569;
      font-size: 17px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <main>
    <h1>${heading}</h1>
    <p>${message}</p>
  </main>
</body>
</html>`;

  return new NextResponse(
    html,
    {
      status,
      headers: {
        'Cache-Control':
          'no-store, max-age=0',

        'Content-Type':
          'text/html; charset=utf-8',

        'X-Robots-Tag':
          'noindex, nofollow',
      },
    }
  );
}

async function resolveDestinationWithoutScan(
  token: string
): Promise<DestinationResolution> {
  const {
    data: code,
    error: codeError,
  } = await supabaseAdmin
    .from(
      'reusable_qr_codes'
    )
    .select(
      'id'
    )
    .eq(
      'public_token',
      token
    )
    .eq(
      'is_enabled',
      true
    )
    .maybeSingle();

  if (codeError) {
    throw codeError;
  }

  if (!code) {
    return {
      codeFound: false,
      destination: null,
    };
  }

  const {
    data: assignment,
    error: assignmentError,
  } = await supabaseAdmin
    .from(
      'reusable_qr_assignments'
    )
    .select(`
      destination_mode,
      manual_destination_url,
      listing_id
    `)
    .eq(
      'qr_code_id',
      code.id
    )
    .is(
      'released_at',
      null
    )
    .order(
      'assigned_at',
      {
        ascending: false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    throw assignmentError;
  }

  if (!assignment) {
    return {
      codeFound: true,
      destination: null,
    };
  }

  if (
    assignment.destination_mode ===
      'manual'
  ) {
    return {
      codeFound: true,
      destination:
        validDestination(
          assignment
            .manual_destination_url
        ),
    };
  }

  if (!assignment.listing_id) {
    return {
      codeFound: true,
      destination: null,
    };
  }

  const {
    data: listing,
    error: listingError,
  } = await supabaseAdmin
    .from(
      'listings'
    )
    .select(`
      website_status,
      public_url
    `)
    .eq(
      'id',
      assignment.listing_id
    )
    .maybeSingle();

  if (listingError) {
    throw listingError;
  }

  if (
    !listing ||
    listing.website_status !==
      'published'
  ) {
    return {
      codeFound: true,
      destination: null,
    };
  }

  return {
    codeFound: true,
    destination:
      validDestination(
        listing.public_url
      ),
  };
}

async function fallbackScan(
  token: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    'record_reusable_qr_scan',
    {
      p_public_token:
        token,

      p_scan_context:
        'public',
    }
  );

  if (error) {
    console.error(
      '[qr-redirect] Basic scan fallback failed.',
      {
        message:
          error.message,
      }
    );

    return null;
  }

  return firstRpcRow(
    data
  );
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const {
    token: rawToken,
  } = await context.params;

  const token =
    normalizeToken(
      rawToken
    );

  if (!token) {
    return unavailableResponse(
      404
    );
  }

  const userAgent =
    request.headers.get(
      'user-agent'
    ) || '';

  const isProbableBot =
    detectProbableBot(
      userAgent
    );

  const source =
    normalizeSource(
      request.nextUrl
        .searchParams
        .get(
          'src'
        ) ||
      request.nextUrl
        .searchParams
        .get(
          'source'
        )
    );

  const city =
    decodeLocationHeader(
      request.headers.get(
        'x-vercel-ip-city'
      ),
      120
    );

  const region =
    decodeLocationHeader(
      request.headers.get(
        'x-vercel-ip-country-region'
      ),
      120
    );

  const countryCode =
    normalizeCountryCode(
      request.headers.get(
        'x-vercel-ip-country'
      )
    );

  const deviceCategory =
    detectDeviceCategory(
      userAgent
    );

  const referrerHost =
    getReferrerHost(
      request
    );

  const anonymousScannerHash =
    isProbableBot
      ? null
      : createAnonymousScannerHash(
          request,
          token,
          userAgent
        );

  const {
    data,
    error,
  } = await supabaseAdmin.rpc(
    'record_reusable_qr_scan_with_context',
    {
      p_public_token:
        token,

      p_scan_context:
        'public',

      p_marketing_source:
        source,

      p_city:
        city,

      p_region:
        region,

      p_country_code:
        countryCode,

      p_device_category:
        deviceCategory,

      p_referrer_host:
        referrerHost,

      p_is_probable_bot:
        isProbableBot,

      p_anonymous_scanner_hash:
        anonymousScannerHash,
    }
  );

  let scanResult =
    firstRpcRow(
      data
    );

  if (error) {
    console.error(
      '[qr-redirect] Contextual scan RPC failed.',
      {
        message:
          error.message,
      }
    );

    scanResult =
      isProbableBot
        ? null
        : await fallbackScan(
            token
          );

    if (!scanResult) {
      try {
        const resolved =
          await resolveDestinationWithoutScan(
            token
          );

        if (!resolved.codeFound) {
          return unavailableResponse(
            404
          );
        }

        if (!resolved.destination) {
          return unavailableResponse(
            410
          );
        }

        return redirectResponse(
          resolved.destination
        );
      }
      catch (fallbackError) {
        console.error(
          '[qr-redirect] Destination fallback failed.',
          {
            message:
              fallbackError instanceof Error
                ? fallbackError.message
                : 'Unknown fallback error',
          }
        );

        return unavailableResponse(
          503
        );
      }
    }
  }

  if (!scanResult) {
    return unavailableResponse(
      404
    );
  }

  if (
    scanResult.assignment_active !==
      true
  ) {
    return unavailableResponse(
      410
    );
  }

  const destination =
    validDestination(
      scanResult.destination_url
    );

  if (!destination) {
    return unavailableResponse(
      410
    );
  }

  return redirectResponse(
    destination
  );
}

export async function HEAD(
  _request: NextRequest,
  context: RouteContext
) {
  const {
    token: rawToken,
  } = await context.params;

  const token =
    normalizeToken(
      rawToken
    );

  if (!token) {
    return unavailableResponse(
      404
    );
  }

  try {
    const resolved =
      await resolveDestinationWithoutScan(
        token
      );

    if (!resolved.codeFound) {
      return unavailableResponse(
        404
      );
    }

    if (!resolved.destination) {
      return unavailableResponse(
        410
      );
    }

    return redirectResponse(
      resolved.destination
    );
  }
  catch (error) {
    console.error(
      '[qr-redirect] HEAD destination lookup failed.',
      {
        message:
          error instanceof Error
            ? error.message
            : 'Unknown lookup error',
      }
    );

    return unavailableResponse(
      503
    );
  }
}
