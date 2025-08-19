// crm-project/crm/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Public routes (no auth required)
const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/api/twilio',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

// Private areas that always require auth
// We also treat "/" as protected, so landing on the root requires auth.
const PROTECTED_PREFIXES = ['/dashboard'];
const BROWSER_SESSION_COOKIE = 'app-session';

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/static')
  );
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isProtectedPath(pathname: string) {
  if (pathname === '/' || pathname === '') return true; // protect root
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isStaticAsset(pathname)) return NextResponse.next();

  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
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

  const { data: { session } } = await supabase.auth.getSession();

  const hasBrowserSession = !!req.cookies.get(BROWSER_SESSION_COOKIE)?.value;
  const isLogin = pathname === '/login';
  const isCallback = pathname.startsWith('/auth/callback');
  const protectedPath = isProtectedPath(pathname);
  const publicPath = isPublicPath(pathname);

  // If OAuth callback succeeded, mark this browser session.
  if (isCallback && session) {
    res.cookies.set({
      name: BROWSER_SESSION_COOKIE,
      value: '1',
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });
    return res;
  }

  // Allow public routes; if already logged in and hits /login, bounce to dashboard.
  if (publicPath) {
    if (isLogin && session) {
      res.cookies.set({
        name: BROWSER_SESSION_COOKIE,
        value: '1',
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      });
      const url = req.nextUrl.clone();
      const target = url.searchParams.get('redirect') || '/dashboard/leads';
      return NextResponse.redirect(new URL(target, req.url));
    }
    return res;
  }

  // Protected routes (including "/")
  if (protectedPath) {
    // No Supabase session → go login
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname + search);
      return NextResponse.redirect(url);
    }

    // We DO have a Supabase session but NO browser-session flag yet.
    // This happens on first password sign-in (no /auth/callback).
    // Set the session-scoped flag now and continue.
    if (!hasBrowserSession) {
      res.cookies.set({
        name: BROWSER_SESSION_COOKIE,
        value: '1',
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      });
      return res;
    }
  }

  return res;
}

export const config = {
  matcher: '/:path*',
};
