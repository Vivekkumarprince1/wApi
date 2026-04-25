/**
 * API: /api/commerce/deals
 * Port of legacy dealController.listDeals & createDeal
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Deal, Pipeline, Contact, Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET: List deals for workspace with filtering
 */
export const GET = withFeature('CRM', async (req: NextRequest, { workspace }) => {
  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage");
    const pipelineId = searchParams.get("pipelineId");
    const status = searchParams.get("status") || "active";
    const assignedAgent = searchParams.get("assignedAgent");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    await dbConnect();

    const query: any = { workspace: workspace._id };
    if (stage) query.stage = stage;
    if (pipelineId) query.pipeline = pipelineId;
    if (status) query.status = status;
    if (assignedAgent) query.assignedAgent = assignedAgent;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const total = await Deal.countDocuments(query);
    const deals = await Deal.find(query)
      .populate('contact', 'name phone')
      .populate('pipeline', 'name')
      .populate('assignedAgent', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    return NextResponse.json({
      success: true,
      data: deals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    console.error("[Deal List API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});

/**
 * POST: Create a new deal for a contact in a pipeline
 */
export const POST = withFeature('CRM', async (req: NextRequest, { workspace, user }) => {
  try {
    const body = await req.json();
    const { contactId, pipelineId, title, value, currency, priority } = body;

    if (!contactId || !pipelineId) {
      return NextResponse.json({ message: "Contact and Pipeline are required" }, { status: 400 });
    }

    await dbConnect();

    // 1. Check plan limits
    const workspaceDoc = await Workspace.findById(workspace._id).select("planLimits");
    const maxActiveDeals = (workspaceDoc as any)?.planLimits?.maxActiveDeals || 50;
    const currentActive = await Deal.countDocuments({ workspace: workspace._id, status: "active" });

    if (currentActive >= maxActiveDeals) {
      return NextResponse.json({ 
        message: `Active deal limit reached (${maxActiveDeals})`,
        upgrade: true 
      }, { status: 403 });
    }

    // 2. Validate contact and pipeline
    const [contact, pipeline] = await Promise.all([
      Contact.findOne({ _id: contactId, workspace: workspace._id }),
      Pipeline.findOne({ _id: pipelineId, workspace: workspace._id })
    ]);

    if (!contact) return NextResponse.json({ message: "Contact not found" }, { status: 404 });
    if (!pipeline) return NextResponse.json({ message: "Pipeline not found" }, { status: 404 });

    // 3. Get entry stage
    const entryStage = pipeline.stages.sort((a, b) => a.position - b.position)[0];
    if (!entryStage) return NextResponse.json({ message: "Pipeline has no stages" }, { status: 400 });

    // 4. Create deal
    const deal = await Deal.create({
      workspace: workspace._id,
      contact: contactId,
      pipeline: pipelineId,
      title: title || `${contact.name || contact.phone}`,
      value: value || 0,
      currency: currency || "USD",
      stage: entryStage.id,
      assignedAgent: user._id,
      priority: priority || "medium",
      status: "active",
      activityLog: [{
        type: "created",
        text: `Deal created in stage: ${entryStage.title}`,
        author: user._id,
        timestamp: new Date()
      }],
      stageHistory: [{
        stage: entryStage.id,
        changedBy: user._id,
        timestamp: new Date()
      }]
    });

    // 5. Sync contact
    await Contact.updateOne(
      { _id: contactId },
      { 
        $set: { 
          activeDealId: deal._id,
          activePipelineId: pipelineId,
          assignedAgentId: user._id 
        } 
      }
    );

    return NextResponse.json({ success: true, data: deal });
  } catch (err: any) {
    console.error("[Deal Create API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
