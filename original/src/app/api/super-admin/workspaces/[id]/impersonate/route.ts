import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { User, Workspace, AuditLog } from "@/lib/models";
import { signToken, setAuthCookie } from "@/lib/auth-utils";
import dbConnect from "@/lib/db-connect";

/**
 * POST /api/super-admin/workspaces/[id]/impersonate
 * Restricted to super_admin or admin roles
 */
export const POST = withRole(['super_admin'], async (req: NextRequest, { params, user: adminUser }) => {
  await dbConnect();
  
  const { id: workspaceId } = await params;

  // 1. Find the workspace
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // 2. Find the owner of that workspace
  const targetUser = await User.findOne({ workspace: workspaceId, role: 'owner' });
  if (!targetUser) {
    return NextResponse.json({ 
      error: "No owner found for this workspace. Cannot impersonate." 
    }, { status: 404 });
  }

  // 3. Log the action (Audit Trail)
  await AuditLog.logAdminAction({
    workspaceId: workspace._id.toString(),
    userId: adminUser._id.toString(),
    action: 'USER_IMPERSONATION',
    resource: {
      type: 'USER',
      id: targetUser._id,
      name: targetUser.email
    },
    details: {
      targetEmail: targetUser.email,
      workspaceName: workspace.name
    },
    req
  });

  // 4. Generate new token for the target user (Include original admin ID)
  const token = signToken({ 
    id: targetUser._id.toString(),
    adminId: adminUser._id.toString(),
    isImpersonating: true
  });

  // 5. Create response and set cookie
  const response = NextResponse.json({
    success: true,
    message: `Session generated for ${targetUser.email}`,
    targetUrl: '/dashboard'
  });

  return setAuthCookie(response, token);
}) as any;
