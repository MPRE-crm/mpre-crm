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
      data: profile,
      error,
    } = await admin
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq(
        'id',
        auth.user.id
      )
      .single();

    if (
      error ||
      !profile
    ) {
      throw new Error(
        error?.message ||
          'Profile not found.'
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


