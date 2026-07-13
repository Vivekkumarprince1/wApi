import { NextRequest, NextResponse } from "next/server";
import { canAccessAdminArea, hasPermission, updateAuthUser } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageEmployees")) return forbidden();

  const body = await request.json().catch(() => ({}));
  try {
    const { userId } = await params;
    return NextResponse.json({
      data: updateAuthUser(userId, {
        status: "former",
        manager: typeof body?.manager === "string" ? body.manager : undefined,
      }),
      termination: {
        reason: typeof body?.reason === "string" ? body.reason : "Not specified",
        effectiveDate: typeof body?.effectiveDate === "string" ? body.effectiveDate : new Date().toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "User not found." } },
      { status: 404 },
    );
  }
}
