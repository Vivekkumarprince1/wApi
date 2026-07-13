import { NextRequest, NextResponse } from "next/server";
import { canAccessAdminArea, deleteAuthUser, findAuthUserById, hasPermission, isSuperAdminUser, sanitizeUser } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageEmployees")) return forbidden();

  const { userId } = await params;
  const target = findAuthUserById(userId);
  if (!target) return NextResponse.json({ error: { code: "NOT_FOUND", message: "User not found." } }, { status: 404 });
  return NextResponse.json({ data: sanitizeUser(target) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdminUser(user)) return forbidden("Only super admins can delete users.");

  const { userId } = await params;
  if (userId === user.id) return forbidden("You cannot delete your own active session account.");

  try {
    return NextResponse.json({ data: deleteAuthUser(userId) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "User not found." } },
      { status: 404 },
    );
  }
}
