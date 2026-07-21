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

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

type Role =
  | "agent"
  | "admin"
  | "org_admin"
  | "platform_admin";

type RequesterRow = {
  id: string;
  org_id: string | null;
  role: Role;
};

type ListingRow = {
  id: string;
  org_id: string;

  owner_user_id:
    | string
    | null;

  title:
    | string
    | null;

  property_address:
    | string
    | null;

  city:
    | string
    | null;

  state:
    | string
    | null;

  zip:
    | string
    | null;

  mls_number:
    | string
    | null;

  list_price:
    | number
    | null;

  listing_status:
    | string
    | null;

  review_status:
    | string
    | null;

  public_remarks:
    | string
    | null;

  description:
    | string
    | null;

  primary_image_url:
    | string
    | null;

  website_slug:
    | string
    | null;

  website_template_key:
    | string
    | null;

  website_status:
    | string
    | null;

  public_url:
    | string
    | null;
};

type OwnerRow = {
  id: string;

  name:
    | string
    | null;

  email:
    | string
    | null;

  org_id:
    | string
    | null;

  marketing_phone:
    | string
    | null;

  marketing_title:
    | string
    | null;

  marketing_headshot_url:
    | string
    | null;

  marketing_brokerage:
    | string
    | null;

  marketing_license_number:
    | string
    | null;

  marketing_physical_address:
    | string
    | null;

  marketing_office_address:
    | string
    | null;
};

type OrganizationRow = {
  id: string;

  name:
    | string
    | null;

  org_display:
    | string
    | null;

  brokerage_name:
    | string
    | null;

  marketing_licensed_business_name:
    | string
    | null;

  marketing_broker_license_number:
    | string
    | null;

  marketing_license_state:
    | string
    | null;

  marketing_physical_address:
    | string
    | null;

  marketing_privacy_policy_url:
    | string
    | null;

  marketing_standard_disclaimer:
    | string
    | null;

  marketing_advertisement_label:
    | string
    | null;
};

type JurisdictionRow = {
  id: string;
  code: string;

  marketing_enabled:
    | boolean
    | null;
};

type MarketRow = {
  id: string;

  market_status:
    | string
    | null;

  marketing_enabled:
    | boolean
    | null;
};

type OrganizationLicenseRow = {
  id: string;

  licensed_business_name:
    | string
    | null;

  brokerage_license_number:
    | string
    | null;

  license_status:
    | string
    | null;

  responsible_broker_name:
    | string
    | null;

  responsible_broker_license_number:
    | string
    | null;

  office_phone:
    | string
    | null;

  office_address:
    | string
    | null;

  compliance_mailing_address:
    | string
    | null;

  expiration_date:
    | string
    | null;

  regulator_source_url:
    | string
    | null;

  verified_by:
    | string
    | null;

  verified_at:
    | string
    | null;
};

type ProfileLicenseRow = {
  id: string;

  license_number:
    | string
    | null;

  license_status:
    | string
    | null;

  supervising_broker_name:
    | string
    | null;

  supervising_broker_license_number:
    | string
    | null;

  expiration_date:
    | string
    | null;

  regulator_source_url:
    | string
    | null;

  verification_source:
    | string
    | null;

  verified_by:
    | string
    | null;

  verified_at:
    | string
    | null;

  is_primary:
    | boolean
    | null;
};

class WebsitePublishError
  extends Error {
  status: number;
  code: string;

  blockers: string[];

  constructor(
    message: string,
    status = 500,
    code =
      "website_publish_error",
    blockers: string[] = []
  ) {
    super(message);

    this.name =
      "WebsitePublishError";

    this.status =
      status;

    this.code =
      code;

    this.blockers =
      blockers;
  }
}

function jsonResponse(
  body: Record<
    string,
    unknown
  >,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

function normalized(
  value: unknown
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function hasText(
  value: unknown
) {
  return Boolean(
    String(
      value || ""
    ).trim()
  );
}

function normalizeTemplateKey(
  value: unknown
) {
  const templateKey =
    normalized(value);

  return [
    "luxury",
    "standard",
    "modern",
    "realtor_blast",
  ].includes(templateKey)
    ? templateKey
    : "standard";
}

function validSlug(
  value: unknown
) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
    String(
      value || ""
    ).trim()
  );
}

