import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Global Next.js Middleware (using proxy.ts convention for this version)
 * Handles page-level redirections for authentication and workspace state.
 */
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;
  
  const isOnboardingRoute = pathname.startsWith('/onboarding');
  const isBillingRoute = pathname.startsWith('/dashboard/billing');
  const isAuthRoute = pathname.startsWith('/auth');
  const isInviteRoute = pathname.startsWith('/auth/accept-invite');

  // Let the client-side handle the accept-invite page logic entirely
  if (isInviteRoute) {
    return NextResponse.next();
  }

  // Public routes that should always be accessible without auth
  const isPublicRoute =
    pathname === '/' ||
    isAuthRoute ||
    pathname.startsWith('/privacy') ||
    pathname === '/favicon.ico';

  // Everything else is protected.
  if (!isPublicRoute && !token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search || ''}`);
    return NextResponse.redirect(loginUrl);
  }

  if (token) {
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3005';
    const sessionUrl = `${backendUrl}/api/v1/auth/session`;

    try {
      const res = await fetch(sessionUrl, {
        method: 'GET',
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        if (isPublicRoute) return NextResponse.next();
        
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search || ''}`);
        const redirect = NextResponse.redirect(loginUrl);
        redirect.cookies.set('auth_token', '', { maxAge: 0, path: '/' });
        return redirect;
      }

      const session = await res.json().catch(() => ({}));
      const nextStep = typeof session?.nextStep === 'string' ? session.nextStep : null;
      const accessRestriction = session?.accessRestriction && typeof session.accessRestriction?.targetPath === 'string'
        ? session.accessRestriction
        : null;
      const targetPath = accessRestriction?.targetPath || nextStep;

      // Handle Redirection Logic
      if (targetPath) {
        if (!isOnboardingRoute && !isAuthRoute && pathname !== targetPath && !(accessRestriction?.kind === 'billing' && isBillingRoute)) {
          return NextResponse.redirect(new URL(targetPath, request.url));
        }

        if (isOnboardingRoute && pathname !== targetPath) {
          return NextResponse.redirect(new URL(targetPath, request.url));
        }

        if (isAuthRoute) {
          return NextResponse.redirect(new URL(targetPath, request.url));
        }
      }

      if (!targetPath) {
        if (isAuthRoute) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        if (isOnboardingRoute) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      } else if (accessRestriction?.kind === 'billing' && !isBillingRoute && pathname !== targetPath) {
        return NextResponse.redirect(new URL(targetPath, request.url));
      }

      return NextResponse.next();
    } catch (error) {
      console.error("[Proxy Middleware Error]:", error);
      if (isPublicRoute) return NextResponse.next();
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
