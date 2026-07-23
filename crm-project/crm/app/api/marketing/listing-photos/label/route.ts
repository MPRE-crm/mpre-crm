import {
  NextResponse,
} from 'next/server';

import {
  isListingPhotoCategory,
  listingPhotoCategoryLabel,
} from '../../../../../lib/listing-photo-categories';

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
  30;

type Requester = {
  id: string;
  org_id: string | null;
  role: string;
};

type ListingRow = {
  id: string;
  org_id: string;
  owner_user_id: string | null;
};

type MediaRow = {
  id: string;
  listing_id: string;
  media_type: string;
};

class ListingPhotoLabelError
  extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 500,
    code =
      'listing_photo_label_error'
  ) {
    super(message);

    this.name =
      'ListingPhotoLabelError';

    this.status =
      status;

    this.code =
      code;
  }
}

function cleanText(
  value: unknown,
  maximumLength = 200
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .slice(
          0,
          maximumLength
        )
    : '';
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
    requester.role ===
      'admin' ||
    requester.role ===
      'org_admin'
  ) {
    return (
      Boolean(
        requester.org_id
      ) &&
      requester.org_id ===
        listing.org_id
    );
  }

  return (
    listing.owner_user_id ===
    requester.id
  );
}

function responseStatus(
  error: unknown
) {
  if (
    error instanceof
    ListingPhotoLabelError
  ) {
    return error.status;
  }

  return requestErrorStatus(
    error
  );
}

function responseCode(
  error: unknown
) {
  if (
    error instanceof
    ListingPhotoLabelError
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

export async function POST(
  request: Request
) {
  try {
    const authenticatedProfile =
      await requireAuthenticatedProfile(
        request
      );

    const requester:
      Requester = {
      id:
        authenticatedProfile.id,

      org_id:
        authenticatedProfile.org_id ||
        null,

      role:
        authenticatedProfile.role,
    };

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const listingId =
      cleanText(
        body?.listing_id,
        100
      );

    const mediaId =
      cleanText(
        body?.media_id,
        100
      );

    const requestedCategory =
      body?.primary_category;

    if (!listingId) {
      throw new ListingPhotoLabelError(
        'A listing ID is required.',
        400,
        'listing_id_required'
      );
    }

    if (!mediaId) {
      throw new ListingPhotoLabelError(
        'A photograph ID is required.',
        400,
        'media_id_required'
      );
    }

    if (
      !isListingPhotoCategory(
        requestedCategory
      )
    ) {
      throw new ListingPhotoLabelError(
        'Choose a valid photograph category.',
        400,
        'invalid_photo_category'
      );
    }

    const [
      listingResult,
      mediaResult,
    ] = await Promise.all([
      supabaseAdmin
        .from(
          'listings'
        )
        .select(`
          id,
          org_id,
          owner_user_id
        `)
        .eq(
          'id',
          listingId
        )
        .maybeSingle(),

      supabaseAdmin
        .from(
          'listing_media'
        )
        .select(`
          id,
          listing_id,
          media_type
        `)
        .eq(
          'id',
          mediaId
        )
        .eq(
          'listing_id',
          listingId
        )
        .eq(
          'media_type',
          'photo'
        )
        .maybeSingle(),
    ]);

    if (
      listingResult.error ||
      !listingResult.data
    ) {
      throw new ListingPhotoLabelError(
        listingResult
          .error
          ?.message ||
          'Listing not found.',
        404,
        'listing_not_found'
      );
    }

    const listing =
      listingResult.data as
        ListingRow;

    if (
      !canManageListing(
        requester,
        listing
      )
    ) {
      throw new ListingPhotoLabelError(
        'You do not have access to correct photographs for this listing.',
        403,
        'listing_access_denied'
      );
    }

    if (
      mediaResult.error ||
      !mediaResult.data
    ) {
      throw new ListingPhotoLabelError(
        mediaResult
          .error
          ?.message ||
          'Listing photograph not found.',
        404,
        'listing_photo_not_found'
      );
    }

    const media =
      mediaResult.data as
        MediaRow;

    const lockedAt =
      new Date()
        .toISOString();

    const {
      data:
        updatedAnalysis,
      error:
        updateError,
    } = await supabaseAdmin
      .from(
        'listing_media_ai_analysis'
      )
      .update({
        primary_category:
          requestedCategory,

        room_label:
          listingPhotoCategoryLabel(
            requestedCategory
          ),

        analysis_status:
          'complete',

        label_source:
          'user',

        label_locked:
          true,

        label_locked_by:
          requester.id,

        label_locked_at:
          lockedAt,

        updated_by:
          requester.id,
      })
      .eq(
        'listing_id',
        listing.id
      )
      .eq(
        'media_id',
        media.id
      )
      .select(`
        media_id,
        analysis_status,
        primary_category,
        room_label,
        feature_tags,
        quality_score,
        marketing_score,
        confidence,
        is_usable,
        rejection_reason,
        duplicate_group,
        visual_summary,
        source_url,
        analysis_model,
        analysis_version,
        label_source,
        label_locked,
        label_locked_by,
        label_locked_at,
        analyzed_at
      `)
      .maybeSingle();

    if (updateError) {
      throw new ListingPhotoLabelError(
        updateError.message,
        500,
        'photo_label_update_failed'
      );
    }

    if (!updatedAnalysis) {
      throw new ListingPhotoLabelError(
        'Samantha must analyze this photograph before its label can be corrected.',
        409,
        'photo_analysis_required'
      );
    }

    return NextResponse.json(
      {
        ok:
          true,

        listing_id:
          listing.id,

        media_id:
          media.id,

        analysis:
          updatedAnalysis,
      },
      {
        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    );
  }
  catch (
    error: unknown
  ) {
    console.error(
      'Listing photograph label error:',
      error
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'The photograph label could not be updated.',

        code:
          responseCode(
            error
          ),
      },
      {
        status:
          responseStatus(
            error
          ),

        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    );
  }
}