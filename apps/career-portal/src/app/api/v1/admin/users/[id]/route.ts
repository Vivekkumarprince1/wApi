import { NextRequest, NextResponse } from "next/server";
import { deleteAuthUser, isSuperAdminUser, updateAuthUser } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { userManagementSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!user.permissions.canManageEmployees) return forbidden();

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = userManagementSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the user fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  if ((result.data.role || result.data.permissions) && !isSuperAdminUser(user)) {
    return forbidden("Only super admins can change roles or HR permissions.");
  }

  try {
    return NextResponse.json({ data: updateAuthUser(id, result.data) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "User not found." } },
      { status: 404 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdminUser(user)) return forbidden("Only super admins can delete users.");

  const { id } = await params;
  if (id === user.id) return forbidden("You cannot delete your own active session account.");

  try {
    return NextResponse.json({ data: deleteAuthUser(id) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "User not found." } },
      { status: 404 },
    );
  }
}
