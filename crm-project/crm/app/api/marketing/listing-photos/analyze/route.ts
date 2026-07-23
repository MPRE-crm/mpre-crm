import {
  NextResponse,
} from 'next/server';

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from '../../../../../lib/server/authenticatedProfile';

import {
  prepareListingPhotoIntelligence,
  LISTING_PHOTO_ANALYSIS_VERSION,
  type ListingPhotoInput,
} from '../../../../../lib/server/listingPhotoIntelligence';

import {
  supabaseAdmin,
} from '../../../../../lib/supabaseAdmin';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

export const maxDuration =
  60;

const ANALYSIS_BATCH_SIZE =
  6;

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

type ExistingAnalysisRow = {
  media_id: string;
  analysis_status: string;
  source_url: string | null;
  analysis_version: number | null;
  label_locked: boolean | null;
};

class ListingPhotoAnalysisError
  extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 500,
    code =
      'listing_photo_analysis_error'
  ) {
    super(message);

    this.name =
      'ListingPhotoAnalysisError';

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

function analysisSourceUrl(
  photo: ListingPhotoInput
) {
  return (
    photo.public_url ||
    photo.thumbnail_url ||
    null
  );
}

function needsAutomaticAnalysis(
  photo: ListingPhotoInput,
  existing:
    ExistingAnalysisRow |
    undefined
) {
  if (!existing) {
    return true;
  }

  if (
    Boolean(
      existing.label_locked
    )
  ) {
    return false;
  }

  if (
    existing.analysis_version !==
    LISTING_PHOTO_ANALYSIS_VERSION
  ) {
    return true;
  }

  if (
    existing.source_url !==
    analysisSourceUrl(
      photo
    )
  ) {
    return true;
  }

  /*
   * A current failed result has already gone through
   * the helper's small-batch and individual retries.
   * It is left for user review instead of creating an
   * endless automatic retry loop.
   */
  return false;
}

function responseStatus(
  error: unknown
) {
  if (
    error instanceof
    ListingPhotoAnalysisError
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
    ListingPhotoAnalysisError
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

    if (!listingId) {
      throw new ListingPhotoAnalysisError(
        'A listing ID is required.',
        400,
        'listing_id_required'
      );
    }

    const {
      data:
        listingData,
      error:
        listingError,
    } = await supabaseAdmin
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
      .maybeSingle();

    if (
      listingError ||
      !listingData
    ) {
      throw new ListingPhotoAnalysisError(
        listingError?.message ||
          'Listing not found.',
        404,
        'listing_not_found'
      );
    }

    const listing =
      listingData as
        ListingRow;

    if (
      !canManageListing(
        requester,
        listing
      )
    ) {
      throw new ListingPhotoAnalysisError(
        'You do not have access to analyze photographs for this listing.',
        403,
        'listing_access_denied'
      );
    }

    if (
      !listing.owner_user_id
    ) {
      throw new ListingPhotoAnalysisError(
        'Assign a listing owner before Samantha analyzes the photographs.',
        400,
        'listing_owner_required'
      );
    }

    const [
      photoResult,
      analysisResult,
    ] = await Promise.all([
      supabaseAdmin
        .from(
          'listing_media'
        )
        .select(`
          id,
          public_url,
          thumbnail_url,
          file_name,
          title,
          caption,
          sort_order,
          is_primary
        `)
        .eq(
          'listing_id',
          listing.id
        )
        .eq(
          'media_type',
          'photo'
        )
        .order(
          'is_primary',
          {
            ascending:
              false,
          }
        )
        .order(
          'sort_order',
          {
            ascending:
              true,
          }
        )
        .order(
          'created_at',
          {
            ascending:
              true,
          }
        ),

      supabaseAdmin
        .from(
          'listing_media_ai_analysis'
        )
        .select(`
          media_id,
          analysis_status,
          source_url,
          analysis_version,
          label_locked
        `)
        .eq(
          'listing_id',
          listing.id
        ),
    ]);

    if (photoResult.error) {
      throw new ListingPhotoAnalysisError(
        photoResult
          .error
          .message,
        500,
        'photo_load_failed'
      );
    }

    if (analysisResult.error) {
      throw new ListingPhotoAnalysisError(
        analysisResult
          .error
          .message,
        500,
        'analysis_load_failed'
      );
    }

    const photos =
      (
        photoResult.data ||
        []
      ) as ListingPhotoInput[];

    const existingById =
      new Map<
        string,
        ExistingAnalysisRow
      >(
        (
          analysisResult.data ||
          []
        ).map(
          (
            row:
              ExistingAnalysisRow
          ) => [
            row.media_id,
            row,
          ]
        )
      );

    const unresolvedPhotos =
      photos.filter(
        (photo) =>
          needsAutomaticAnalysis(
            photo,
            existingById.get(
              photo.id
            )
          )
      );

    const currentBatch =
      unresolvedPhotos.slice(
        0,
        ANALYSIS_BATCH_SIZE
      );

    if (
      currentBatch.length >
      0
    ) {
      const openAiApiKey =
        process.env
          .OPENAI_API_KEY;

      if (!openAiApiKey) {
        throw new ListingPhotoAnalysisError(
          'OPENAI_API_KEY is not configured.',
          500,
          'openai_key_missing'
        );
      }

      const model =
        process.env
          .OPENAI_LISTING_PHOTO_MODEL ||
        process.env
          .OPENAI_LISTING_MARKETING_MODEL ||
        process.env
          .OPENAI_LISTING_WEBSITE_MODEL ||
        'gpt-4.1-mini';

      await prepareListingPhotoIntelligence({
        listingId:
          listing.id,

        orgId:
          listing.org_id,

        ownerUserId:
          listing.owner_user_id,

        requesterId:
          requester.id,

        apiKey:
          openAiApiKey,

        model,

        photos:
          currentBatch,
      });
    }

    const {
      data:
        savedAnalyses,
      error:
        savedAnalysisError,
    } = await supabaseAdmin
      .from(
        'listing_media_ai_analysis'
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
      .eq(
        'listing_id',
        listing.id);

    if (
      savedAnalysisError
    ) {
      throw new ListingPhotoAnalysisError(
        savedAnalysisError
          .message,
        500,
        'saved_analysis_load_failed'
      );
    }

    const savedById =
      new Map<
        string,
        ExistingAnalysisRow
      >(
        (
          savedAnalyses ||
          []
        ).map(
          (row: any) => [
            String(
              row.media_id
            ),
            row as
              ExistingAnalysisRow,
          ]
        )
      );

    const remainingCount =
      photos.filter(
        (photo) =>
          needsAutomaticAnalysis(
            photo,
            savedById.get(
              photo.id
            )
          )
      ).length;

    const failedCount =
      (
        savedAnalyses ||
        []
      ).filter(
        (row: any) =>
          row.analysis_status ===
          'failed'
      ).length;

    const lockedCount =
      (
        savedAnalyses ||
        []
      ).filter(
        (row: any) =>
          Boolean(
            row.label_locked
          )
      ).length;

    return NextResponse.json(
      {
        ok:
          true,

        listing_id:
          listing.id,

        total_photo_count:
          photos.length,

        processed_count:
          currentBatch.length,

        remaining_count:
          remainingCount,

        failed_count:
          failedCount,

        locked_count:
          lockedCount,

        complete:
          remainingCount ===
          0,

        analyses:
          savedAnalyses ||
          [],
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
      'Listing photograph analysis error:',
      error
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'Samantha could not analyze the listing photographs.',

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