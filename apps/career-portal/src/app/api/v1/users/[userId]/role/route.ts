import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSuperAdminUser, updateAuthUser } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

const schema = z.object({
  role: z.enum(["user", "employee", "admin", "super-admin"]),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdminUser(user)) return forbidden("Only super admins can change user roles.");

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid role." } }, { status: 400 });

  try {
    const { userId } = await params;
    return NextResponse.json({ data: updateAuthUser(userId, { role: result.data.role }) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "User not found." } },
      { status: 404 },
    );
  }
}
