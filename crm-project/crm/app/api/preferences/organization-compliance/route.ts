import {
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const dynamic =
  'force-dynamic';

const ORGANIZATION_FIELDS = `
  id,
  name,
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

  return header
    .slice(7)
    .trim();
}

function cleanText(
  value: unknown,
  maxLength = 1000
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
  const token =
    bearerToken(request);

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
    data: userResult,
    error: userError,
  } =
    await authClient.auth.getUser(
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

  const admin =
    createClient(
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

  const {
    data: profile,
    error: profileError,
  } = await admin
    .from('profiles')
    .select(`
      id,
      org_id,
      role
    `)
    .eq(
      'id',
      userResult.user.id
    )
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
        persistSession:
          false,
        autoRefreshToken:
          false,
      },
    }
  );
}

function canEditOrganization(
  role: string | null
) {
  return (
    role === 'platform_admin' ||
    role === 'admin' ||
    role === 'org_admin'
  );
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

    const admin =
      adminClient();

    const {
      data: organization,
      error,
    } = await admin
      .from('organizations')
      .select(
        ORGANIZATION_FIELDS
      )
      .eq(
        'id',
        auth.profile.org_id
      )
      .single();

    if (
      error ||
      !organization
    ) {
      throw new Error(
        error?.message ||
          'Organization not found.'
      );
    }

    return NextResponse.json({
      ok: true,

      can_edit:
        canEditOrganization(
          auth.profile.role
        ),

      organization,
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

    const body =
      await request.json();

    const payload = {
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

    const admin =
      adminClient();

    const {
      data: organization,
      error,
    } = await admin
      .from('organizations')
      .update(payload)
      .eq(
        'id',
        auth.profile.org_id
      )
      .select(
        ORGANIZATION_FIELDS
      )
      .single();

    if (
      error ||
      !organization
    ) {
      throw new Error(
        error?.message ||
          'Organization compliance settings were not returned after saving.'
      );
    }

    return NextResponse.json({
      ok: true,
      organization,
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
