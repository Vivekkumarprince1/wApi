import { NextRequest, NextResponse } from "next/server";

const sessionCookie = "career_session";

const publicPages = new Set([
  "/",
  "/jobs",
  "/contact",
  "/login",
  "/register",
  "/verify",
  "/verify-offer",
]);

const publicPagePrefixes = ["/jobs/", "/verify/", "/verify-offer/", "/offer/accept/"];
const publicApiPrefixes = [
  "/api/v1/jobs",
  "/api/v1/auth",
  "/api/v1/contact",
  "/api/v1/verify",
  "/api/v1/offers",
  "/api/v1/reviews/approved",
  "/api/v1/contracts/offer",
  "/api/v1/contracts/upload-document",
];

function isPublicRoute(pathname: string) {
  return (
    publicPages.has(pathname) ||
    publicPagePrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (request.cookies.has(sessionCookie)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Sign in to access this resource.",
        },
      },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