function siteOrigin() {
  return (
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim()
      .replace(/\/+$/, "") ||
    "https://easyrealtor.homes"
  );
}

function canManageListing(
  requester: RequesterRow,
  listing: ListingRow
) {
  if (
    requester.role ===
    "platform_admin"
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
      "admin" ||
    requester.role ===
      "org_admin"
  ) {
    return true;
  }

  return (
    requester.role ===
      "agent" &&
    requester.id ===
      listing.owner_user_id
  );
}

function expired(
  value:
    | string
    | null
) {
  if (!value) {
    return true;
  }

  const expiration =
    new Date(
      `${value}T23:59:59`
    );

  return (
    Number.isNaN(
      expiration.getTime()
    ) ||
    expiration.getTime() <
      Date.now()
  );
}

function verifiedLicense(
  record:
    | OrganizationLicenseRow
    | ProfileLicenseRow
    | null
) {
  return Boolean(
    record &&
    [
      "active",
      "approved",
      "verified",
    ].includes(
      normalized(
        record.license_status
      )
    ) &&
    record.verified_at &&
    record.verified_by &&
    !expired(
      record.expiration_date
    )
  );
}

function responseStatus(
  error: unknown
) {
  if (
    error instanceof
    WebsitePublishError
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
    WebsitePublishError
  ) {
    return error.code;
  }

  if (
    error instanceof
    RequestAuthError
  ) {
    return "authorization_error";
  }

  return "unexpected_error";
}

