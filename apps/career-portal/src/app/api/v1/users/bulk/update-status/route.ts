import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdminArea, hasPermission, updateAuthUser } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

const schema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
  status: z.enum(["active", "inactive", "former", "suspended"]),
});

export async function PUT(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageEmployees")) return forbidden();

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Choose users and a valid status." } }, { status: 400 });
  }

  const updated = [];
  const failed = [];
  for (const id of result.data.userIds) {
    try {
      updated.push(updateAuthUser(id, { status: result.data.status }));
    } catch {
      failed.push(id);
    }
  }

  return NextResponse.json({ data: { updated, failed } });
}
