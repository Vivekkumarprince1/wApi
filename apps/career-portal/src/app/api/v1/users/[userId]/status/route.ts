import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdminArea, hasPermission, updateAuthUser } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

const schema = z.object({
  status: z.enum(["active", "inactive", "former", "suspended"]),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageEmployees")) return forbidden();

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid status." } }, { status: 400 });

  try {
    const { userId } = await params;
    return NextResponse.json({ data: updateAuthUser(userId, { status: result.data.status }) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "User not found." } },
      { status: 404 },
    );
  }
}

export const PATCH = PUT;
