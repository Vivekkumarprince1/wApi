import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth-store";
import { resetPasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = resetPasswordSchema.safeParse(body);

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
    resetPassword(result.data);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "OTP_INVALID",
          message: error instanceof Error ? error.message : "Unable to reset password.",
        },
      },
      { status: 400 }
    );
  }
}
