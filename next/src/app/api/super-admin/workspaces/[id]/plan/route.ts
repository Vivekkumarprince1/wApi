import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Workspace, Plan } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * PATCH /api/super-admin/workspaces/[id]/plan
 * Manually update workspace plan (Admin only)
 */
export const PATCH = withRole(['super_admin'], async (req: NextRequest, { params, user: adminUser }) => {
  await dbConnect();
  
  const { id: workspaceId } = await params;
  const { planId } = await req.json();

  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  // 1. Verify Plan exists
  const plan = await Plan.findById(planId);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // 2. Update Workspace
  const workspace = await Workspace.findByIdAndUpdate(
    workspaceId,
    { plan: planId },
    { returnDocument: 'after' }
  );

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // 3. Log the action (Audit Trail)
  console.log(`[Admin Audit] Admin ${adminUser.email} updated Workspace ${workspace.name} to Plan ${plan.name}`);

  return NextResponse.json({
    success: true,
    message: `Plan updated to ${plan.name}`,
    data: {
      workspaceId: workspace._id,
      planName: plan.name
    }
  });
}) as any;
