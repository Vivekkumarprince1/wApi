import { NextRequest, NextResponse } from "next/server";
import { createHrUser, isSuperAdminUser } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { hrCreateSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdminUser(user)) return forbidden("Only super admins can create HR users.");

  const body = await request.json().catch(() => null);
  const result = hrCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the HR user fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ data: createHrUser(result.data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "USER_CONFLICT", message: error instanceof Error ? error.message : "Could not create HR user." } },
      { status: 409 },
    );
  }
}
