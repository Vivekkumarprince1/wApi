import { NextRequest, NextResponse } from "next/server";
import { withRole, withAuth } from "@/lib/middlewares/auth";
import { Permission } from "@/lib/models/auth/Permission";
import { Role } from "@/lib/models/auth/Role";
import dbConnect from "@/lib/db-connect";

/**
 * GET /api/workspace/team/roles
 * List all roles for the workspace (System + Custom)
 */
export const GET = withAuth(async (req: NextRequest, { workspace }) => {
  await dbConnect();

  // Get custom roles from DB
  const customRoles = await Role.find({ workspace: workspace._id }).sort({ createdAt: 1 });

  // Define System Roles (Fallback/Static)
  const systemRoles = [
    { slug: 'owner', name: 'Owner', description: 'Full access to all settings and billing.', isSystem: true, color: 'purple' },
    { slug: 'admin', name: 'Admin', description: 'Can manage team and all settings except billing.', isSystem: true, color: 'blue' },
    { slug: 'manager', name: 'Manager', description: 'Can manage conversations and view reports.', isSystem: true, color: 'emerald' },
    { slug: 'agent', name: 'Agent', description: 'Can send and receive messages.', isSystem: true, color: 'amber' },
    { slug: 'viewer', name: 'Viewer', description: 'ReadOnly access to conversations and analytics.', isSystem: true, color: 'slate' },
  ].map(r => ({
    ...r,
    permissions: (Permission as any).getDefaultPermissions(r.slug)
  }));

  return NextResponse.json({
    success: true,
    data: [...systemRoles, ...customRoles]
  });
});

/**
 * POST /api/workspace/team/roles
 * Create a new custom role
 */
export const POST = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  await dbConnect();
  const body = await req.json();
  const { name, description, permissions, color } = body;

  if (!name) {
    return NextResponse.json({ error: "Role name is required" }, { status: 400 });
  } else {
    const { Role } = await import("@/lib/models/auth/Role");
    const existing = await Role.findOne({ workspace: workspace._id, name });
    if (existing) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 400 });
    }
  }

  // Default permissions if not provided (use agent defaults)
  const defaultPerms = (Permission as any).getDefaultPermissions('agent');

  const role = await Role.create({
    name,
    description,
    workspace: workspace._id,
    permissions: permissions || defaultPerms,
    color: color || 'indigo',
    isSystem: false
  });

  return NextResponse.json({
    success: true,
    data: role
  });
});
