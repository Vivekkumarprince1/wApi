import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Role } from "@/lib/models/auth/Role";
import { Permission } from "@/lib/models/auth/Permission";
import dbConnect from "@/lib/db-connect";

/**
 * PATCH /api/workspace/team/roles/[roleId]
 * Update a custom role
 */
export const PATCH = withRole(['owner', 'admin'], async (req: NextRequest, { params, workspace }) => {
  await dbConnect();
  const { roleId } = params;
  const body = await req.json();
  const { name, description, permissions, color } = body;

  const role = await Role.findOne({ _id: roleId, workspace: workspace._id });
  if (!role) {
    return NextResponse.json({ error: "Role not found or is a system role" }, { status: 404 });
  }

  if (name) role.name = name;
  if (description !== undefined) role.description = description;
  if (permissions) role.permissions = permissions;
  if (color) role.color = color;

  await role.save();

  // Propagation: If permissions changed, we must update all users with this role
  if (permissions) {
    // Explicitly update all permissions documents for users with this custom role
    await Permission.updateMany(
      { workspace: workspace._id, role: role.name },
      { permissions: permissions }
    );
  }

  return NextResponse.json({
    success: true,
    data: role
  });
});

/**
 * DELETE /api/workspace/team/roles/[roleId]
 * Delete a custom role
 */
export const DELETE = withRole(['owner', 'admin'], async (req: NextRequest, { params, workspace }) => {
  await dbConnect();
  const { roleId } = params;

  const role = await Role.findOne({ _id: roleId, workspace: workspace._id });
  if (!role) {
    return NextResponse.json({ error: "Role not found or is a system role" }, { status: 404 });
  }

  // Check if any users are currently assigned to this role
  const usersInRole = await Permission.countDocuments({ workspace: workspace._id, role: role.name });
  if (usersInRole > 0) {
    return NextResponse.json({ 
      error: "Cannot delete role while users are still assigned to it. Please reassign them first." 
    }, { status: 400 });
  }

  await Role.findByIdAndDelete(roleId);

  return NextResponse.json({
    success: true,
    message: "Role deleted successfully"
  });
});
