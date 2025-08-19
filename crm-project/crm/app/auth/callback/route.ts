import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });

  // Ensure cookies() is awaited
  const c = await cookies();  // Next 15: must await

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return c.get(name)?.value;  // Safely access cookie values
        },
        set(name, value, options) {
          res.cookies.set({ name, value, ...options });  // Set cookie on response
        },
        remove(name, options) {
          res.cookies.set({ name, value: '', ...options });  // Remove cookie
        },
      },
    }
  );

  const { event, session } = await req.json();

  // Handle different auth events
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    if (session?.access_token && session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }
  } else if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut();
  }

  return res;
}
