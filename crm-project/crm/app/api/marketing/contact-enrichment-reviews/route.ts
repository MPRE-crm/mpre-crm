import {
  NextResponse,
} from "next/server";

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../lib/server/authenticatedProfile";

import {
  supabaseAdmin,
} from "../../../../lib/supabaseAdmin";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  30;

const REVIEW_STATUSES =
  new Set([
    "pending",
    "approved",
    "rejected",
    "resolved",
    "ignored",
  ]);

const REVIEW_ACTIONS =
  new Set([
    "approve",
    "reject",
    "ignore",
    "resolve",
  ]);

const RELATED_QUERY_CHUNK =
  200;

function chunkValues<T>(
  values: T[],
  size: number
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
}

type ReviewRow = {
  id: string;
  org_id: string;

  owner_user_id:
    | string
    | null;

  contact_id:
    | string
    | null;

  listing_id:
    | string
    | null;

  realtor_match_id:
    | string
    | null;

  issue_type: string;

  field_name:
    | string
    | null;

  current_value:
    | string
    | null;

  proposed_value:
    | string
    | null;

  source: string;
  status: string;

  confidence:
    | number
    | string
    | null;

  details: Record<
    string,
    unknown
  >;

  created_at: string;
  updated_at: string;
};

type ContactRow = {
  id: string;

  first_name:
    | string
    | null;

  last_name:
    | string
    | null;

  display_name:
    | string
    | null;

  company:
    | string
    | null;

  email:
    | string
    | null;

  phone:
    | string
    | null;

  mls_agent_id:
    | string
    | null;

  mls_office_id:
    | string
    | null;

  license_number:
    | string
    | null;

  contact_review_status:
    | string
    | null;
};

type MatchRow = {
  id: string;

  agent_display_name:
    | string
    | null;

  agent_email:
    | string
    | null;

  agent_company:
    | string
    | null;

  external_agent_id:
    | string
    | null;

  external_office_id:
    | string
    | null;
};

class ReviewRequestError
  extends Error {
  status: number;

  constructor(
    message: string,
    status = 400
  ) {
    super(message);

    this.name =
      "ReviewRequestError";

    this.status =
      status;
  }
}

function cleanText(
  value: unknown,
  maximumLength = 200
) {
  const normalized =
    String(
      value ?? ""
    )
      .replace(/\s+/g, " ")
      .trim();

  return normalized
    ? normalized.slice(
        0,
        maximumLength
      )
    : null;
}

function responseStatus(
  error: unknown
) {
  if (
    error instanceof
      ReviewRequestError
  ) {
    return error.status;
  }

  return requestErrorStatus(
    error
  );
}

function rpcErrorStatus(
  message: string
) {
  const normalized =
    message.toLowerCase();

  if (
    normalized.includes(
      "was not found"
    )
  ) {
    return 404;
  }

  if (
    normalized.includes(
      "cannot manage"
    )
  ) {
    return 403;
  }

  if (
    normalized.includes(
      "no longer pending"
    ) ||
    normalized.includes(
      "changed after this review"
    ) ||
    normalized.includes(
      "already assigned"
    )
  ) {
    return 409;
  }

  return 400;
}

function applyAccessScope(
  query: any,
  profile: {
    id: string;
    org_id: string | null;
    role: string;
  }
) {
  if (
    profile.role ===
    "platform_admin"
  ) {
    return query;
  }

  if (
    !profile.org_id
  ) {
    throw new ReviewRequestError(
      "Your CRM profile does not have an organization.",
      403
    );
  }

  const organizationQuery =
    query.eq(
      "org_id",
      profile.org_id
    );

  if (
    profile.role ===
      "admin" ||
    profile.role ===
      "org_admin"
  ) {
    return organizationQuery;
  }

  if (
    profile.role ===
    "agent"
  ) {
    return organizationQuery.eq(
      "owner_user_id",
      profile.id
    );
  }

  throw new ReviewRequestError(
    "You do not have access to contact enrichment reviews.",
    403
  );
}

async function relatedContacts(
  reviewRows: ReviewRow[]
) {
  const contactIds =
    Array.from(
      new Set(
        reviewRows
          .map(
            (review) =>
              review.contact_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          )
      )
    );

  if (
    contactIds.length === 0
  ) {
    return new Map<
      string,
      ContactRow
    >();
  }

  const contacts:
    ContactRow[] = [];

  for (
    const contactIdChunk of
      chunkValues(
        contactIds,
        RELATED_QUERY_CHUNK
      )
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("contacts")
        .select(`
          id,
          first_name,
          last_name,
          display_name,
          company,
          email,
          phone,
          mls_agent_id,
          mls_office_id,
          license_number,
          contact_review_status
        `)
        .in(
          "id",
          contactIdChunk
        );

    if (error) {
      throw new ReviewRequestError(
        `Could not load review contacts: ${error.message}`,
        500
      );
    }

    contacts.push(
      ...(
        (
          data ||
          []
        ) as ContactRow[]
      )
    );
  }

  return new Map(
    contacts.map(
      (contact) => [
        contact.id,
        contact,
      ]
    )
  );
}

