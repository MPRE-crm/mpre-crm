import {
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from '../../../../lib/server/authenticatedProfile';

import {
  supabaseAdmin,
} from '../../../../lib/supabaseAdmin';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

const CANONICAL_SITE_URL =
  'https://easyrealtor.homes';

type Requester = {
  id: string;
  org_id: string | null;
  role: string;
};

type ListingRow = {
  id: string;
  org_id: string;
  owner_user_id: string | null;
  title: string;
  property_address: string;
  website_status: string | null;
  public_url: string | null;
};

type AssignmentRow = {
  id: string;
  qr_code_id: string;
  destination_mode: string;
  manual_destination_url:
    | string
    | null;
  assigned_at: string;
};

type QrCodeRow = {
  id: string;
  code_number: number;
  public_token: string;
  is_enabled: boolean;
};

class ListingQrError extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 500,
    code = 'listing_qr_error'
  ) {
    super(message);

    this.name =
      'ListingQrError';

    this.status =
      status;

    this.code =
      code;
  }
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

function cleanUuid(
  value: unknown
) {
  const result =
    String(
      value || ''
    ).trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      result
    )
  ) {
    return '';
  }

  return result;
}

function bearerToken(
  request: Request
) {
  const authorization =
    request.headers.get(
      'authorization'
    ) || '';

  const match =
    /^Bearer\s+(.+)$/i.exec(
      authorization.trim()
    );

  return match?.[1]?.trim() ||
    '';
}

function requesterFromProfile(
  profile: {
    id: string;
    org_id:
      | string
      | null;
    role: string;
  }
): Requester {
  return {
    id:
      profile.id,

    org_id:
      profile.org_id ||
      null,

    role:
      String(
        profile.role || ''
      ),
  };
}

function canManageListing(
  requester: Requester,
  listing: ListingRow
) {
  if (
    requester.role ===
    'platform_admin'
  ) {
    return true;
  }

  if (
    !requester.org_id ||
    requester.org_id !==
      listing.org_id
  ) {
    return false;
  }

  if (
    requester.role ===
      'admin' ||
    requester.role ===
      'org_admin'
  ) {
    return true;
  }

  return (
    requester.role ===
      'agent' &&
    requester.id ===
      listing.owner_user_id
  );
}

function validHttpsUrl(
  value: unknown
) {
  const text =
    String(
      value || ''
    ).trim();

  if (!text) {
    return null;
  }

  try {
    const parsed =
      new URL(text);

    if (
      parsed.protocol !==
        'https:' ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function authenticatedClient(
  request: Request
) {
  const token =
    bearerToken(
      request
    );

  if (!token) {
    throw new ListingQrError(
      'Missing authentication token.',
      401,
      'authentication_required'
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env
      .SUPABASE_ANON_KEY ||
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !anonKey
  ) {
    throw new ListingQrError(
      'Supabase server configuration is incomplete.',
      500,
      'supabase_configuration_error'
    );
  }

  return createClient(
    supabaseUrl,
    anonKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },

      global: {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      },
    }
  );
}

async function loadListing(
  listingId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      'listings'
    )
    .select(`
      id,
      org_id,
      owner_user_id,
      title,
      property_address,
      website_status,
      public_url
    `)
    .eq(
      'id',
      listingId
    )
    .maybeSingle();

  if (error) {
    throw new ListingQrError(
      error.message ||
        'The listing could not be loaded.',
      500,
      'listing_load_failed'
    );
  }

  if (!data) {
    throw new ListingQrError(
      'Listing not found.',
      404,
      'listing_not_found'
    );
  }

  return data as
    ListingRow;
}

async function loadAssignment(
  listing: ListingRow
) {
  const {
    data:
      assignmentData,
    error:
      assignmentError,
  } = await supabaseAdmin
    .from(
      'reusable_qr_assignments'
    )
    .select(`
      id,
      qr_code_id,
      destination_mode,
      manual_destination_url,
      assigned_at
    `)
    .eq(
      'listing_id',
      listing.id
    )
    .is(
      'released_at',
      null
    )
    .order(
      'assigned_at',
      {
        ascending:
          false,
      }
    )
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    throw new ListingQrError(
      assignmentError.message ||
        'The QR assignment could not be loaded.',
      500,
      'qr_assignment_load_failed'
    );
  }

  if (!assignmentData) {
    return null;
  }

  const assignment =
    assignmentData as
      AssignmentRow;

  const {
    data:
      codeData,
    error:
      codeError,
  } = await supabaseAdmin
    .from(
      'reusable_qr_codes'
    )
    .select(`
      id,
      code_number,
      public_token,
      is_enabled
    `)
    .eq(
      'id',
      assignment.qr_code_id
    )
    .maybeSingle();

  if (codeError) {
    throw new ListingQrError(
      codeError.message ||
        'The reusable QR code could not be loaded.',
      500,
      'qr_code_load_failed'
    );
  }

  if (!codeData) {
    throw new ListingQrError(
      'The active assignment references a missing reusable QR code.',
      500,
      'qr_code_missing'
    );
  }

  const code =
    codeData as QrCodeRow;

  const publicUrl =
    `${CANONICAL_SITE_URL}/q/${encodeURIComponent(
      code.public_token
    )}`;

  const destinationUrl =
    assignment.destination_mode ===
      'manual'
      ? validHttpsUrl(
          assignment
            .manual_destination_url
        )
      : (
          listing.website_status ===
            'published'
            ? validHttpsUrl(
                listing.public_url
              )
            : null
        );

  return {
    id:
      assignment.id,

    qr_code_id:
      code.id,

    code_number:
      code.code_number,

    public_token:
      code.public_token,

    public_url:
      publicUrl,

    flyer_url:
      `${publicUrl}?source=flyer`,

    destination_url:
      destinationUrl,

    destination_mode:
      assignment
        .destination_mode,

    assigned_at:
      assignment.assigned_at,

    status:
      code.is_enabled
        ? 'assigned'
        : 'disabled',
  };
}

