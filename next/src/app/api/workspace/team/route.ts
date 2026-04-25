import { NextRequest, NextResponse } from "next/server";
import { withRole, withFeature, withAuth } from "@/lib/middlewares/auth";
import { Team, User } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET /api/workspace/team
 * List all teams for the current workspace
 */
export const GET = withFeature('TEAM_MGMT', withAuth(async (req: NextRequest, { workspace }) => {
  await dbConnect();
  
  const teams = await Team.find({ 
    workspace: workspace._id, 
    isActive: { $ne: false } 
  })
    .populate('members.user', '_id name email role status')
    .sort('-createdAt');

  return NextResponse.json({
    success: true,
    data: teams,
    total: teams.length
  });
}));


/**
 * POST /api/workspace/team
 * Create a new team
 */
export const POST = withFeature('TEAM_MGMT', withRole(['owner', 'admin'], async (req: NextRequest, { user, workspace }: any) => {
  await dbConnect();
  
  const body = await req.json();
  const { name, description, members, visibility, autoAssign } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  // 1. Check for duplicate name in same workspace
  const existing = await Team.findOne({ workspace: workspace._id, name: name.trim(), isActive: true });
  if (existing) {
    return NextResponse.json({ error: "A team with this name already exists" }, { status: 409 });
  }

  // 2. Validate members (ensure they belong to workspace)
  if (members && members.length > 0) {
    const userIds = members.map((m: any) => m.user);
    const validCount = await User.countDocuments({
      _id: { $in: userIds },
      workspace: workspace._id,
      status: { $ne: 'removed' }
    });

    if (validCount !== userIds.length) {
      return NextResponse.json({ error: "Some members do not belong to this workspace" }, { status: 400 });
    }
  }

  // 3. Create Team
  const team = new Team({
    workspace: workspace._id,
    name: name.trim(),
    description: description?.trim(),
    members: members || [],
    visibility: visibility || 'team_only',
    autoAssign: autoAssign || { enabled: false, strategy: 'round_robin' },
    createdBy: user._id
  });

  await team.save();

  // 4. Update User team references (Legacy parity: users can be in one team primary)
  if (members && members.length > 0) {
    await User.updateMany(
      { _id: { $in: members.map((m: any) => m.user) } },
      { $set: { team: team._id } }
    );
  }

  return NextResponse.json({
    success: true,
    data: await team.populate('members.user', '_id name email role status')
  });
})) as any;
