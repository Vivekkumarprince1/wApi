import { NextRequest, NextResponse } from "next/server";
import { emptyPermissions, isSuperAdminUser, updateAuthUser } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ hrId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdminUser(user)) return forbidden("Only super admins can revoke HR users.");

  const { hrId } = await params;
  if (hrId === user.id) return forbidden("You cannot revoke your own active session account.");

  try {
    return NextResponse.json({
      data: updateAuthUser(hrId, {
        role: "employee",
        department: "General",
        permissions: emptyPermissions(),
        assignedJobIds: [],
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "HR user not found." } },
      { status: 404 },
    );
  }
}
