import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Global Next.js Proxy/Middleware.
 * Next.js 16.2.3 uses the `proxy.ts` convention.
 */
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  const isAuthRoute = pathname.startsWith('/auth');
  const isInviteRoute = pathname.startsWith('/auth/accept-invite');

  if (isInviteRoute) {
    return NextResponse.next();
  }

  const isPublicRoute =
    pathname === '/' ||
    isAuthRoute ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname === '/favicon.ico';

  if (!isPublicRoute && !token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search || ''}`);
    return NextResponse.redirect(loginUrl);
  }

  if (token) {
    // Keep proxy/middleware cheap. The client-side AuthInitializer loads the
    // session once and handles onboarding/billing redirects. Calling /session
    // here for every page transition/prefetch creates a large number of server
    // requests and can exhaust gateway auth rate limits.
    if (isAuthRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
