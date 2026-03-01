import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEXT.JS EDGE MIDDLEWARE — ROUTE PROTECTION
 * Runs BEFORE any page renders. Blocks unauthenticated access at the edge.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Routes that DON'T require authentication
const PUBLIC_ROUTES = [
    '/',
    '/auth/login',
    '/auth/register',
    '/auth/reset',
    '/privacy',
    '/privacy/data-deletion-instructions',
];

// Route prefixes that are always public
const PUBLIC_PREFIXES = ['/auth/', '/privacy/', '/_next/', '/api/', '/favicon'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Allow public routes
    if (PUBLIC_ROUTES.includes(pathname)) {
        return NextResponse.next();
    }

    // 2. Allow public prefixes (auth pages, static assets, API routes)
    if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        return NextResponse.next();
    }

    // 3. Allow static files and Next.js internals
    if (
        pathname.includes('.') || // files with extensions (images, css, js, etc.)
        pathname.startsWith('/__nextjs')
    ) {
        return NextResponse.next();
    }

    // 4. Check for auth token
    //    Token stored in localStorage isn't accessible in middleware (edge runtime),
    //    so we check for it via a cookie. The AuthProvider will set this cookie.
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
        // No token → redirect to login with return URL
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('returnTo', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 5. Token exists → allow through (AuthProvider will validate it client-side)
    return NextResponse.next();
}

// Only run middleware on these paths (skip static assets completely)
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
