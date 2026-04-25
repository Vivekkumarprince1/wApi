import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { User, Workspace, Permission, Plan } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET /api/auth/workspaces
 * List all workspaces the user belongs to.
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  await dbConnect();

  const memberships = await Permission.find({ 
    user: user._id,
    isActive: { $ne: false }
  })
  .populate('workspace', 'name _id')
  .lean();

  const workspaces = memberships.map((m: any) => ({
    id: m.workspace?._id,
    name: m.workspace?.name,
    role: m.role,
    isDefault: user.workspace?.toString() === m.workspace?._id.toString(),
    isActive: user.activeWorkspace?.toString() === m.workspace?._id.toString()
  }));

  return NextResponse.json({
    success: true,
    data: workspaces
  });
});

/**
 * POST /api/auth/workspaces
 * Create a new workspace for an existing user.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  await dbConnect();
  
  const { name } = await req.json();

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
  }

  // 1. Resolve Default Plan
  const defaultPlan = await Plan.findOne({ isDefault: true, isActive: true }) || await Plan.findOne({ isActive: true });

  // 2. Create Workspace
  const workspace = await Workspace.create({
    name: name.trim(),
    owner: user._id,
    plan: defaultPlan?._id,
    planId: defaultPlan?.slug || 'free',
    planLimits: defaultPlan?.limits ? {
      maxContacts: defaultPlan.limits.maxContacts || 1000,
      maxMessages: defaultPlan.limits.maxMessagesPerMonth || 5000,
      maxAutomations: defaultPlan.limits.maxAutomations || 2,
      maxTemplates: defaultPlan.limits.maxTemplates || 10,
      maxCampaigns: 50,
      maxActiveDeals: 50,
      maxPipelines: 3
    } : undefined,
    onboarding: {
      step: 'business-info',
      status: 'not-started',
      businessInfoCompleted: false,
      whatsappSetupCompleted: false,
      completed: false
    }
  });

  // 3. Create Owner Permission
  await (Permission as any).seedOwnerPermissions(workspace._id, user._id);

  // 4. Update user's active workspace to the new one
  await User.findByIdAndUpdate(user._id, { activeWorkspace: workspace._id });

  return NextResponse.json({
    success: true,
    message: "Workspace created successfully",
    data: {
      id: workspace._id,
      name: workspace.name,
      role: 'owner',
      isActive: true
    }
  });
});
