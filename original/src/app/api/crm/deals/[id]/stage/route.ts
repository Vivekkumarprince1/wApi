/**
 * API: /api/commerce/deals/[id]/stage
 * Port of legacy dealController.moveStage
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Deal, Pipeline, Contact } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const PATCH = withFeature('CRM', async (req: NextRequest, { params, workspace, user }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const targetStageId = body.stageId || body.stage;

    if (!targetStageId) return NextResponse.json({ message: "Stage ID is required" }, { status: 400 });

    await dbConnect();

    // 1. Find deal and check ownership
    const deal = await Deal.findOne({ _id: id, workspace: workspace._id });
    if (!deal) return NextResponse.json({ message: "Deal not found" }, { status: 404 });

    // 2. Validate stage exists in the deal's pipeline
    const pipeline = await Pipeline.findById(deal.pipeline);
    if (!pipeline) return NextResponse.json({ message: "Pipeline not found" }, { status: 404 });

    const targetStage = pipeline.stages.find(s => s.id === targetStageId);
    if (!targetStage) return NextResponse.json({ message: "Invalid stage for this pipeline" }, { status: 400 });

    // 3. Update Deal
    const oldStage = deal.stage;
    deal.stage = targetStageId;

    // Record activity
    deal.activityLog.push({
      type: 'stage_change',
      text: `Moved from ${oldStage} to ${targetStageId}`,
      author: user._id,
      timestamp: new Date(),
      payload: { oldStage, newStage: targetStageId }
    });

    // Record stage history
    deal.stageHistory.push({
      stage: targetStageId,
      changedBy: user._id,
      timestamp: new Date()
    });

    // 4. Handle Terminal Stages (Won/Lost)
    if (targetStage.isFinal) {
      deal.closedAt = new Date();
      if (targetStageId === 'won' || targetStageId.toLowerCase().includes('won')) {
        deal.status = 'won' as any;
      } else if (targetStageId === 'lost' || targetStageId.toLowerCase().includes('lost')) {
        deal.status = 'lost' as any;
      }
      
      // Clear contact reference since deal is finished
      await Contact.updateOne(
        { _id: deal.contact },
        { $set: { activeDealId: null, activePipelineId: null } }
      );
    } else {
      // Re-enable in workspace if it was moved back from a final stage
      deal.status = 'active' as any;
      deal.closedAt = undefined;
      
      // Re-link to contact if they don't have another active deal
      await Contact.updateOne(
        { _id: deal.contact, activeDealId: null },
        { $set: { activeDealId: deal._id, activePipelineId: deal.pipeline } }
      );
    }

    await deal.save();

    // Trigger Automation Engine (Fire and Forget)
    try {
      const { AutomationClient } = await import("@/lib/services/automation/automation-client");
      AutomationClient.handleEvent({
        workspaceId: workspace._id.toString(),
        type: 'crm_deal_stage_changed',
        contactId: deal.contact.toString(),
        metadata: { 
          fromStage: oldStage, 
          toStage: targetStageId,
          dealId: deal._id.toString(),
          value: deal.value,
          currency: deal.currency
        }
      }).catch(err => console.error("[Automation Trigger Error]:", err.message));
    } catch (automationErr: any) {
      console.error("[Automation Module Import Error]:", automationErr.message);
    }

    return NextResponse.json({ 
      success: true, 
      data: deal,
      message: `Deal moved to ${targetStage.title}` 
    });
  } catch (err: any) {
    console.error("[Deal Stage Change API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
