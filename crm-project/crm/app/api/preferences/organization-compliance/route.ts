import {
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const dynamic =
  'force-dynamic';

const MASTER_BRAND_KEY = 'mpre';

const ORGANIZATION_FIELDS = `
  id,
  name,
  org_display,
  market_name,
  brokerage_name,
  marketing_licensed_business_name,
  marketing_broker_license_number,
  marketing_license_state,
  marketing_privacy_policy_url,
  marketing_mls_attribution,
  marketing_standard_disclaimer,
  marketing_advertisement_label
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

  return header.slice(7).trim();
}

function cleanText(
  value: unknown,
  maxLength = 1000
) {
  const result =
    String(value ?? '').trim();

  if (!result) return null;
  return result.slice(0, maxLength);
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

async function authenticatedProfile(
  request: Request
) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null,
      error:
        'Missing authentication token.',
      status: 401,
    };
  }

  const {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  } = serverSettings();

  const authClient = createClient(
    supabaseUrl,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const {
    data: userResult,
    error: userError,
  } = await authClient.auth.getUser(
    token
  );

  if (
    userError ||
    !userResult.user
  ) {
    return {
      profile: null,
      error:
        userError?.message ||
        'Not authenticated.',
      status: 401,
    };
  }

  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const {
    data: profile,
    error: profileError,
  } = await admin
    .from('profiles')
    .select('id, org_id, role')
    .eq('id', userResult.user.id)
    .single();

  if (
    profileError ||
    !profile
  ) {
    return {
      profile: null,
      error:
        profileError?.message ||
        'Profile not found.',
      status: 404,
    };
  }

  return {
    profile,
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
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function canEditOrganization(
  role: string | null
) {
  return [
    'platform_admin',
    'admin',
    'org_admin',
  ].includes(String(role || ''));
}

async function masterBrandName(
  admin: ReturnType<typeof adminClient>
) {
  const {
    data,
    error,
  } = await admin
    .from('platform_brand_settings')
    .select('brand_name')
    .eq('brand_key', MASTER_BRAND_KEY)
    .maybeSingle();

  if (error) throw error;

  return (
    cleanText(
      data?.brand_name,
      120
    ) || 'MPRE'
  );
}

function normalizeMarketName(
  value: unknown,
  brandName: string
) {
  const marketName =
    cleanText(value, 120);

  if (!marketName) return null;

  if (
    marketName.toLowerCase() ===
    brandName.toLowerCase()
  ) {
    return null;
  }

  const prefix = `${brandName} `;

  if (
    marketName
      .toLowerCase()
      .startsWith(
        prefix.toLowerCase()
      )
  ) {
    return (
      cleanText(
        marketName.slice(
          prefix.length
        ),
        120
      ) || null
    );
  }

  return marketName;
}

async function latestLicense(
  admin: ReturnType<typeof adminClient>,
  organizationId: string
) {
  const {
    data,
    error,
  } = await admin
    .from(
      'organization_real_estate_licenses'
    )
    .select(`
      id,
      brokerage_logo_url,
      office_address,
      compliance_mailing_address
    `)
    .eq(
      'organization_id',
      organizationId
    )
    .order('created_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function GET(
  request: Request
) {
  try {
    const auth =
      await authenticatedProfile(
        request
      );

    if (!auth.profile) {
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

    if (
      !canEditOrganization(
        auth.profile.role
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Administrator access is required to view organization compliance settings.',
        },
        {
          status: 403,
        }
      );
    }

    const admin = adminClient();

    const {
      data: organization,
      error,
    } = await admin
      .from('organizations')
      .select(ORGANIZATION_FIELDS)
      .eq('id', auth.profile.org_id)
      .single();

    if (error || !organization) {
      throw new Error(
        error?.message ||
          'Organization not found.'
      );
    }

    const license = await latestLicense(
      admin,
      auth.profile.org_id
    );

    const brandName =
      await masterBrandName(admin);

    return NextResponse.json({
      ok: true,
      can_edit: true,
      master_brand_name: brandName,
      organization: {
        ...organization,
        brokerage_logo_url:
          license?.brokerage_logo_url ||
          null,
        brokerage_office_address:
          license?.office_address || null,
        brokerage_compliance_mailing_address:
          license
            ?.compliance_mailing_address ||
          null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Could not load organization compliance settings.',
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
      await authenticatedProfile(
        request
      );

    if (!auth.profile) {
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

    if (
      !canEditOrganization(
        auth.profile.role
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Only an administrator may update brokerage compliance settings.',
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();

    const admin = adminClient();

    const brandName =
      await masterBrandName(admin);

    const marketName =
      normalizeMarketName(
        body.market_name,
        brandName
      );

    const organizationDisplay =
      marketName
        ? `${brandName} ${marketName}`
        : brandName;

    const payload = {
      market_name: marketName,
      org_display:
        organizationDisplay,
      brokerage_name:
        cleanText(
          body.brokerage_name,
          180
        ),
      marketing_licensed_business_name:
        cleanText(
          body
            .marketing_licensed_business_name,
          250
        ),
      marketing_broker_license_number:
        cleanText(
          body
            .marketing_broker_license_number,
          150
        ),
      marketing_license_state:
        cleanText(
          body
            .marketing_license_state,
          100
        ) || 'Idaho',
      marketing_privacy_policy_url:
        cleanText(
          body
            .marketing_privacy_policy_url,
          500
        ),
      marketing_mls_attribution:
        cleanText(
          body
            .marketing_mls_attribution,
          2000
        ),
      marketing_standard_disclaimer:
        cleanText(
          body
            .marketing_standard_disclaimer,
          4000
        ),
      marketing_advertisement_label:
        cleanText(
          body
            .marketing_advertisement_label,
          100
        ) || 'Advertisement',
    };

    const {
      data: organization,
      error,
    } = await admin
      .from('organizations')
      .update(payload)
      .eq('id', auth.profile.org_id)
      .select(ORGANIZATION_FIELDS)
      .single();

    if (error || !organization) {
      throw new Error(
        error?.message ||
          'Organization compliance settings were not returned after saving.'
      );
    }

    const license = await latestLicense(
      admin,
      auth.profile.org_id
    );

    if (license?.id) {
      const {
        error: licenseUpdateError,
      } = await admin
        .from(
          'organization_real_estate_licenses'
        )
        .update({
          licensed_business_name:
            payload
              .marketing_licensed_business_name,
          brokerage_license_number:
            payload
              .marketing_broker_license_number,
        })
        .eq('id', license.id);

      if (licenseUpdateError) {
        throw licenseUpdateError;
      }
    }

    return NextResponse.json({
      ok: true,
      master_brand_name: brandName,
      organization: {
        ...organization,
        brokerage_logo_url:
          license?.brokerage_logo_url ||
          null,
        brokerage_office_address:
          license?.office_address || null,
        brokerage_compliance_mailing_address:
          license
            ?.compliance_mailing_address ||
          null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Could not save organization compliance settings.',
      },
      {
        status: 500,
      }
    );
  }
}
