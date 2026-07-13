import { NextResponse } from "next/server";
import { authenticateUser, defaultRouteForUser } from "@/lib/auth-store";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = loginSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the highlighted fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 }
    );
  }

  try {
    const user = authenticateUser(result.data.email, result.data.password);
    const response = NextResponse.json({
      data: {
        user,
        requiresVerification: !user.verified,
        redirectTo: user.verified ? defaultRouteForUser(user) : `/verify-email?email=${encodeURIComponent(user.email)}`,
      },
    });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: error instanceof Error ? error.message : "Unable to sign in.",
        },
      },
      { status: 401 }
    );
  }
}
