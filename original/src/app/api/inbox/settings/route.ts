import { NextRequest, NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/middlewares/auth";
import { Workspace, Permission } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET /api/inbox/settings
 * Fetch inbox and chat assignment settings for the current workspace
 */
export const GET = withAuth(async (req: NextRequest, { user, workspace }) => {
  try {
    await dbConnect();

    const isElevatedRole = ['owner', 'admin', 'manager'].includes(user.role);
    const permission = await Permission.findOne({ workspace: workspace._id, user: user._id })
      .select('permissions.viewAllConversations permissions.assignConversations permissions.manageTeam')
      .lean();

    const canViewAssignmentSettings = isElevatedRole || Boolean(
      permission?.permissions?.viewAllConversations ||
      permission?.permissions?.assignConversations ||
      permission?.permissions?.manageTeam
    );

    if (!canViewAssignmentSettings) {
      return NextResponse.json({
        success: false,
        error: "Permission denied"
      }, { status: 403 });
    }
    
    // The workspace object from middleware is already populated with settings usually,
    // but we'll fetch fresh from DB to be sure of the structure
    const ws = await Workspace.findById(workspace._id).select('inboxSettings').lean();

    if (!ws) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: ws.inboxSettings || {
        autoAssignmentEnabled: false,
        assignmentStrategy: 'MANUAL',
        slaEnabled: false,
        slaFirstResponseMinutes: 60,
        slaResolutionMinutes: 1440,
        agentRateLimitEnabled: true,
        agentMessagesPerMinute: 30,
        softLockEnabled: true,
        softLockTimeoutSeconds: 60
      }
    });
  } catch (error: any) {
    console.error("[Inbox Settings GET]:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * PATCH /api/inbox/settings
 * Update inbox and chat assignment settings
 */
export const PATCH = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();
    const body = await req.json();

    // Update the workspace document
    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      workspace._id,
      { $set: { inboxSettings: body } },
      { returnDocument: 'after', select: 'inboxSettings' }
    ).lean();

    if (!updatedWorkspace) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updatedWorkspace.inboxSettings
    });
  } catch (error: any) {
    console.error("[Inbox Settings PATCH]:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
