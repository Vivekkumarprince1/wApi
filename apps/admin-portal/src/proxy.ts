import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge middleware for the admin portal (Next.js 16 `proxy.ts` convention).
 *
 * Every route except /login and static assets requires a valid admin_token.
 * The token is verified by calling the app's own Node-runtime session
 * endpoint (the edge runtime cannot verify the JWT or reach Mongo itself).
 */

const COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || "admin_token";

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLogin = pathname === "/login";
  const isHealth = pathname === "/health";
  const isApi = pathname.startsWith("/api/");

  // API routes self-guard via requireAdmin() and return JSON 401/403 — never
  // redirect them (a redirect would hand an HTML page to a fetch() caller).
  if (isApi || isHealth) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (isLogin) return NextResponse.next();
    return redirectToLogin(request, pathname);
  }

  // Validate the session via the Node-runtime endpoint.
  try {
    const res = await fetch(new URL("/api/admin/auth/session", request.url), {
      headers: { cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
    });

    const authenticated = res.ok;

    if (!authenticated) {
      if (isLogin) return NextResponse.next();
      const redirect = redirectToLogin(request, pathname);
      redirect.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return redirect;
    }

    // Authenticated admin hitting /login → send to dashboard.
    if (isLogin) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  } catch {
    // On validation failure, fail closed for protected routes.
    if (isLogin) return NextResponse.next();
    return redirectToLogin(request, pathname);
  }
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
