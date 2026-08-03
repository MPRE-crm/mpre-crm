import {
  createHmac,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "../../../../lib/supabaseAdmin";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

type EngagementEventType =
  | "page_view"
  | "video_play"
  | "video_progress_25"
  | "video_progress_50"
  | "video_progress_75"
  | "video_complete"
  | "video_external_click"
  | "virtual_tour_click"
  | "showing_request_click"
  | "phone_click"
  | "email_click";

type DeviceCategory =
  | "mobile"
  | "tablet"
  | "desktop"
  | "other"
  | "unknown";

type ListingRecord = {
  id: string;
  org_id: string;
  owner_user_id:
    | string
    | null;
  website_slug:
    | string
    | null;
  website_status: string;
  branded_video_url:
    | string
    | null;
  virtual_tour_url:
    | string
    | null;
};

type RequestBody = {
  clientEventId?: unknown;
  listingId?: unknown;
  slug?: unknown;
  visitorId?: unknown;
  sessionId?: unknown;
  eventType?: unknown;
  marketingSource?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  referrerHost?: unknown;
  placement?: unknown;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const EVENT_TYPES =
  new Set<EngagementEventType>([
    "page_view",
    "video_play",
    "video_progress_25",
    "video_progress_50",
    "video_progress_75",
    "video_complete",
    "video_external_click",
    "virtual_tour_click",
    "showing_request_click",
    "phone_click",
    "email_click",
  ]);

const SESSION_DEDUPED_EVENTS =
  new Set<EngagementEventType>([
    "page_view",
    "video_play",
    "video_progress_25",
    "video_progress_50",
    "video_progress_75",
    "video_complete",
  ]);

const VIDEO_PROGRESS: Partial<
  Record<
    EngagementEventType,
    number
  >
> = {
  video_progress_25:
    25,
  video_progress_50:
    50,
  video_progress_75:
    75,
  video_complete:
    100,
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SOURCE_PATTERN =
  /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

const PLACEMENT_PATTERN =
  /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

const SLUG_PATTERN =
  /^[a-z0-9][a-z0-9_-]{0,198}$/;

const BOT_PATTERN =
  /bot|crawler|spider|slurp|preview|facebookexternalhit|whatsapp|discordbot|telegrambot|linkedinbot|headless|python-requests|curl|wget/i;

const rateLimits =
  new Map<
    string,
    RateLimitState
  >();

function jsonResponse(
  body: unknown,
  status: number
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}

function cleanText(
  value: unknown,
  maximumLength: number
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const cleaned =
    value
      .replace(
        /[\u0000-\u001f\u007f]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .slice(
        0,
        maximumLength
      );

  return cleaned ||
    null;
}

function normalizeUuid(
  value: unknown
) {
  const normalized =
    cleanText(
      value,
      36
    )?.toLowerCase() ||
    null;

  return normalized &&
    UUID_PATTERN.test(
      normalized
    )
    ? normalized
    : null;
}

function normalizeSlug(
  value: unknown
) {
  const normalized =
    cleanText(
      value,
      200
    )?.toLowerCase() ||
    null;

  return normalized &&
    SLUG_PATTERN.test(
      normalized
    )
    ? normalized
    : null;
}

function normalizeEventType(
  value: unknown
):
  | EngagementEventType
  | null {
  const normalized =
    cleanText(
      value,
      80
    ) as
      | EngagementEventType
      | null;

  return normalized &&
    EVENT_TYPES.has(
      normalized
    )
    ? normalized
    : null;
}

function normalizeSource(
  value: unknown
) {
  const normalized =
    cleanText(
      value,
      80
    )?.toLowerCase() ||
    null;

  return normalized &&
    SOURCE_PATTERN.test(
      normalized
    )
    ? normalized
    : null;
}

function normalizePlacement(
  value: unknown
) {
  const normalized =
    cleanText(
      value,
      80
    )?.toLowerCase() ||
    null;

  return normalized &&
    PLACEMENT_PATTERN.test(
      normalized
    )
    ? normalized
    : null;
}

function normalizeHost(
  value: unknown
) {
  const cleaned =
    cleanText(
      value,
      500
    );

  if (!cleaned) {
    return null;
  }

  try {
    const url =
      cleaned.includes(
        "://"
      )
        ? new URL(
            cleaned
          )
        : new URL(
            `https://${cleaned}`
          );

    return cleanText(
      url.hostname
        .toLowerCase(),
      255
    );
  }
  catch {
    return null;
  }
}

function normalizeCountryCode(
  value:
    | string
    | null
) {
  const normalized =
    String(
      value ||
      ""
    )
      .trim()
      .toUpperCase();

  return /^[A-Z]{2}$/.test(
    normalized
  )
    ? normalized
    : null;
}

function decodeLocationHeader(
  value:
    | string
    | null,
  maximumLength: number
) {
  if (!value) {
    return null;
  }

  try {
    return cleanText(
      decodeURIComponent(
        value
      ),
      maximumLength
    );
  }
  catch {
    return cleanText(
      value,
      maximumLength
    );
  }
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
): DeviceCategory {
  const normalized =
    userAgent.toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (
    /ipad|tablet|kindle|silk|playbook/.test(
      normalized
    ) ||
    (
      normalized.includes(
        "android"
      ) &&
      !normalized.includes(
        "mobile"
      )
    )
  ) {
    return "tablet";
  }

  if (
    /mobile|iphone|ipod|android|windows phone/.test(
      normalized
    )
  ) {
    return "mobile";
  }

  if (
    /windows|macintosh|cros|x11|linux/.test(
      normalized
    )
  ) {
    return "desktop";
  }

  return "other";
}

function requestReferrerHost(
  request: NextRequest,
  submittedValue: unknown
) {
  const submittedHost =
    normalizeHost(
      submittedValue
    );

  if (submittedHost) {
    return submittedHost;
  }

  return normalizeHost(
    request.headers.get(
      "referer"
    )
  );
}

function getClientIp(
  request: NextRequest
) {
  const vercelForwardedFor =
    request.headers
      .get(
        "x-vercel-forwarded-for"
      )
      ?.split(",")[0]
      ?.trim();

  if (vercelForwardedFor) {
    return vercelForwardedFor;
  }

  const forwardedFor =
    request.headers
      .get(
        "x-forwarded-for"
      )
      ?.split(",")[0]
      ?.trim();

  if (forwardedFor) {
    return forwardedFor;
  }

  return (
    request.headers
      .get(
        "x-real-ip"
      )
      ?.trim() ||
    null
  );
}

function anonymousHash(
  secret: string,
  listingId: string,
  scope: string,
  rawIdentifier: string
) {
  return createHmac(
    "sha256",
    secret
  )
    .update(
      [
        "property-engagement",
        listingId,
        scope,
        rawIdentifier,
      ].join("|"),
      "utf8"
    )
    .digest(
      "hex"
    );
}

function rateLimitKey(
  request: NextRequest,
  secret: string,
  listingId: string,
  sessionHash: string,
  userAgent: string
) {
  const clientIp =
    getClientIp(
      request
    );

  if (!clientIp) {
    return sessionHash;
  }

  return createHmac(
    "sha256",
    secret
  )
    .update(
      [
        "property-engagement-rate-limit",
        listingId,
        clientIp,
        userAgent.slice(
          0,
          500
        ),
      ].join("|"),
      "utf8"
    )
    .digest(
      "hex"
    );
}

function youtubeVideoId(
  value:
    | string
    | null
) {
  if (!value) {
    return null;
  }

  try {
    const url =
      new URL(
        value
      );

    let videoId =
      "";

    if (
      url.hostname.includes(
        "youtu.be"
      )
    ) {
      videoId =
        url.pathname
          .replace(
            /^\/+/,
            ""
          )
          .split("/")[0] ||
        "";
    }
    else if (
      url.hostname.includes(
        "youtube.com"
      )
    ) {
      videoId =
        url.searchParams.get(
          "v"
        ) ||
        "";

      if (
        !videoId &&
        url.pathname.includes(
          "/embed/"
        )
      ) {
        videoId =
          url.pathname
            .split(
              "/embed/"
            )[1]
            ?.split("/")[0] ||
          "";
      }
    }

    return /^[A-Za-z0-9_-]{6,32}$/.test(
      videoId
    )
      ? videoId
      : null;
  }
  catch {
    return null;
  }
}

function externalResourceKey(
  value:
    | string
    | null
) {
  if (!value) {
    return null;
  }

  try {
    const url =
      new URL(
        value
      );

    const resource =
      `${url.hostname.toLowerCase()}${url.pathname}`;

    return cleanText(
      resource,
      240
    );
  }
  catch {
    return null;
  }
}

function isRateLimited(
  key: string
) {
  const now =
    Date.now();

  if (
    rateLimits.size >
    5000
  ) {
    for (
      const [
        storedKey,
        state,
      ] of rateLimits
    ) {
      if (
        state.resetAt <=
        now
      ) {
        rateLimits.delete(
          storedKey
        );
      }
    }
  }

  const existing =
    rateLimits.get(
      key
    );

  if (
    !existing ||
    existing.resetAt <=
      now
  ) {
    rateLimits.set(
      key,
      {
        count: 1,
        resetAt:
          now +
          60000,
      }
    );

    return false;
  }

  existing.count++;

  return existing.count >
    60;
}

function sameOriginRequest(
  request: NextRequest
) {
  const fetchSite =
    request.headers.get(
      "sec-fetch-site"
    );

  if (
    fetchSite &&
    fetchSite !==
      "same-origin" &&
    fetchSite !==
      "none"
  ) {
    return false;
  }

  const origin =
    request.headers.get(
      "origin"
    );

  if (!origin) {
    return true;
  }

  try {
    return (
      new URL(
        origin
      ).origin ===
      request.nextUrl.origin
    );
  }
  catch {
    return false;
  }
}

function eventContextFor(
  request: NextRequest
) {
  const hostname =
    request.nextUrl.hostname
      .toLowerCase();

  return hostname ===
      "localhost" ||
    hostname ===
      "127.0.0.1" ||
    hostname ===
      "::1"
    ? "internal_test"
    : "public";
}

export async function POST(
  request: NextRequest
) {
  if (
    !sameOriginRequest(
      request
    )
  ) {
    return jsonResponse(
      {
        error:
          "Cross-origin engagement submission is not allowed.",
      },
      403
    );
  }

  const contentType =
    request.headers.get(
      "content-type"
    ) ||
    "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json"
      )
  ) {
    return jsonResponse(
      {
        error:
          "A JSON request body is required.",
      },
      415
    );
  }

  let rawBody:
    string;

  try {
    rawBody =
      await request.text();
  }
  catch {
    return jsonResponse(
      {
        error:
          "Unable to read the request body.",
      },
      400
    );
  }

  if (
    Buffer.byteLength(
      rawBody,
      "utf8"
    ) >
    20000
  ) {
    return jsonResponse(
      {
        error:
          "Engagement request is too large.",
      },
      413
    );
  }

  let parsedBody:
    unknown;

  try {
    parsedBody =
      JSON.parse(
        rawBody
      );
  }
  catch {
    return jsonResponse(
      {
        error:
          "Invalid JSON request body.",
      },
      400
    );
  }

  if (
    !parsedBody ||
    typeof parsedBody !==
      "object" ||
    Array.isArray(
      parsedBody
    )
  ) {
    return jsonResponse(
      {
        error:
          "A JSON object is required.",
      },
      400
    );
  }

  const body =
    parsedBody as
      RequestBody;

  const clientEventId =
    normalizeUuid(
      body.clientEventId
    );

  const listingId =
    normalizeUuid(
      body.listingId
    );

  const visitorId =
    normalizeUuid(
      body.visitorId
    );

  const sessionId =
    normalizeUuid(
      body.sessionId
    );

  const slug =
    normalizeSlug(
      body.slug
    );

  const eventType =
    normalizeEventType(
      body.eventType
    );

  if (
    !clientEventId ||
    !listingId ||
    !visitorId ||
    !sessionId ||
    !slug ||
    !eventType
  ) {
    return jsonResponse(
      {
        error:
          "Required engagement identifiers or event type are invalid.",
      },
      400
    );
  }

  const secret =
    String(
      process.env
        .PROPERTY_ENGAGEMENT_HASH_SECRET ||
      process.env
        .QR_SCAN_HASH_SECRET ||
      ""
    ).trim();

  if (
    secret.length <
    32
  ) {
    console.error(
      "[property-engagement] Missing a 32-character engagement hash secret."
    );

    return jsonResponse(
      {
        error:
          "Engagement tracking is temporarily unavailable.",
      },
      503
    );
  }

  const {
    data: listingData,
    error: listingError,
  } = await supabaseAdmin
    .from(
      "listings"
    )
    .select(`
      id,
      org_id,
      owner_user_id,
      website_slug,
      website_status,
      branded_video_url,
      virtual_tour_url
    `)
    .eq(
      "id",
      listingId
    )
    .eq(
      "website_slug",
      slug
    )
    .eq(
      "website_status",
      "published"
    )
    .maybeSingle();

  if (
    listingError
  ) {
    console.error(
      "[property-engagement] Published listing validation failed.",
      {
        message:
          listingError.message,
      }
    );

    return jsonResponse(
      {
        error:
          "Unable to validate the property website.",
      },
      500
    );
  }

  if (!listingData) {
    return jsonResponse(
      {
        error:
          "Published property website was not found.",
      },
      404
    );
  }

  const listing =
    listingData as
      ListingRecord;

  const visitorHash =
    anonymousHash(
      secret,
      listing.id,
      "visitor",
      visitorId
    );

  const sessionHash =
    anonymousHash(
      secret,
      listing.id,
      "session",
      sessionId
    );

  const userAgent =
    request.headers.get(
      "user-agent"
    ) ||
    "";

  if (
    isRateLimited(
      rateLimitKey(
        request,
        secret,
        listing.id,
        sessionHash,
        userAgent
      )
    )
  ) {
    return jsonResponse(
      {
        error:
          "Too many engagement events.",
      },
      429
    );
  }

  const isProbableBot =
    detectProbableBot(
      userAgent
    );

  const deviceCategory =
    detectDeviceCategory(
      userAgent
    );

  const city =
    decodeLocationHeader(
      request.headers.get(
        "x-vercel-ip-city"
      ),
      120
    );

  const region =
    decodeLocationHeader(
      request.headers.get(
        "x-vercel-ip-country-region"
      ),
      120
    );

  const countryCode =
    normalizeCountryCode(
      request.headers.get(
        "x-vercel-ip-country"
      )
    );

  const eventContext =
    eventContextFor(
      request
    );

  const placement =
    normalizePlacement(
      body.placement
    );

  let mediaProvider:
    | string
    | null =
    null;

  let mediaResourceKey:
    | string
    | null =
    null;

  if (
    eventType ===
      "video_play" ||
    eventType ===
      "video_progress_25" ||
    eventType ===
      "video_progress_50" ||
    eventType ===
      "video_progress_75" ||
    eventType ===
      "video_complete"
  ) {
    const videoId =
      youtubeVideoId(
        listing
          .branded_video_url
      );

    if (!videoId) {
      return jsonResponse(
        {
          error:
            "The listing does not have a trackable embedded video.",
        },
        422
      );
    }

    mediaProvider =
      "youtube";

    mediaResourceKey =
      videoId;
  }
  else if (
    eventType ===
    "video_external_click"
  ) {
    if (
      !listing
        .branded_video_url
    ) {
      return jsonResponse(
        {
          error:
            "The listing does not have a property film.",
        },
        422
      );
    }

    const videoId =
      youtubeVideoId(
        listing
          .branded_video_url
      );

    mediaProvider =
      videoId
        ? "youtube"
        : "external_video";

    mediaResourceKey =
      videoId ||
      externalResourceKey(
        listing
          .branded_video_url
      );
  }
  else if (
    eventType ===
    "virtual_tour_click"
  ) {
    if (
      !listing
        .virtual_tour_url
    ) {
      return jsonResponse(
        {
          error:
            "The listing does not have a virtual tour.",
        },
        422
      );
    }

    mediaProvider =
      "virtual_tour";

    mediaResourceKey =
      externalResourceKey(
        listing
          .virtual_tour_url
      );
  }

  const progressPercent =
    VIDEO_PROGRESS[
      eventType
    ] ||
    null;

  if (
    SESSION_DEDUPED_EVENTS.has(
      eventType
    )
  ) {
    let duplicateQuery =
      supabaseAdmin
        .from(
          "listing_website_engagement_events"
        )
        .select(
          "id"
        )
        .eq(
          "listing_id",
          listing.id
        )
        .eq(
          "anonymous_session_hash",
          sessionHash
        )
        .eq(
          "event_type",
          eventType
        )
        .eq(
          "event_context",
          eventContext
        )
        .limit(1);

    duplicateQuery =
      mediaResourceKey
        ? duplicateQuery.eq(
            "media_resource_key",
            mediaResourceKey
          )
        : duplicateQuery.is(
            "media_resource_key",
            null
          );

    const {
      data: existingEvent,
      error: duplicateError,
    } = await duplicateQuery
      .maybeSingle();

    if (
      duplicateError
    ) {
      console.error(
        "[property-engagement] Session deduplication check failed.",
        {
          message:
            duplicateError.message,
        }
      );
    }
    else if (
      existingEvent
    ) {
      return jsonResponse(
        {
          ok:
            true,
          duplicate:
            true,
        },
        200
      );
    }
  }

  const eventMetadata =
    placement
      ? {
          placement,
        }
      : {};

  const {
    error: insertError,
  } = await supabaseAdmin
    .from(
      "listing_website_engagement_events"
    )
    .insert({
      client_event_id:
        clientEventId,

      listing_id:
        listing.id,

      org_id:
        listing.org_id,

      owner_user_id:
        listing.owner_user_id,

      event_type:
        eventType,

      event_context:
        eventContext,

      page_path:
        `/property/${listing.website_slug || slug}`,

      marketing_source:
        normalizeSource(
          body.marketingSource
        ),

      utm_source:
        cleanText(
          body.utmSource,
          160
        ),

      utm_medium:
        cleanText(
          body.utmMedium,
          160
        ),

      utm_campaign:
        cleanText(
          body.utmCampaign,
          200
        ),

      utm_content:
        cleanText(
          body.utmContent,
          200
        ),

      referrer_host:
        requestReferrerHost(
          request,
          body.referrerHost
        ),

      device_category:
        deviceCategory,

      city,
      region,
      country_code:
        countryCode,

      is_probable_bot:
        isProbableBot,

      anonymous_visitor_hash:
        isProbableBot
          ? null
          : visitorHash,

      anonymous_session_hash:
        isProbableBot
          ? null
          : sessionHash,

      media_provider:
        mediaProvider,

      media_resource_key:
        mediaResourceKey,

      progress_percent:
        progressPercent,

      event_metadata:
        eventMetadata,
    });

  if (
    insertError?.code ===
    "23505"
  ) {
    return jsonResponse(
      {
        ok:
          true,
        duplicate:
          true,
      },
      200
    );
  }

  if (insertError) {
    console.error(
      "[property-engagement] Event insert failed.",
      {
        message:
          insertError.message,
        code:
          insertError.code,
      }
    );

    return jsonResponse(
      {
        error:
          "Unable to record engagement.",
      },
      500
    );
  }

  return jsonResponse(
    {
      ok:
        true,
      duplicate:
        false,
    },
    201
  );
}
