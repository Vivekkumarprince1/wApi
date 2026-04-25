import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { User, Permission } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * POST /api/auth/switch-workspace
 * Switch the user's active workspace context.
 */
export const POST = withAuth(async (req, { user }) => {
  await dbConnect();
  
  const { workspaceId } = await req.json();

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
  }

  // 1. Verify membership
  const membership = await Permission.findOne({
    workspace: workspaceId,
    user: user._id,
    isActive: true
  });

  if (!membership && user.role !== 'super_admin') {
    return NextResponse.json({ error: "You are not a member of this workspace" }, { status: 403 });
  }

  // 2. Update user's active context
  await User.findByIdAndUpdate(user._id, {
    activeWorkspace: workspaceId
  });

  return NextResponse.json({
    success: true,
    message: "Workspace switched successfully",
    workspaceId
  });
});
