import {
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const dynamic =
  'force-dynamic';

const PROFILE_FIELDS = `
  id,
  name,
  email,
  role,
  org_id,
  marketing_from_name,
  marketing_from_email,
  marketing_reply_to_email,
  marketing_physical_address,
  marketing_email_enabled,
  marketing_phone,
  marketing_title,
  marketing_brokerage,
  marketing_website_url,
  marketing_license_number,
  marketing_headshot_url,
  marketing_signature_text,
  marketing_signature_image_url,
  marketing_logo_url,
  marketing_office_phone,
  marketing_office_address,
  marketing_appointment_url,
  marketing_designations,
  marketing_certifications,
  marketing_service_areas,
  marketing_languages,
  marketing_disclaimer,
  marketing_facebook_url,
  marketing_instagram_url,
  marketing_linkedin_url,
  marketing_youtube_url,
  marketing_tiktok_url,
  marketing_x_url
`;

function bearerToken(
  request: Request
) {
  const header =
    request.headers.get(
      'authorization'
    ) || '';

  if (
    !header
      .toLowerCase()
      .startsWith('bearer ')
  ) {
    return '';
  }

  return header
    .slice(7)
    .trim();
}

function cleanText(
  value: unknown,
  maxLength = 500
) {
  const result =
    String(value ?? '').trim();

  if (!result) {
    return null;
  }

  return result.slice(
    0,
    maxLength
  );
}

function cleanTextArray(
  value: unknown,
  maxItems = 40,
  maxLength = 160
) {
  const rawItems =
    Array.isArray(value)
      ? value
      : String(value ?? '')
          .split(/[,\n]/);

  return rawItems
    .map((item) =>
      String(item ?? '')
        .trim()
        .slice(0, maxLength)
    )
    .filter(Boolean)
    .slice(0, maxItems);
}
function serverSettings() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env
      .SUPABASE_ANON_KEY ||
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey
  ) {
    throw new Error(
      'Supabase server environment variables are incomplete.'
    );
  }

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  };
}

async function authenticatedUser(
  request: Request
) {
  const token =
    bearerToken(request);

  if (!token) {
    return {
      user: null,
      error:
        'Missing authentication token.',
      status: 401,
    };
  }

  const {
    supabaseUrl,
    anonKey,
  } = serverSettings();

  const authClient =
    createClient(
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

  const {
    data,
    error,
  } =
    await authClient.auth.getUser(
      token
    );

  if (
    error ||
    !data.user
  ) {
    return {
      user: null,
      error:
        error?.message ||
        'Not authenticated.',
      status: 401,
    };
  }

  return {
    user: data.user,
    error: null,
    status: 200,
  };
}

function adminClient() {
  const {
    supabaseUrl,
    serviceRoleKey,
  } = serverSettings();

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession:
          false,
        autoRefreshToken:
          false,
      },
    }
  );
}

type MarketingBrand = {
  name: string | null;
  logo_url: string | null;
};

type MarketingBranding = {
  personal: MarketingBrand;
  organization: MarketingBrand;
  brokerage: MarketingBrand;
};

type MarketingCompliance = {
  advertisement_label: string | null;
  standard_disclaimer: string | null;
  mls_attribution: string | null;
  broker_license_number: string | null;
  public_office_address: string | null;
};

type MarketingIdentityContext = {
  branding: MarketingBranding;
  compliance: MarketingCompliance;
};

