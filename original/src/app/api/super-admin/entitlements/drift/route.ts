import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db-connect';
import { withRole } from '@/lib/middlewares/auth';
import { Plan, Workspace } from '@/lib/models';

export const GET = withRole(['super_admin'], async (_req: NextRequest) => {
  try {
    await dbConnect();

    const [plans, workspaces] = await Promise.all([
      Plan.find({}).select('name slug features limits isActive').lean(),
      Workspace.find({}).populate('plan', 'name slug features limits').select('name plan createdAt updatedAt').lean(),
    ]);

    const planMap = new Map(plans.map((plan: any) => [String(plan._id), plan]));

    const drift = workspaces.map((workspace: any) => {
      const planId = workspace.plan?._id ? String(workspace.plan._id) : String(workspace.plan || '');
      const plan = workspace.plan?._id ? workspace.plan : planMap.get(planId) || null;
      const expectedFeatures = Array.isArray(plan?.features) ? plan.features : [];
      const currentFeatures = Array.isArray(workspace.plan?.features) ? workspace.plan.features : [];
      const missingFeatures = expectedFeatures.filter((feature: string) => !currentFeatures.includes(feature));
      const extraFeatures = currentFeatures.filter((feature: string) => !expectedFeatures.includes(feature));

      return {
        workspaceId: String(workspace._id),
        workspaceName: workspace.name,
        planName: plan?.name || 'Unassigned',
        missingFeatures,
        extraFeatures,
        driftScore: missingFeatures.length + extraFeatures.length,
      };
    });

    return NextResponse.json({
      success: true,
      data: drift.filter((entry) => entry.driftScore > 0),
      summary: {
        scanned: drift.length,
        drifted: drift.filter((entry) => entry.driftScore > 0).length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'Failed to scan entitlement drift', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}) as any;
