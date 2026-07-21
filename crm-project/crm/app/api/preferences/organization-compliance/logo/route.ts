import {
  NextResponse,
} from 'next/server';

import {
  createClient,
} from '@supabase/supabase-js';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

function bearerToken(
  request: Request
) {
  const header =
    request.headers.get(
      'authorization'
    ) || '';

  return header
    .toLowerCase()
    .startsWith('bearer ')
    ? header.slice(7).trim()
    : '';
}

function safeExtension(
  file: File
) {
  const typeMap:
    Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

  return typeMap[file.type] || 'png';
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

export async function POST(
  request: Request
) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Missing authentication token.',
        },
        {
          status: 401,
        }
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
      return NextResponse.json(
        {
          ok: false,
          error:
            userError?.message ||
            'Not authenticated.',
        },
        {
          status: 401,
        }
      );
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
      throw new Error(
        profileError?.message ||
          'Profile not found.'
      );
    }

    if (
      !canEditOrganization(
        profile.role
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Administrator access is required to replace the brokerage logo.',
        },
        {
          status: 403,
        }
      );
    }

    const formData =
      (await request.formData()) as any;

    const fileValue =
      formData.get('file');

    if (
      !(fileValue instanceof File)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Choose a brokerage logo.',
        },
        {
          status: 400,
        }
      );
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (
      !allowedTypes.includes(
        fileValue.type
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Logo must be JPG, PNG or WebP.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      fileValue.size >
      8 * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Logo must be smaller than 8 MB.',
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: licenseRow,
      error: licenseError,
    } = await admin
      .from(
        'organization_real_estate_licenses'
      )
      .select('id')
      .eq(
        'organization_id',
        profile.org_id
      )
      .order('created_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (
      licenseError ||
      !licenseRow
    ) {
      throw new Error(
        licenseError?.message ||
          'Create the organization brokerage-license record before uploading its logo.'
      );
    }

    const extension =
      safeExtension(fileValue);

    const storagePath =
      `${profile.org_id}/brokerage/logo-${Date.now()}.${extension}`;

    const buffer = Buffer.from(
      await fileValue.arrayBuffer()
    );

    const {
      error: uploadError,
    } = await admin.storage
      .from('profile-pictures')
      .upload(
        storagePath,
        buffer,
        {
          contentType: fileValue.type,
          upsert: false,
          cacheControl: '3600',
        }
      );

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: publicUrlData,
    } = admin.storage
      .from('profile-pictures')
      .getPublicUrl(storagePath);

    const publicUrl =
      publicUrlData.publicUrl;

    const {
      error: updateError,
    } = await admin
      .from(
        'organization_real_estate_licenses'
      )
      .update({
        brokerage_logo_url: publicUrl,
      })
      .eq('id', licenseRow.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      ok: true,
      url: publicUrl,
    });
  } catch (error: any) {
    console.error(
      'brokerage logo upload error',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Could not upload the brokerage logo.',
      },
      {
        status: 500,
      }
    );
  }
}
