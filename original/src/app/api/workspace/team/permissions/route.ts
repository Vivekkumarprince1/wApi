import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Permission } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET /api/workspace/team/permissions
 * Return the role/permission matrix metadata
 */
export const GET = withRole(['owner', 'admin', 'manager'], async (req: NextRequest) => {
  await dbConnect();
  
  const roles = ['owner', 'admin', 'manager', 'agent', 'viewer'];
  const matrix: any = {};

  roles.forEach(role => {
    matrix[role] = {
      name: role.charAt(0).toUpperCase() + role.slice(1),
      description: role === 'owner' ? 'Full access to everything' :
                   role === 'admin' ? 'Full access except billing transfer' :
                   role === 'manager' ? 'Manages team, templates, and campaigns' :
                   role === 'agent' ? 'Handles conversations and contacts' : 'Read-only access',
      permissions: Permission.getDefaultPermissions(role)
    };
  });

  return NextResponse.json({
    success: true,
    data: matrix
  });
});

/**
 * PATCH /api/workspace/team/permissions
 * Update permissions for a specific role (Advanced Feature)
 */
export const PATCH = withRole(['owner', 'admin'], async (req: NextRequest) => {
    // Legacy parity: wApi sometimes allowed updating these or showed them as editable
    // For now, we'll return a 501 until we decide if role-level overrides are needed 
    // since Permission records are usually per-user in the new system.
  return NextResponse.json({ error: "Dynamic role permission editing is not yet implemented" }, { status: 501 });
});
