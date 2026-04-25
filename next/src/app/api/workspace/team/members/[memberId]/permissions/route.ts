import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Permission, User } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET /api/workspace/team/members/[memberId]/permissions
 * Fetch permissions for a specific member
 */
export const GET = withRole(['owner', 'admin'], async (req: NextRequest, { params, workspace }) => {
  await dbConnect();
  const { memberId } = params;

  const permission = await Permission.findOne({ 
    user: memberId, 
    workspace: workspace._id 
  }).lean();

  if (!permission) {
    return NextResponse.json({ error: "Permission record not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: permission
  });
});

/**
 * PATCH /api/workspace/team/members/[memberId]/permissions
 * Override permissions for a specific member
 */
export const PATCH = withRole(['owner', 'admin'], async (req: NextRequest, { params, workspace }) => {
  await dbConnect();
  const { memberId } = params;
  const body = await req.json();
  const { permissions, isAvailable, maxConcurrentChats, assignedTags, role } = body;

  const permission = await Permission.findOne({ 
    user: memberId, 
    workspace: workspace._id 
  });

  if (!permission) {
    return NextResponse.json({ error: "Permission record not found" }, { status: 404 });
  }

  // Remove undefined values (including nested) so partial payloads don't clobber structured fields.
  const stripUndefinedDeep = (value: any): any => {
    if (Array.isArray(value)) return value.map(stripUndefinedDeep);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, stripUndefinedDeep(v)])
      );
    }
    return value;
  };

  // Update fields if provided
  if (role) permission.role = role;
  if (permissions && typeof permissions === 'object') {
    const sanitizedPermissions = stripUndefinedDeep(permissions);
    const currentPermissions =
      typeof (permission.permissions as any)?.toObject === 'function'
        ? (permission.permissions as any).toObject()
        : { ...(permission.permissions as any) };

    // Preserve existing billing object when only partial billing overrides are provided.
    if (sanitizedPermissions.billing && typeof sanitizedPermissions.billing === 'object') {
      sanitizedPermissions.billing = {
        ...(currentPermissions?.billing || {}),
        ...sanitizedPermissions.billing,
      };
    }

    permission.permissions = {
      ...currentPermissions,
      ...sanitizedPermissions,
    } as any;
  }
  if (isAvailable !== undefined) permission.isAvailable = isAvailable;
  if (maxConcurrentChats !== undefined) permission.maxConcurrentChats = maxConcurrentChats;
  if (assignedTags !== undefined) permission.assignedTags = assignedTags;

  await permission.save();

  return NextResponse.json({
    success: true,
    data: permission
  });
});
