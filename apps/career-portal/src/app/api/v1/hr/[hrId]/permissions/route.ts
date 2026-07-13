import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findAuthUserById, isSuperAdminUser, permissionFlags, sanitizeUser, updateAuthUser } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import type { PermissionSet } from "@/types/career";

const schema = z.object({
  permissions: z.record(z.string(), z.boolean()).optional(),
  assignedJobIds: z.array(z.string()).optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ hrId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdminUser(user)) return forbidden("Only super admins can change HR permissions.");

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Correct the HR permissions." } }, { status: 400 });
  }

  const { hrId } = await params;
  const target = findAuthUserById(hrId);
  if (!target) return NextResponse.json({ error: { code: "NOT_FOUND", message: "HR user not found." } }, { status: 404 });

  const permissions = { ...sanitizeUser(target).permissions } as PermissionSet;
  for (const flag of permissionFlags) {
    const next = result.data.permissions?.[flag];
    if (typeof next === "boolean") permissions[flag] = next;
  }

  return NextResponse.json({
    data: updateAuthUser(hrId, {
      permissions,
      assignedJobIds: result.data.assignedJobIds,
    }),
  });
}

export const PATCH = PUT;