async function relatedMatches(
  reviewRows: ReviewRow[]
) {
  const matchIds =
    Array.from(
      new Set(
        reviewRows
          .map(
            (review) =>
              review.realtor_match_id
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          )
      )
    );

  if (
    matchIds.length === 0
  ) {
    return new Map<
      string,
      MatchRow
    >();
  }

  const matches:
    MatchRow[] = [];

  for (
    const matchIdChunk of
      chunkValues(
        matchIds,
        RELATED_QUERY_CHUNK
      )
  ) {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "listing_realtor_matches"
        )
        .select(`
          id,
          agent_display_name,
          agent_email,
          agent_company,
          external_agent_id,
          external_office_id
        `)
        .in(
          "id",
          matchIdChunk
        );

    if (error) {
      throw new ReviewRequestError(
        `Could not load Realtor-match review details: ${error.message}`,
        500
      );
    }

    matches.push(
      ...(
        (
          data ||
          []
        ) as MatchRow[]
      )
    );
  }

  return new Map(
    matches.map(
      (match) => [
        match.id,
        match,
      ]
    )
  );
}

export async function GET(
  request: Request
) {
  try {
    const profile =
      await requireAuthenticatedProfile(
        request
      );

    const url =
      new URL(
        request.url
      );

    const requestedStatus =
      cleanText(
        url.searchParams.get(
          "status"
        ),
        50
      ) ||
      "pending";

    const issueType =
      cleanText(
        url.searchParams.get(
          "issue_type"
        ),
        100
      );

    let query =
      supabaseAdmin
        .from(
          "contact_enrichment_reviews"
        )
        .select(`
          id,
          org_id,
          owner_user_id,
          contact_id,
          listing_id,
          realtor_match_id,
          issue_type,
          field_name,
          current_value,
          proposed_value,
          source,
          status,
          confidence,
          details,
          created_at,
          updated_at
        `)
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          1000
        );

    query =
      applyAccessScope(
        query,
        profile
      );

    if (
      requestedStatus !==
      "all"
    ) {
      if (
        !REVIEW_STATUSES.has(
          requestedStatus
        )
      ) {
        throw new ReviewRequestError(
          "Review status filter is invalid."
        );
      }

      query =
        query.eq(
          "status",
          requestedStatus
        );
    }

    if (issueType) {
      query =
        query.eq(
          "issue_type",
          issueType
        );
    }

    const {
      data,
      error,
    } =
      await query;

    if (error) {
      throw new ReviewRequestError(
        `Could not load contact enrichment reviews: ${error.message}`,
        500
      );
    }

    const reviewRows =
      (
        data ||
        []
      ) as ReviewRow[];

    const [
      contactMap,
      matchMap,
    ] =
      await Promise.all([
        relatedContacts(
          reviewRows
        ),

        relatedMatches(
          reviewRows
        ),
      ]);

    return NextResponse.json({
      ok: true,

      reviews:
        reviewRows.map(
          (review) => ({
            ...review,

            contact:
              review.contact_id
                ? contactMap.get(
                    review.contact_id
                  ) ||
                  null
                : null,

            realtor_match:
              review
                .realtor_match_id
                ? matchMap.get(
                    review
                      .realtor_match_id
                  ) ||
                  null
                : null,
          })
        ),
    });
  } catch (error) {
    const status =
      responseStatus(
        error
      );

    const message =
      error instanceof Error
        ? error.message
        : "Could not load contact enrichment reviews.";

    if (
      !(
        error instanceof
        RequestAuthError
      )
    ) {
      console.error(
        "contact enrichment review load error",
        message
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          message,
      },
      {
        status,
      }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const profile =
      await requireAuthenticatedProfile(
        request
      );

    let body: any;

    try {
      body =
        await request.json();
    } catch {
      throw new ReviewRequestError(
        "Request body must be valid JSON."
      );
    }

    const reviewId =
      cleanText(
        body?.review_id,
        100
      );

    const action =
      cleanText(
        body?.action,
        50
      )?.toLowerCase();

    if (!reviewId) {
      throw new ReviewRequestError(
        "review_id is required."
      );
    }

    if (
      !action ||
      !REVIEW_ACTIONS.has(
        action
      )
    ) {
      throw new ReviewRequestError(
        "action must be approve, reject, ignore, or resolve."
      );
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .rpc(
          "apply_contact_enrichment_review_action",
          {
            p_review_id:
              reviewId,

            p_requester_id:
              profile.id,

            p_action:
              action,
          }
        );

    if (error) {
      throw new ReviewRequestError(
        error.message,
        rpcErrorStatus(
          error.message
        )
      );
    }

    return NextResponse.json({
      ok: true,
      result:
        data,
    });
  } catch (error) {
    const status =
      responseStatus(
        error
      );

    const message =
      error instanceof Error
        ? error.message
        : "Could not process the contact enrichment review.";

    if (
      !(
        error instanceof
        RequestAuthError
      )
    ) {
      console.error(
        "contact enrichment review action error",
        message
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          message,
      },
      {
        status,
      }
    );
  }
}