function errorStatus(
  error: unknown
) {
  if (
    error instanceof
    ListingQrError
  ) {
    return error.status;
  }

  return requestErrorStatus(
    error
  );
}

function errorCode(
  error: unknown
) {
  if (
    error instanceof
    ListingQrError
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

function errorMessage(
  error: unknown
) {
  if (
    error instanceof
      ListingQrError ||
    error instanceof
      RequestAuthError
  ) {
    return error.message;
  }

  return 'The listing QR request failed.';
}

export async function GET(
  request: Request
) {
  try {
    const profile =
      await requireAuthenticatedProfile(
        request
      );

    const requester =
      requesterFromProfile(
        profile
      );

    const requestUrl =
      new URL(
        request.url
      );

    const listingId =
      cleanUuid(
        requestUrl
          .searchParams
          .get(
            'listing_id'
          )
      );

    if (!listingId) {
      throw new ListingQrError(
        'Choose a valid listing.',
        400,
        'listing_id_required'
      );
    }

    const listing =
      await loadListing(
        listingId
      );

    if (
      !canManageListing(
        requester,
        listing
      )
    ) {
      throw new ListingQrError(
        'You do not have access to this listing QR code.',
        403,
        'listing_access_denied'
      );
    }

    const assignment =
      await loadAssignment(
        listing
      );

    return jsonResponse({
      ok: true,
      assignment,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      'Listing QR GET error:',
      error
    );

    return jsonResponse(
      {
        ok: false,

        code:
          errorCode(
            error
          ),

        error:
          errorMessage(
            error
          ),
      },
      errorStatus(
        error
      )
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

    const requester =
      requesterFromProfile(
        profile
      );

    const body =
      (
        await request
          .json()
          .catch(
            () => ({})
          )
      ) as
        Record<
          string,
          unknown
        >;

    const listingId =
      cleanUuid(
        body.listing_id
      );

    const action =
      String(
        body.action || ''
      )
        .trim()
        .toLowerCase();

    if (!listingId) {
      throw new ListingQrError(
        'Choose a valid listing.',
        400,
        'listing_id_required'
      );
    }

    if (
      action !==
      'assign'
    ) {
      throw new ListingQrError(
        'Choose the assign action.',
        400,
        'invalid_action'
      );
    }

    const listing =
      await loadListing(
        listingId
      );

    if (
      !canManageListing(
        requester,
        listing
      )
    ) {
      throw new ListingQrError(
        'You do not have access to assign this listing QR code.',
        403,
        'listing_access_denied'
      );
    }

    const existingAssignment =
      await loadAssignment(
        listing
      );

    if (existingAssignment) {
      return jsonResponse({
        ok: true,

        assignment:
          existingAssignment,

        message:
          'This listing already has an active reusable QR code.',
      });
    }

    if (
      listing.website_status !==
        'published' ||
      !validHttpsUrl(
        listing.public_url
      )
    ) {
      throw new ListingQrError(
        'Publish the property website before assigning its reusable QR code.',
        409,
        'property_website_not_published'
      );
    }

    const userClient =
      authenticatedClient(
        request
      );

    const {
      error:
        assignmentError,
    } = await userClient
      .rpc(
        'assign_reusable_qr_code',
        {
          p_listing_id:
            listing.id,

          p_qr_code_id:
            null,

          p_destination_mode:
            'property_website',

          p_manual_destination_url:
            null,
        }
      );

    if (assignmentError) {
      const raceAssignment =
        await loadAssignment(
          listing
        );

      if (raceAssignment) {
        return jsonResponse({
          ok: true,

          assignment:
            raceAssignment,

          message:
            'This listing already has an active reusable QR code.',
        });
      }

      throw new ListingQrError(
        assignmentError.message ||
          'The reusable QR code could not be assigned.',
        500,
        'qr_assignment_failed'
      );
    }

    const assignment =
      await loadAssignment(
        listing
      );

    if (!assignment) {
      throw new ListingQrError(
        'The reusable QR assignment was created but could not be reloaded.',
        500,
        'qr_assignment_reload_failed'
      );
    }

    return jsonResponse({
      ok: true,

      assignment,

      message:
        'The reusable QR code is now assigned to this property website.',
    });
  } catch (
    error: unknown
  ) {
    console.error(
      'Listing QR POST error:',
      error
    );

    return jsonResponse(
      {
        ok: false,

        code:
          errorCode(
            error
          ),

        error:
          errorMessage(
            error
          ),
      },
      errorStatus(
        error
      )
    );
  }
}
