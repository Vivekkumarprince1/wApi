import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Team, User, Permission } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * PUT /api/workspace/team/[id]
 * Update a team
 */
export const PUT = withAuth(async (req: NextRequest, { params, user: currentUser, workspace }) => {
  await dbConnect();
  const { id } = params;
  const body = await req.json();
  const { name, description, members, visibility, autoAssign } = body;

  const team = await Team.findOne({ _id: id, workspace: workspace._id });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Authorization: Global Admin/Manager OR Team Lead
  const isGlobalManager = ['owner', 'admin', 'manager'].includes(currentUser.role);
  const isTeamLead = await Permission.isLead(workspace._id, currentUser._id, team._id);

  if (!isGlobalManager && !isTeamLead) {
    return NextResponse.json({ error: "Permission denied: Only Team Leads or Admins can manage this team" }, { status: 403 });
  }

  if (name !== undefined) {
    const existing = await Team.findOne({ 
      workspace: workspace._id, 
      name: name.trim(), 
      _id: { $ne: id }, 
      isActive: true 
    });
    if (existing) {
      return NextResponse.json({ error: "A team with this name already exists" }, { status: 409 });
    }
    team.name = name.trim();
  }

  if (description !== undefined) team.description = description.trim();
  if (visibility !== undefined) team.visibility = visibility;
  if (autoAssign !== undefined) {
    team.autoAssign = { ...team.autoAssign, ...autoAssign };
  }

  if (members !== undefined) {
    const userIds = members.map((m: any) => m.user);
    const validCount = await User.countDocuments({
      _id: { $in: userIds },
      workspace: workspace._id,
      status: { $ne: 'removed' }
    });

    if (validCount !== userIds.length) {
      return NextResponse.json({ error: "Some members do not belong to this workspace" }, { status: 400 });
    }

    // No longer updating User.team legacy field here - we rely strictly on the bridge
    team.members = members;
  }

  await team.save();

  return NextResponse.json({
    success: true,
    data: await team.populate('members.user', '_id name email role status')
  });
});

/**
 * DELETE /api/workspace/team/[id]
 * Delete a team (Soft delete)
 */
export const DELETE = withAuth(async (req: NextRequest, { params, user: currentUser, workspace }) => {
  await dbConnect();
  const { id } = params;

  // Authorization: Only Global Admins can delete teams
  if (!['owner', 'admin'].includes(currentUser.role)) {
     return NextResponse.json({ error: "Permission denied: Only Admins can delete teams" }, { status: 403 });
  }

  const team = await Team.findOne({ _id: id, workspace: workspace._id });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  team.isActive = false;
  await team.save();

  return NextResponse.json({
    success: true,
    message: "Team deleted successfully"
  });
});

