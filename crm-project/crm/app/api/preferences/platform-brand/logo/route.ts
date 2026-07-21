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
      .select('id, role')
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
      profile.role !==
      'platform_admin'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Platform-admin access is required to replace the MPRE logo.',
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
            'Choose an MPRE logo.',
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

    const extension =
      safeExtension(fileValue);

    const storagePath =
      `platform/mpre/master-logo-${Date.now()}.${extension}`;

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
        'platform_brand_settings'
      )
      .update({
        master_logo_url: publicUrl,
      })
      .eq('brand_key', 'mpre');

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      ok: true,
      url: publicUrl,
    });
  } catch (error: any) {
    console.error(
      'platform brand logo upload error',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Could not upload the MPRE logo.',
      },
      {
        status: 500,
      }
    );
  }
}
