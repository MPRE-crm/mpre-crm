import {
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const dynamic =
  'force-dynamic';

const BRAND_KEY = 'mpre';

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

function cleanColor(
  value: unknown,
  fallback: string
) {
  const result =
    String(value ?? '')
      .trim()
      .toLowerCase();

  return /^#[0-9a-f]{6}$/.test(
    result
  )
    ? result
    : fallback;
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
      error: 'Missing authentication token.',
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
    .select('id, role, org_id')
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
      auth.profile.role !==
      'platform_admin'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Platform-admin access is required to view MPRE branding.',
        },
        {
          status: 403,
        }
      );
    }
    const admin = adminClient();

    const {
      data: brand,
      error,
    } = await admin
      .from(
        'platform_brand_settings'
      )
      .select(`
        brand_key,
        brand_name,
        master_logo_url,
        primary_color,
        secondary_color,
        accent_color,
        is_active
      `)
      .eq('brand_key', BRAND_KEY)
      .single();

    if (error || !brand) {
      throw new Error(
        error?.message ||
          'MPRE brand settings were not found.'
      );
    }

    return NextResponse.json({
      ok: true,
      can_edit: true,
      brand,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Could not load MPRE brand settings.',
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
      auth.profile.role !==
      'platform_admin'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Platform-admin access is required to change MPRE branding.',
        },
        {
          status: 403,
        }
      );
    }

    const body = await request.json();


    const payload = {
      brand_name:
        cleanText(
          body.brand_name,
          120
        ) || 'MPRE',
      primary_color: cleanColor(
        body.primary_color,
        '#0f172a'
      ),
      secondary_color: cleanColor(
        body.secondary_color,
        '#ffffff'
      ),
      accent_color: cleanColor(
        body.accent_color,
        '#d97706'
      ),

      is_active:
        body.is_active !== false,
    };

    const admin = adminClient();

    const {
      data: brand,
      error,
    } = await admin
      .from(
        'platform_brand_settings'
      )
      .update(payload)
      .eq('brand_key', BRAND_KEY)
      .select(`
        brand_key,
        brand_name,
        master_logo_url,
        primary_color,
        secondary_color,
        accent_color,
        is_active
      `)
      .single();

    if (error || !brand) {
      throw new Error(
        error?.message ||
          'MPRE brand settings were not returned after saving.'
      );
    }

    return NextResponse.json({
      ok: true,
      brand,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Could not save MPRE brand settings.',
      },
      {
        status: 500,
      }
    );
  }
}