export async function POST(
  request: Request
) {
  try {
    const authenticatedProfile =
      await requireAuthenticatedProfile(
        request
      );

    const requester: RequesterRow = {
      id:
        authenticatedProfile.id,

      org_id:
        authenticatedProfile.org_id ||
        null,

      role:
        authenticatedProfile.role as Role,
    };

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const listingId =
      String(
        body?.listing_id ||
        ""
      ).trim();

    const action =
      normalized(
        body?.action ||
        "publish"
      );

    if (!listingId) {
      throw new WebsitePublishError(
        "Choose a listing first.",
        400,
        "listing_required"
      );
    }

    if (
      ![
        "publish",
        "unpublish",
      ].includes(action)
    ) {
      throw new WebsitePublishError(
        "The requested website action is not supported.",
        400,
        "invalid_action"
      );
    }

    const {
      data: listingData,
      error: listingError,
    } = await supabaseAdmin
      .from("listings")
      .select(`
        id,
        org_id,
        owner_user_id,
        title,
        property_address,
        city,
        state,
        zip,
        mls_number,
        list_price,
        listing_status,
        review_status,
        public_remarks,
        description,
        primary_image_url,
        website_slug,
        website_template_key,
        website_status,
        public_url
      `)
      .eq(
        "id",
        listingId
      )
      .single();

    if (
      listingError ||
      !listingData
    ) {
      throw new WebsitePublishError(
        listingError?.message ||
          "Listing not found.",
        404,
        "listing_not_found"
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
      throw new WebsitePublishError(
        "You do not have access to publish this listing website.",
        403,
        "listing_access_denied"
      );
    }

    if (
      action ===
      "unpublish"
    ) {
      const {
        data: unpublishedListing,
        error: unpublishError,
      } = await supabaseAdmin
        .from("listings")
        .update({
          website_status:
            "unpublished",

          website_published_at:
            null,

          public_url:
            null,
        })
        .eq(
          "id",
          listing.id
        )
        .select(`
          id,
          website_slug,
          website_template_key,
          website_status,
          website_published_at,
          public_url
        `)
        .single();

      if (
        unpublishError ||
        !unpublishedListing
      ) {
        throw new WebsitePublishError(
          unpublishError?.message ||
            "The website could not be unpublished.",
          500,
          "website_unpublish_failed"
        );
      }

      return jsonResponse({
        ok: true,

        action:
          "unpublish",

        listing:
          unpublishedListing,

        message:
          "The property website is no longer public.",
      });
    }

    const templateKey =
      normalizeTemplateKey(
        body?.template_key ||
        listing.website_template_key
      );

    const slug =
      String(
        listing.website_slug ||
        ""
      )
        .trim()
        .toLowerCase();

    const blockers:
      string[] = [];

    if (
      !listing.owner_user_id
    ) {
      blockers.push(
        "Assign a listing owner."
      );
    }

    if (
      normalized(
        listing.review_status
      ) !== "confirmed"
    ) {
      blockers.push(
        "Review and confirm the listing information."
      );
    }

    if (
      ![
        "active",
        "coming_soon",
      ].includes(
        normalized(
          listing.listing_status
        )
      )
    ) {
      blockers.push(
        "The listing must be Active or Coming Soon."
      );
    }

    if (
      !hasText(
        listing.title
      )
    ) {
      blockers.push(
        "Add the listing title."
      );
    }

    if (
      !hasText(
        listing.property_address
      ) ||
      !hasText(
        listing.city
      ) ||
      !hasText(
        listing.state
      ) ||
      !hasText(
        listing.zip
      )
    ) {
      blockers.push(
        "Complete the public property address."
      );
    }

    if (
      !hasText(
        listing.mls_number
      )
    ) {
      blockers.push(
        "Add the MLS number."
      );
    }

    if (
      typeof listing.list_price !==
        "number" ||
      !Number.isFinite(
        listing.list_price
      ) ||
      listing.list_price <=
        0
    ) {
      blockers.push(
        "Add a valid listing price."
      );
    }

    if (
      !hasText(
        listing.public_remarks ||
        listing.description
      )
    ) {
      blockers.push(
        "Add public property remarks."
      );
    }

    if (
      !validSlug(slug)
    ) {
      blockers.push(
        "Create a valid website slug."
      );
    }

    const [
      ownerResult,
      organizationResult,
      photoCountResult,
      primaryPhotoResult,
      jurisdictionResult,
    ] = await Promise.all([
      listing.owner_user_id
        ? supabaseAdmin
            .from("profiles")
            .select(`
              id,
              name,
              email,
              org_id,
              marketing_phone,
              marketing_title,
              marketing_headshot_url,
              marketing_brokerage,
              marketing_license_number,
              marketing_physical_address,
              marketing_office_address
            `)
            .eq(
              "id",
              listing.owner_user_id
            )
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),

      supabaseAdmin
        .from("organizations")
        .select(`
          id,
          name,
          org_display,
          brokerage_name,
          marketing_licensed_business_name,
          marketing_broker_license_number,
          marketing_license_state,
          marketing_physical_address,
          marketing_privacy_policy_url,
          marketing_standard_disclaimer,
          marketing_advertisement_label
        `)
        .eq(
          "id",
          listing.org_id
        )
        .maybeSingle(),

      supabaseAdmin
        .from(
          "listing_media"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          }
        )
        .eq(
          "listing_id",
          listing.id
        )
        .eq(
          "media_type",
          "photo"
        )
        .eq(
          "use_in_marketing",
          true
        ),

      supabaseAdmin
        .from(
          "listing_media"
        )
        .select(
          "id"
        )
        .eq(
          "listing_id",
          listing.id
        )
        .eq(
          "media_type",
          "photo"
        )
        .eq(
          "use_in_marketing",
          true
        )
        .eq(
          "is_primary",
          true
        )
        .limit(1)
        .maybeSingle(),

      supabaseAdmin
        .from(
          "marketing_jurisdictions"
        )
        .select(`
          id,
          code,
          marketing_enabled
        `)
        .eq(
          "code",
          "US-ID"
        )
        .maybeSingle(),
    ]);

    if (
      ownerResult.error
    ) {
      throw new WebsitePublishError(
        ownerResult.error.message,
        500,
        "owner_load_failed"
      );
    }

    if (
      organizationResult.error
    ) {
      throw new WebsitePublishError(
        organizationResult.error.message,
        500,
        "organization_load_failed"
      );
    }

    if (
      photoCountResult.error
    ) {
      throw new WebsitePublishError(
        photoCountResult.error.message,
        500,
        "photo_check_failed"
      );
    }

    if (
      primaryPhotoResult.error
    ) {
      throw new WebsitePublishError(
        primaryPhotoResult.error.message,
        500,
        "primary_photo_check_failed"
      );
    }

    if (
      jurisdictionResult.error
    ) {
      throw new WebsitePublishError(
        jurisdictionResult.error.message,
        500,
        "jurisdiction_load_failed"
      );
    }

    const owner =
      (ownerResult.data as
        | OwnerRow
        | null) ||
      null;

    const organization =
      (organizationResult.data as
        | OrganizationRow
        | null) ||
      null;

    const jurisdiction =
      (jurisdictionResult.data as
        | JurisdictionRow
        | null) ||
      null;

    if (!owner) {
      blockers.push(
        "The listing owner profile could not be found."
      );
    }
    else {
      if (
        owner.org_id !==
        listing.org_id
      ) {
        blockers.push(
          "The listing owner belongs to a different organization."
        );
      }

      if (
        !hasText(
          owner.name
        )
      ) {
        blockers.push(
          "Add the agent's public name."
        );
      }

      if (
        !hasText(
          owner.email
        )
      ) {
        blockers.push(
          "Add the agent's public email address."
        );
      }

      if (
        !hasText(
          owner.marketing_phone
        )
      ) {
        blockers.push(
          "Add the agent's marketing phone number."
        );
      }

      if (
        !hasText(
          owner.marketing_license_number
        )
      ) {
        blockers.push(
          "Add the agent license number."
        );
      }

      if (
        !hasText(
          owner.marketing_brokerage
        )
      ) {
        blockers.push(
          "Add the agent's brokerage identity."
        );
      }

      if (
        !hasText(
          owner.marketing_physical_address ||
          owner.marketing_office_address
        )
      ) {
        blockers.push(
          "Add the agent or office physical address."
        );
      }
    }

    if (!organization) {
      blockers.push(
        "The listing organization could not be found."
      );
    }
    else {
      if (
        !hasText(
          organization
            .marketing_licensed_business_name
        )
      ) {
        blockers.push(
          "Add the licensed business name in Compliance."
        );
      }

      if (
        !hasText(
          organization
            .marketing_broker_license_number
        )
      ) {
        blockers.push(
          "Add the brokerage license number in Compliance."
        );
      }

      if (
        ![
          "id",
          "idaho",
        ].includes(
          normalized(
            organization
              .marketing_license_state
          )
        )
      ) {
        blockers.push(
          "Confirm the organization's Idaho license state."
        );
      }

      if (
        !hasText(
          organization
            .marketing_privacy_policy_url
        )
      ) {
        blockers.push(
          "Add the organization privacy-policy URL."
        );
      }

      if (
        !hasText(
          organization
            .marketing_standard_disclaimer
        )
      ) {
        blockers.push(
          "Add the standard property disclaimer."
        );
      }

      if (
        !hasText(
          organization
            .marketing_advertisement_label
        )
      ) {
        blockers.push(
          "Add the required advertisement label."
        );
      }
    }

    if (
      !photoCountResult.count ||
      photoCountResult.count <
        1
    ) {
      blockers.push(
        "Select at least one photograph for marketing."
      );
    }

    if (
      !primaryPhotoResult.data &&
      !listing.primary_image_url
    ) {
      blockers.push(
        "Select a primary property photograph."
      );
    }

    if (!jurisdiction) {
      blockers.push(
        "The Idaho compliance jurisdiction is missing."
      );
    }
    else if (
      jurisdiction.marketing_enabled !==
      true
    ) {
      blockers.push(
        "Idaho marketing is not enabled in Compliance."
      );
    }

    let market:
      | MarketRow
      | null =
      null;

    let organizationLicense:
      | OrganizationLicenseRow
      | null =
      null;

    let profileLicense:
      | ProfileLicenseRow
      | null =
      null;

    if (
      jurisdiction &&
      listing.owner_user_id
    ) {
      const [
        marketResult,
        organizationLicenseResult,
        profileLicenseResult,
      ] = await Promise.all([
        supabaseAdmin
          .from(
            "organization_markets"
          )
          .select(`
            id,
            market_status,
            marketing_enabled
          `)
          .eq(
            "organization_id",
            listing.org_id
          )
          .eq(
            "jurisdiction_id",
            jurisdiction.id
          )
          .maybeSingle(),

        supabaseAdmin
          .from(
            "organization_real_estate_licenses"
          )
          .select(`
            id,
            licensed_business_name,
            brokerage_license_number,
            license_status,
            responsible_broker_name,
            responsible_broker_license_number,
            office_phone,
            office_address,
            compliance_mailing_address,
            expiration_date,
            regulator_source_url,
            verified_by,
            verified_at
          `)
          .eq(
            "organization_id",
            listing.org_id
          )
          .eq(
            "jurisdiction_id",
            jurisdiction.id
          )
          .maybeSingle(),

        supabaseAdmin
          .from(
            "profile_real_estate_licenses"
          )
          .select(`
            id,
            license_number,
            license_status,
            supervising_broker_name,
            supervising_broker_license_number,
            expiration_date,
            regulator_source_url,
            verification_source,
            verified_by,
            verified_at,
            is_primary
          `)
          .eq(
            "profile_id",
            listing.owner_user_id
          )
          .eq(
            "organization_id",
            listing.org_id
          )
          .eq(
            "jurisdiction_id",
            jurisdiction.id
          )
          .order(
            "is_primary",
            {
              ascending:
                false,
            }
          )
          .limit(1)
          .maybeSingle(),
      ]);

      if (
        marketResult.error
      ) {
        throw new WebsitePublishError(
          marketResult.error.message,
          500,
          "market_load_failed"
        );
      }

      if (
        organizationLicenseResult.error
      ) {
        throw new WebsitePublishError(
          organizationLicenseResult.error.message,
          500,
          "organization_license_load_failed"
        );
      }

      if (
        profileLicenseResult.error
      ) {
        throw new WebsitePublishError(
          profileLicenseResult.error.message,
          500,
          "profile_license_load_failed"
        );
      }

      market =
        (marketResult.data as
          | MarketRow
          | null) ||
        null;

      organizationLicense =
        (organizationLicenseResult.data as
          | OrganizationLicenseRow
          | null) ||
        null;

      profileLicense =
        (profileLicenseResult.data as
          | ProfileLicenseRow
          | null) ||
        null;
    }

    if (!market) {
      blockers.push(
        "Add the organization's Idaho market in Compliance."
      );
    }
    else {
      if (
        market.marketing_enabled !==
        true
      ) {
        blockers.push(
          "Enable Idaho marketing for this organization."
        );
      }

      if (
        ![
          "active",
          "approved",
          "launched",
          "enabled",
        ].includes(
          normalized(
            market.market_status
          )
        )
      ) {
        blockers.push(
          "Activate the organization's Idaho market."
        );
      }
    }

    if (
      !organizationLicense
    ) {
      blockers.push(
        "Add the organization brokerage license in Compliance."
      );
    }
    else {
      if (
        !verifiedLicense(
          organizationLicense
        )
      ) {
        blockers.push(
          "Verify the active organization brokerage license."
        );
      }

      if (
        !hasText(
          organizationLicense
            .licensed_business_name
        ) ||
        !hasText(
          organizationLicense
            .brokerage_license_number
        ) ||
        !hasText(
          organizationLicense
            .responsible_broker_name
        ) ||
        !hasText(
          organizationLicense
            .responsible_broker_license_number
        ) ||
        !hasText(
          organizationLicense
            .office_phone
        ) ||
        !hasText(
          organizationLicense
            .office_address
        ) ||
        !hasText(
          organizationLicense
            .compliance_mailing_address
        ) ||
        !hasText(
          organizationLicense
            .regulator_source_url
        )
      ) {
        blockers.push(
          "Complete all required organization-license fields in Compliance."
        );
      }
    }

    if (!profileLicense) {
      blockers.push(
        "Add the listing agent's Idaho license in Compliance."
      );
    }
    else {
      if (
        !verifiedLicense(
          profileLicense
        )
      ) {
        blockers.push(
          "Verify the listing agent's active Idaho license."
        );
      }

      if (
        !hasText(
          profileLicense
            .license_number
        ) ||
        !hasText(
          profileLicense
            .supervising_broker_name
        ) ||
        !hasText(
          profileLicense
            .supervising_broker_license_number
        ) ||
        !hasText(
          profileLicense
            .regulator_source_url
        )
      ) {
        blockers.push(
          "Complete all required agent-license fields in Compliance."
        );
      }
    }

    const uniqueBlockers =
      Array.from(
        new Set(
          blockers
        )
      );

    const checks = {
      listing_confirmed:
        normalized(
          listing.review_status
        ) === "confirmed",

      listing_marketable:
        [
          "active",
          "coming_soon",
        ].includes(
          normalized(
            listing.listing_status
          )
        ),

      public_facts_complete:
        Boolean(
          hasText(
            listing.title
          ) &&
          hasText(
            listing.property_address
          ) &&
          hasText(
            listing.city
          ) &&
          hasText(
            listing.state
          ) &&
          hasText(
            listing.zip
          ) &&
          hasText(
            listing.mls_number
          ) &&
          typeof listing.list_price ===
            "number" &&
          listing.list_price >
            0 &&
          hasText(
            listing.public_remarks ||
            listing.description
          )
        ),

      marketing_photos_ready:
        Boolean(
          photoCountResult.count &&
          photoCountResult.count >
            0 &&
          (
            primaryPhotoResult.data ||
            listing.primary_image_url
          )
        ),

      owner_identity_ready:
        Boolean(
          owner &&
          hasText(
            owner.name
          ) &&
          hasText(
            owner.email
          ) &&
          hasText(
            owner.marketing_phone
          ) &&
          hasText(
            owner.marketing_license_number
          ) &&
          hasText(
            owner.marketing_brokerage
          )
        ),

      organization_disclosures_ready:
        Boolean(
          organization &&
          hasText(
            organization
              .marketing_licensed_business_name
          ) &&
          hasText(
            organization
              .marketing_broker_license_number
          ) &&
          hasText(
            organization
              .marketing_privacy_policy_url
          ) &&
          hasText(
            organization
              .marketing_standard_disclaimer
          ) &&
          hasText(
            organization
              .marketing_advertisement_label
          )
        ),

      idaho_marketing_enabled:
        Boolean(
          jurisdiction
            ?.marketing_enabled ===
            true &&
          market
            ?.marketing_enabled ===
            true
        ),

      organization_license_verified:
        verifiedLicense(
          organizationLicense
        ),

      agent_license_verified:
        verifiedLicense(
          profileLicense
        ),

      website_slug_ready:
        validSlug(slug),
    };

    if (
      uniqueBlockers.length >
      0
    ) {
      throw new WebsitePublishError(
        "The property website cannot be published until the compliance items are complete.",
        400,
        "website_compliance_blocked",
        uniqueBlockers
      );
    }

    const publicUrl =
      `${siteOrigin()}/property/${encodeURIComponent(
        slug
      )}`;

    const publishedAt =
      new Date()
        .toISOString();

    const {
      data: publishedListing,
      error: publishError,
    } = await supabaseAdmin
      .from("listings")
      .update({
        website_template_key:
          templateKey,

        website_status:
          "published",

        website_published_at:
          publishedAt,

        public_url:
          publicUrl,
      })
      .eq(
        "id",
        listing.id
      )
      .select(`
        id,
        website_slug,
        website_template_key,
        website_status,
        website_published_at,
        public_url
      `)
      .single();

    if (
      publishError ||
      !publishedListing
    ) {
      throw new WebsitePublishError(
        publishError?.message ||
          "The property website could not be published.",
        500,
        "website_publish_failed"
      );
    }

    return jsonResponse({
      ok: true,

      action:
        "publish",

      listing:
        publishedListing,

      checks,

      blockers: [],

      message:
        "The compliant property website is now published.",
    });
  }
  catch (
    error: unknown
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "The website publishing request failed.";

    console.error(
      "Listing website publish error:",
      error
    );

    return jsonResponse(
      {
        ok: false,

        code:
          responseCode(
            error
          ),

        error:
          message,

        blockers:
          error instanceof
          WebsitePublishError
            ? error.blockers
            : [],
      },
      responseStatus(
        error
      )
    );
  }
}



