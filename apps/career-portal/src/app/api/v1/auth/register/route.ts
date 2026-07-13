import { NextResponse } from "next/server";
import { registerCandidate } from "@/lib/auth-store";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = registerSchema.safeParse(body);

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
    const user = registerCandidate(result.data);
    const response = NextResponse.json(
      {
        data: {
          user,
          requiresVerification: true,
          otpHint: "123456",
          redirectTo: `/verify-email?email=${encodeURIComponent(user.email)}`,
        },
      },
      { status: 202 }
    );
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "REGISTRATION_CONFLICT",
          message: error instanceof Error ? error.message : "Unable to create account.",
        },
      },
      { status: 409 }
    );
  }
}
