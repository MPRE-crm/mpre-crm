export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

type Role =
  | 'agent'
  | 'admin'
  | 'org_admin'
  | 'platform_admin';

type ProfileRow = {
  id: string;
  email: string | null;
  role: Role;
  org_id: string | null;
};

type UserRow = {
  user_id: string | null;
  name: string | null;
  email: string | null;
  org_id: string | null;
};

function getSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      'Missing env: NEXT_PUBLIC_SUPABASE_URL'
    );
  }

  if (!anonKey) {
    throw new Error(
      'Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const authorization =
      req.headers.get('authorization') || '';

    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
        }
      );
    }

    const authClient = getSupabaseAuthClient();

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
        }
      );
    }

    const { data: requester, error: requesterError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, email, role, org_id')
        .eq('id', user.id)
        .single();

    if (requesterError || !requester) {
      return NextResponse.json(
        {
          ok: false,
          error:
            requesterError?.message ||
            'CRM profile not found.',
        },
        {
          status: 403,
        }
      );
    }

    const typedRequester = requester as ProfileRow;

    let profileQuery = supabaseAdmin
      .from('profiles')
      .select('id, email, role, org_id')
      .in('role', [
        'agent',
        'admin',
        'org_admin',
        'platform_admin',
      ]);

    if (typedRequester.role === 'agent') {
      profileQuery = profileQuery.eq(
        'id',
        typedRequester.id
      );
    } else if (
      typedRequester.role === 'admin' ||
      typedRequester.role === 'org_admin'
    ) {
      profileQuery = profileQuery.eq(
        'org_id',
        typedRequester.org_id
      );
    }

    const { data: profiles, error: profilesError } =
      await profileQuery;

    if (profilesError) {
      throw profilesError;
    }

    const profileRows =
      (profiles || []) as ProfileRow[];

    const profileIds = profileRows.map(
      (profile) => profile.id
    );

    let userRows: UserRow[] = [];

    if (profileIds.length > 0) {
      const { data: users, error: usersError } =
        await supabaseAdmin
          .from('users')
          .select('user_id, name, email, org_id')
          .in('user_id', profileIds);

      if (!usersError) {
        userRows = (users || []) as UserRow[];
      }
    }

    const userByAuthId = new Map<
      string,
      UserRow
    >();

    for (const row of userRows) {
      if (row.user_id) {
        userByAuthId.set(row.user_id, row);
      }
    }

    const owners = profileRows
      .map((profile) => {
        const userRow = userByAuthId.get(profile.id);

        return {
          id: profile.id,
          name:
            userRow?.name ||
            profile.email ||
            'Unnamed CRM user',

          email:
            profile.email ||
            userRow?.email ||
            null,

          role: profile.role,
          org_id: profile.org_id,
        };
      })
      .filter((owner) => Boolean(owner.org_id))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );

    return NextResponse.json({
      ok: true,
      requester: typedRequester,
      owners,
    });
  } catch (error: any) {
    console.error(
      'Listing owner API error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Could not load listing owners.',
      },
      {
        status: 500,
      }
    );
  }
}
