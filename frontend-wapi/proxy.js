import { NextResponse } from 'next/server';

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  // Define public routes (landing, login, register, etc.)
  const isPublicRoute = 
    pathname === '/' || 
    pathname.startsWith('/auth/') || 
    pathname.startsWith('/privacy') || 
    pathname.startsWith('/terms') ||
    pathname.includes('.'); // assets, favicons, etc.

  // 1. If trying to access a protected route without a token, redirect to login
  if (!token && !isPublicRoute) {
    const url = new URL('/auth/login', request.url);
    // Optional: save the intended destination to redirect back after login
    // url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // 2. If trying to access auth pages with a valid token, redirect to dashboard
  if (token && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