function normalized(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function optionalText(value: unknown) {
  const result = String(value || '').trim();
  return result || null;
}

function licenseIsCurrent(license: {
  license_status?: unknown;
  verified_at?: unknown;
  verified_by?: unknown;
  expiration_date?: unknown;
}) {
  const status = normalized(
    license.license_status
  );
  const expiration = optionalText(
    license.expiration_date
  );
  let expirationTime: number | null = null;

  if (expiration) {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        expiration
      );

    if (!match) {
      return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const lastDay =
      month >= 1 && month <= 12
        ? new Date(
            Date.UTC(year, month, 0)
          ).getUTCDate()
        : 0;

    if (
      year < 1000 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > lastDay
    ) {
      return false;
    }

    expirationTime = Date.UTC(
      year,
      month - 1,
      day,
      23,
      59,
      59,
      999
    );

    if (
      !Number.isFinite(expirationTime) ||
      expirationTime < Date.now()
    ) {
      return false;
    }
  }

  return (
    ['active', 'approved', 'verified'].includes(status) &&
    Boolean(optionalText(license.verified_at)) &&
    Boolean(optionalText(license.verified_by)) &&
    (
      expiration === null ||
      expirationTime !== null
    )
  );
}

async function loadMarketingBranding(
  admin: ReturnType<typeof adminClient>,
  organizationId: string,
  preferredState: string,
  profile: Record<string, unknown>
): Promise<MarketingIdentityContext> {
  const personal = {
    name:
      optionalText(profile.marketing_from_name) ||
      optionalText(profile.name),
    logo_url: optionalText(
      profile.marketing_logo_url
    ),
  };
  const emptyBrand = {
    name: null,
    logo_url: null,
  };
  const emptyCompliance: MarketingCompliance = {
    advertisement_label: null,
    standard_disclaimer: null,
    mls_attribution: null,
    broker_license_number: null,
    public_office_address: null,
  };

  if (!organizationId) {
    return {
      branding: {
        personal,
        organization: emptyBrand,
        brokerage: emptyBrand,
      },
      compliance: emptyCompliance,
    };
  }

  const [
    platformResult,
    organizationResult,
    jurisdictionResult,
    marketResult,
    licenseResult,
  ] = await Promise.all([
    admin
      .from('platform_brand_settings')
      .select(`
        brand_name,
        master_logo_url,
        is_active
      `)
      .eq('brand_key', 'mpre')
      .maybeSingle(),

    admin
      .from('organizations')
      .select(`
        id,
        name,
        org_display,
        state,
        brokerage_name,
        marketing_licensed_business_name,
        marketing_license_state,
        marketing_broker_license_number,
        marketing_mls_attribution,
        marketing_standard_disclaimer,
        marketing_advertisement_label
      `)
      .eq('id', organizationId)
      .maybeSingle(),

    admin
      .from('marketing_jurisdictions')
      .select(`
        id,
        code,
        state_code,
        name
      `)
      .eq('country_code', 'US')
      .eq('jurisdiction_type', 'state'),

    admin
      .from('organization_markets')
      .select(`
        jurisdiction_id,
        market_status,
        marketing_enabled
      `)
      .eq('organization_id', organizationId),

    admin
      .from('organization_real_estate_licenses')
      .select(`
        id,
        jurisdiction_id,
        licensed_business_name,
        dba_name,
        brokerage_logo_url,
        office_address,
        compliance_mailing_address,
        license_status,
        expiration_date,
        verified_at,
        verified_by,
        created_at
      `)
      .eq('organization_id', organizationId)
      .order('created_at', {
        ascending: false,
      })
      .order('id', {
        ascending: false,
      }),
  ]);

  if (platformResult.error) {
    throw platformResult.error;
  }

  if (organizationResult.error) {
    throw organizationResult.error;
  }

  if (jurisdictionResult.error) {
    throw jurisdictionResult.error;
  }

  if (marketResult.error) {
    throw marketResult.error;
  }

  if (licenseResult.error) {
    throw licenseResult.error;
  }

  const platform =
    platformResult.data &&
    platformResult.data.is_active !== false
      ? platformResult.data
      : null;
  const organization = organizationResult.data;
  const jurisdictions =
    jurisdictionResult.data || [];
  const markets = marketResult.data || [];
  const licenses = licenseResult.data || [];
  const stateMatches = (
    candidate: (typeof jurisdictions)[number],
    value: unknown
  ) => {
    const requested = normalized(value);

    return Boolean(
      requested &&
        [
          candidate.state_code,
          candidate.name,
          candidate.code,
        ].some(
          (item) => normalized(item) === requested
        )
    );
  };
  const orderedJurisdictions = [
    ...jurisdictions,
  ].sort((left, right) =>
    [
      left.state_code,
      left.name,
      left.code,
      left.id,
    ]
      .map((value) => normalized(value))
      .join('|')
      .localeCompare(
        [
          right.state_code,
          right.name,
          right.code,
          right.id,
        ]
          .map((value) => normalized(value))
          .join('|')
      )
  );
  const activeMarketJurisdictionIds =
    new Set(
      markets
        .filter(
          (market) =>
            market.marketing_enabled === true &&
            [
              'active',
              'approved',
              'launched',
              'enabled',
            ].includes(
              normalized(market.market_status)
            )
        )
        .map((market) => market.jurisdiction_id)
    );
  const activeMarketJurisdiction =
    orderedJurisdictions.find((item) =>
      activeMarketJurisdictionIds.has(item.id)
    );
  const currentActiveMarketJurisdiction =
    orderedJurisdictions.find(
      (item) =>
        activeMarketJurisdictionIds.has(item.id) &&
        licenses.some(
          (license) =>
            license.jurisdiction_id === item.id &&
            licenseIsCurrent(license)
        )
    );
  const currentLicenseJurisdiction =
    orderedJurisdictions.find((item) =>
      licenses.some(
        (license) =>
          license.jurisdiction_id === item.id &&
          licenseIsCurrent(license)
      )
    );
  const licensedJurisdiction =
    orderedJurisdictions.find((item) =>
      licenses.some(
        (license) =>
          license.jurisdiction_id === item.id
      )
    );
  const preferredJurisdiction =
    jurisdictions.find((item) =>
      stateMatches(item, preferredState)
    ) ||
    null;
  const selectedJurisdiction =
    optionalText(preferredState)
      ? preferredJurisdiction
      : jurisdictions.find((item) =>
          stateMatches(
            item,
            organization?.marketing_license_state
          )
        ) ||
        jurisdictions.find((item) =>
          stateMatches(item, organization?.state)
        ) ||
        currentActiveMarketJurisdiction ||
        activeMarketJurisdiction ||
        currentLicenseJurisdiction ||
        licensedJurisdiction ||
        null;
  const jurisdictionLicenses =
    selectedJurisdiction
      ? licenses.filter(
          (license) =>
            license.jurisdiction_id ===
            selectedJurisdiction.id
        )
      : [];
  const selectedLicense =
    jurisdictionLicenses.find(
      licenseIsCurrent
    ) ||
    null;

  return {
    branding: {
      personal,
      organization: {
        name: optionalText(platform?.brand_name),
        logo_url: optionalText(
          platform?.master_logo_url
        ),
      },
      brokerage: {
        name:
          optionalText(organization?.brokerage_name) ||
          optionalText(selectedLicense?.dba_name) ||
          optionalText(
            selectedLicense?.licensed_business_name
          ) ||
          optionalText(
            organization
              ?.marketing_licensed_business_name
          ),
        logo_url: optionalText(
          selectedLicense?.brokerage_logo_url
        ),
      },
    },
    compliance: {
      advertisement_label:
        optionalText(
          organization
            ?.marketing_advertisement_label
        ),
      standard_disclaimer:
        optionalText(
          organization
            ?.marketing_standard_disclaimer
        ),
      mls_attribution:
        optionalText(
          organization
            ?.marketing_mls_attribution
        ),
      broker_license_number:
        optionalText(
          organization
            ?.marketing_broker_license_number
        ),
      public_office_address:
        optionalText(
          selectedLicense
            ?.compliance_mailing_address
        ) ||
        optionalText(
          selectedLicense?.office_address
        ),
    },
  };
}

function marketingIdentityResponse(
  context: MarketingIdentityContext
) {
  return {
    branding: context.branding,
    compliance: context.compliance,
  };
}

export async function GET(
  request: Request
) {
  try {
    const auth =
      await authenticatedUser(
        request
      );

    if (!auth.user) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    const admin =
      adminClient();

    const {
      data: requesterProfile,
      error: requesterError,
    } = await admin
      .from('profiles')
      .select(`
        id,
        role,
        org_id
      `)
      .eq(
        'id',
        auth.user.id
      )
      .single();

    if (
      requesterError ||
      !requesterProfile
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            requesterError?.message ||
            'Requesting profile not found.',
        },
        {
          status: 404,
        }
      );
    }

    const listingId =
      new URL(
        request.url
      ).searchParams
        .get('listing_id')
        ?.trim() ||
      '';

    let targetProfileId =
      auth.user.id;
    let targetOrganizationId =
      optionalText(requesterProfile.org_id) ||
      '';
    let preferredState = '';

    if (listingId) {
      const {
        data: listing,
        error: listingError,
      } = await admin
        .from('listings')
        .select(`
          id,
          org_id,
          owner_user_id,
          state
        `)
        .eq(
          'id',
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
              'Listing not found.',
          },
          {
            status: 404,
          }
        );
      }

      if (
        !listing.owner_user_id
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'This listing does not have an assigned owner.',
          },
          {
            status: 400,
          }
        );
      }

      const requesterRole =
        String(
          requesterProfile.role ||
          ''
        )
          .trim()
          .toLowerCase();

      const sameOrganization =
        Boolean(
          requesterProfile.org_id &&
          listing.org_id &&
          requesterProfile.org_id ===
            listing.org_id
        );

      const canUseListingOwner =
        requesterRole ===
          'platform_admin' ||
        (
          (
            requesterRole ===
              'admin' ||
            requesterRole ===
              'org_admin'
          ) &&
          sameOrganization
        ) ||
        (
          requesterRole ===
            'agent' &&
          listing.owner_user_id ===
            auth.user.id
        );

      if (
        !canUseListingOwner
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'You do not have access to this listing owner’s marketing identity.',
          },
          {
            status: 403,
          }
        );
      }

      targetProfileId =
        listing.owner_user_id;
      targetOrganizationId =
        optionalText(listing.org_id) ||
        '';
      preferredState =
        optionalText(listing.state) ||
        '';
    }

    const {
      data: profile,
      error,
    } = await admin
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq(
        'id',
        targetProfileId
      )
      .single();

    if (
      error ||
      !profile
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error?.message ||
            'Marketing profile not found.',
        },
        {
          status: 404,
        }
      );
    }

    const identityContext =
      await loadMarketingBranding(
        admin,
        targetOrganizationId ||
          optionalText(profile.org_id) ||
          '',
        preferredState,
        profile as Record<string, unknown>
      );

    return NextResponse.json({
      ok: true,
      profile,
      ...marketingIdentityResponse(
        identityContext
      ),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Could not load marketing identity.',
      },
      {
        status: 500,
      }
    );
  }
}
export async function PATCH(
  request: Request
) {
  try {
    const auth =
      await authenticatedUser(
        request
      );

    if (!auth.user) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    const body =
      await request.json();

    const payload = {
      marketing_from_name:
        cleanText(
          body
            .marketing_from_name,
          150
        ),

      marketing_from_email:
        cleanText(
          body
            .marketing_from_email,
          250
        ),

      marketing_reply_to_email:
        cleanText(
          body
            .marketing_reply_to_email,
          250
        ),

      marketing_phone:
        cleanText(
          body.marketing_phone,
          80
        ),

      marketing_title:
        cleanText(
          body.marketing_title,
          150
        ),

      marketing_brokerage:
        cleanText(
          body
            .marketing_brokerage,
          200
        ),

      marketing_website_url:
        cleanText(
          body
            .marketing_website_url,
          500
        ),

      marketing_license_number:
        cleanText(
          body
            .marketing_license_number,
          150
        ),

      marketing_signature_text:
        cleanText(
          body
            .marketing_signature_text,
          2000
        ),

      marketing_physical_address:
        cleanText(
          body
            .marketing_physical_address,
          500
        ),

      marketing_facebook_url:
        cleanText(
          body
            .marketing_facebook_url,
          500
        ),

      marketing_instagram_url:
        cleanText(
          body
            .marketing_instagram_url,
          500
        ),

      marketing_linkedin_url:
        cleanText(
          body
            .marketing_linkedin_url,
          500
        ),

      marketing_youtube_url:
        cleanText(
          body
            .marketing_youtube_url,
          500
        ),

      marketing_tiktok_url:
        cleanText(
          body
            .marketing_tiktok_url,
          500
        ),

      marketing_x_url:
        cleanText(
          body
            .marketing_x_url,
          500
        ),

      marketing_office_phone:
        cleanText(
          body
            .marketing_office_phone,
          80
        ),

      marketing_office_address:
        cleanText(
          body
            .marketing_office_address,
          500
        ),

      marketing_appointment_url:
        cleanText(
          body
            .marketing_appointment_url,
          500
        ),

      marketing_designations:
        cleanTextArray(
          body
            .marketing_designations
        ),

      marketing_certifications:
        cleanTextArray(
          body
            .marketing_certifications
        ),

      marketing_service_areas:
        cleanTextArray(
          body
            .marketing_service_areas
        ),

      marketing_languages:
        cleanTextArray(
          body
            .marketing_languages
        ),

      marketing_disclaimer:
        cleanText(
          body
            .marketing_disclaimer,
          4000
        ),

      marketing_email_enabled:
        Boolean(
          body
            .marketing_email_enabled
        ),
    };

    const admin =
      adminClient();

    const {
      data: profile,
      error,
    } = await admin
      .from('profiles')
      .update(payload)
      .eq(
        'id',
        auth.user.id
      )
      .select(PROFILE_FIELDS)
      .single();

    if (
      error ||
      !profile
    ) {
      throw new Error(
        error?.message ||
          'Marketing identity was not returned after saving.'
      );
    }

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Could not save marketing identity.',
      },
      {
        status: 500,
      }
    );
  }
}


