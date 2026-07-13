import { NextResponse } from "next/server";
import { defaultRouteForUser, verifyUserEmail } from "@/lib/auth-store";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";
import { verifyEmailSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = verifyEmailSchema.safeParse(body);

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
    const user = verifyUserEmail(result.data.email, result.data.otp);
    const response = NextResponse.json({
      data: {
        user,
        redirectTo: defaultRouteForUser(user),
      },
    });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "OTP_INVALID",
          message: error instanceof Error ? error.message : "Unable to verify email.",
        },
      },
      { status: 400 }
    );
  }
}
