import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Request proxy for the admin portal (Next.js 16 `proxy.ts` convention).
 *
 * This proxy keeps unauthenticated browsers away from dashboard routes without
 * doing auth validation itself. The Node runtime dashboard layout and API
 * handlers verify the JWT. Avoiding a self-fetch here is important in deployed
 * environments where the proxy layer may not be able to call the public app URL.
 */

const COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || "admin_token";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLogin = pathname === "/login";
  const isApi = pathname.startsWith("/api/");
  const isHealth = pathname === "/health";
  const isStaticAsset = /\.(?:ico|png|jpg|jpeg|svg|webp|gif|css|js|txt|xml|json|map)$/.test(pathname);

  // API routes self-guard via requireAdmin() and return JSON 401/403 — never
  // redirect them (a redirect would hand an HTML page to a fetch() caller).
  if (isApi || isLogin || isHealth || isStaticAsset) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL("/login", request.url);
  if (pathname && pathname !== "/") {
    loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search || ""}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Protect everything except Next internals & static assets.
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
