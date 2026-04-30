/**
 * API: /api/commerce/pipelines
 * Port of legacy pipelineController.listPipelines & createPipeline
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Pipeline, Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET: List all pipelines for workspace
 * Returns default pipeline if none exists
 */
export const GET = withFeature('PIPELINE', async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();

    let pipelines = await Pipeline.find({ workspace: workspace._id }).sort({ createdAt: -1 });

    // If no pipelines exist, create the default one automatically
    if (pipelines.length === 0) {
      const defaultStages = [
        { id: 'leads', title: 'Leads', position: 0, color: '#6B7280' },
        { id: 'qualified', title: 'Qualified', position: 1, color: '#3B82F6' },
        { id: 'proposal', title: 'Proposal', position: 2, color: '#8B5CF6' },
        { id: 'won', title: 'Won', position: 3, isFinal: true, color: '#10B981' },
        { id: 'lost', title: 'Lost', position: 4, isFinal: true, color: '#EF4444' }
      ];

      const defaultPipeline = await Pipeline.create({
        workspace: workspace._id,
        name: 'Default Sales Pipeline',
        stages: defaultStages,
        isDefault: true
      });
      
      pipelines = [defaultPipeline];
    }

    return NextResponse.json({ success: true, data: pipelines });
  } catch (err: any) {
    console.error("[Pipeline List API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});

/**
 * POST: Create a new pipeline
 */
export const POST = withFeature('PIPELINE', async (req: NextRequest, { workspace }) => {
  try {
    const body = await req.json();
    const { name, description, stages, isDefault } = body;

    if (!name || !stages || !Array.isArray(stages) || stages.length === 0) {
      return NextResponse.json({ message: "Name and at least one stage are required" }, { status: 400 });
    }

    await dbConnect();

    // 1. Check plan limits
    const workspaceDoc = await Workspace.findById(workspace._id).select('planLimits');
    const maxPipelines = (workspaceDoc as any)?.planLimits?.maxPipelines || 5;
    const currentCount = await Pipeline.countDocuments({ workspace: workspace._id });

    if (currentCount >= maxPipelines) {
      return NextResponse.json({ 
        message: `Pipeline limit reached for your plan (${maxPipelines})`,
        upgrade: true 
      }, { status: 403 });
    }

    // 2. Format stages and positions
    const formattedStages = stages.map((s: any, idx: number) => ({
      ...s,
      position: idx
    }));

    // 3. Handle default toggle
    if (isDefault) {
      await Pipeline.updateMany(
        { workspace: workspace._id, isDefault: true },
        { isDefault: false }
      );
    }

    // 4. Create pipeline
    const pipeline = await Pipeline.create({
      workspace: workspace._id,
      name,
      description,
      stages: formattedStages,
      isDefault: isDefault || false
    });

    return NextResponse.json({ success: true, data: pipeline });
  } catch (err: any) {
    if (err.code === 11000) {
      return NextResponse.json({ message: "Pipeline name already exists" }, { status: 400 });
    }
    console.error("[Pipeline Create API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
