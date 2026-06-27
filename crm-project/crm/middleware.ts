// crm-project/crm/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Public routes (no auth required)
const PUBLIC_PATHS = [
  '/login',
  '/reset-password',
  '/auth/callback',
  '/api',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never intercept WS handshakes
  const upgrade = (req.headers.get('upgrade') || '').toLowerCase();
  if (upgrade === 'websocket') return NextResponse.next();

  // Static assets
  if (isStaticAsset(pathname)) return NextResponse.next();

  // API routes are public to middleware. Route handlers enforce their own rules.
  if (pathname.startsWith('/api/')) return NextResponse.next();

  // IMPORTANT:
  // Dashboard auth is handled by MfaGate because the browser Supabase client
  // stores the active auth session in localStorage. Middleware cannot reliably
  // see that localStorage session, so protecting /dashboard here causes a
  // login <-> dashboard redirect loop.
  if (pathname.startsWith('/dashboard')) return NextResponse.next();

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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isLogin = pathname === '/login';
  const isCallback = pathname.startsWith('/auth/callback');
  const publicPath = isPublicPath(pathname);

  // OAuth callback -> set browser session flag
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

  // Public routes
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

  // Root goes to login. Dashboard itself is handled above by MfaGate.
  if (pathname === '/' || pathname === '') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: '/:path*',
};
