import {
  NextResponse,
} from "next/server";

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../../lib/server/authenticatedProfile";

import {
  supabaseAdmin,
} from "../../../../../lib/supabaseAdmin";

import {
  ReverseProspectingImportError,
  importReverseProspectingMatches,
  isAutomatedReverseProspectingSource,
  normalizeReverseProspectingSourceType,
} from "../../../../../lib/server/reverseProspectingImport";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  60;

type ListingRow = {
  id: string;
  org_id: string;

  owner_user_id:
    | string
    | null;

  title:
    | string
    | null;

  mls_number:
    | string
    | null;

  listing_status:
    | string
    | null;
};

function canManageListing(
  profile: {
    id: string;
    org_id: string | null;
    role: string;
  },
  listing: ListingRow
) {
  if (
    profile.role ===
    "platform_admin"
  ) {
    return true;
  }

  const sameOrganization =
    Boolean(
      profile.org_id
    ) &&
    profile.org_id ===
      listing.org_id;

  if (
    !sameOrganization
  ) {
    return false;
  }

  if (
    profile.role ===
      "admin" ||
    profile.role ===
      "org_admin"
  ) {
    return true;
  }

  return (
    profile.role ===
      "agent" &&
    listing.owner_user_id ===
      profile.id
  );
}

function optionalString(
  value: unknown,
  maximumLength: number
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

export async function POST(
  request: Request
) {
  try {
    const profile =
      await requireAuthenticatedProfile(
        request
      );

    const body =
      await request.json();

    const listingId =
      optionalString(
        body?.listing_id,
        100
      );

    if (!listingId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "listing_id is required.",
        },
        {
          status: 400,
        }
      );
    }

    const rows =
      Array.isArray(
        body?.rows
      )
        ? body.rows
        : null;

    if (!rows) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "rows must be an array of normalized Realtor-match records.",
        },
        {
          status: 400,
        }
      );
    }

    const sourceType =
      normalizeReverseProspectingSourceType(
        body?.source_type ||
          "manual_upload"
      );

    if (!sourceType) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "source_type is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: listing,
      error: listingError,
    } =
      await supabaseAdmin
        .from("listings")
        .select(`
          id,
          org_id,
          owner_user_id,
          title,
          mls_number,
          listing_status
        `)
        .eq(
          "id",
          listingId
        )
        .single();

    if (
      listingError ||
      !listing
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            listingError?.message ||
            "Listing not found.",
        },
        {
          status: 404,
        }
      );
    }

    const typedListing =
      listing as ListingRow;

    if (
      !canManageListing(
        profile,
        typedListing
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You do not have access to import Realtor matches for this listing.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      !typedListing
        .owner_user_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The listing must have an assigned owner before Realtor matches can be imported.",
        },
        {
          status: 400,
        }
      );
    }

    const complianceProfileId =
      optionalString(
        body
          ?.mls_compliance_profile_id,
        100
      );

    if (
      isAutomatedReverseProspectingSource(
        sourceType
      ) &&
      !complianceProfileId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "An MLS compliance profile is required for automated MLS or vendor-feed imports.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      complianceProfileId
    ) {
      const {
        data:
          complianceProfile,

        error:
          complianceError,
      } =
        await supabaseAdmin
          .from(
            "mls_compliance_profiles"
          )
          .select(
            "id, org_id"
          )
          .eq(
            "id",
            complianceProfileId
          )
          .single();

      if (
        complianceError ||
        !complianceProfile
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              complianceError
                ?.message ||
              "MLS compliance profile not found.",
          },
          {
            status: 404,
          }
        );
      }

      if (
        complianceProfile
          .org_id !==
        typedListing.org_id
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "The MLS compliance profile does not belong to the listing organization.",
          },
          {
            status: 403,
          }
        );
      }
    }

    const result =
      await importReverseProspectingMatches({
        listing: {
          id:
            typedListing.id,

          org_id:
            typedListing.org_id,

          owner_user_id:
            typedListing
              .owner_user_id,
        },

        requesterId:
          profile.id,

        sourceType,

        rows,

        sourceFileName:
          optionalString(
            body
              ?.source_file_name,
            500
          ),

        externalBatchId:
          optionalString(
            body
              ?.external_batch_id,
            300
          ),

        mlsComplianceProfileId:
          complianceProfileId,
      });

    return NextResponse.json(
      {
        ok: true,

        listing: {
          id:
            typedListing.id,

          title:
            typedListing.title,

          mls_number:
            typedListing
              .mls_number,
        },

        import:
          result,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    const status =
      error instanceof
        ReverseProspectingImportError
        ? error.status
        : requestErrorStatus(
            error
          );

    const message =
      error instanceof Error
        ? error.message
        : "Reverse-prospecting import failed.";

    if (
      !(
        error instanceof
        RequestAuthError
      )
    ) {
      console.error(
        "reverse-prospecting import error",
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