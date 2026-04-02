import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const c = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return c.get(name)?.value;
        },
        set(name, value, options) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  await supabase.auth.signOut();

  res.cookies.set({
    name: 'app-session',
    value: '',
    path: '/',
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
  });

  res.cookies.set({
    name: 'app-session',
    value: '',
    path: '/',
    expires: new Date(0),
    sameSite: 'lax',
    secure: true,
  });

  return res;
}