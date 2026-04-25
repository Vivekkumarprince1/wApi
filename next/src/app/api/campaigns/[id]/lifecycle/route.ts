/**
 * API: /api/campaigns/[id]/lifecycle
 * Handles starting, pausing, and resuming campaigns.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Campaign } from "@/lib/models";
import { enqueueCampaign, pauseCampaignQueue } from "@/lib/services/marketing/campaign-queue";
import { LedgerService } from "@/lib/services/billing/ledger-service";
import { broadcastToWorkspace } from "@/lib/services/socket-emitter";
import dbConnect from "@/lib/db-connect";

export const POST = withAuth(async (req: NextRequest, { params, workspace, user }) => {
  try {
    const { id } = params;
    const { action } = await req.json();

    await dbConnect();

    console.log("RUNNING LIFECYCLE ACTION", { id, action, workspaceId: workspace?._id?.toString() });

    const campaign = await Campaign.findOne({ _id: id, workspace: workspace._id }).populate('template');
    if (!campaign) {
      return NextResponse.json({ message: "Campaign not found" }, { status: 404 });
    }

      if (action === 'start' || action === 'resume') {
        const isResume = campaign.status === 'PAUSED';

        // Deep Audit: Template Status Verification
        const template = campaign.template as any;
        if (action === 'start' && (!template || template.status !== 'APPROVED')) {
          return NextResponse.json({ 
            success: false, 
            message: `Template "${template?.name || 'Unknown'}" is ${template?.status || 'Missing'}. Campaigns can only be launched with APPROVED templates.`
          }, { status: 400 });
        }

        if (!isResume && !['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
        return NextResponse.json({ message: `Cannot start campaign in ${campaign.status} status` }, { status: 400 });
      }

      if (action === 'resume' && campaign.status !== 'PAUSED') {
        return NextResponse.json({ message: "Only paused campaigns can be resumed" }, { status: 400 });
      }

      if (!isResume) {
        try {
          const { PricingService } = await import("@/lib/services/billing/pricing-service");
          const category = PricingService.resolveCategory((campaign.template as any)?.category || 'MARKETING');
          const costPerMsg = await PricingService.getCost(workspace._id, category);
          const totalReservation = campaign.totalContacts * costPerMsg;

          await LedgerService.ensureWalletBalance(workspace._id, totalReservation);
        } catch (err: any) {
          if (err.message === 'INSUFFICIENT_BALANCE') {
            return NextResponse.json({ 
              success: false, 
              message: "Insufficient wallet balance to start this campaign.",
              details: err.details 
            }, { status: 402 });
          }
          throw err;
        }

        await enqueueCampaign(id, workspace._id.toString());
      }

      const now = new Date();
      campaign.status = "RUNNING";
      campaign.startedAt = campaign.startedAt || now;
      campaign.pausedAt = null;
      campaign.pausedReason = null;
      campaign.execution.startedBy = campaign.execution.startedBy || user?._id;
      campaign.execution.lastResumedAt = isResume ? now : campaign.execution.lastResumedAt;
      campaign.execution.resumedBy = isResume ? user?._id : campaign.execution.resumedBy;
      campaign.execution.resumeCount = isResume ? (campaign.execution.resumeCount || 0) + 1 : campaign.execution.resumeCount;
      campaign.audit.startedAt = campaign.audit.startedAt || now;
      campaign.audit.startedBy = campaign.audit.startedBy || user?._id;
      campaign.audit.resumedAt = isResume ? now : campaign.audit.resumedAt;
      campaign.audit.resumedBy = isResume ? user?._id : campaign.audit.resumedBy;

      await Campaign.addAuditEntry(id, isResume ? 'RESUMED' : 'STARTED', {
        userId: user?._id,
        reason: isResume ? 'Campaign resumed via lifecycle action' : 'Campaign started via lifecycle action',
        meta: {
          action,
          campaignStatus: campaign.status,
        }
      });

      await campaign.save();

      broadcastToWorkspace(workspace._id.toString(), 'campaign:status_update', {
        campaignId: id,
        status: 'RUNNING',
        action: isResume ? 'RESUMED' : 'STARTED',
        updatedAt: campaign.updatedAt,
        startedAt: campaign.startedAt,
        resumeCount: campaign.execution.resumeCount,
        totals: campaign.totals,
        batching: campaign.batching,
      });

      return NextResponse.json({
        success: true,
        message: isResume ? "Campaign resumed successfully" : "Campaign started successfully",
        data: { status: 'RUNNING' }
      });
    }

    if (action === 'pause') {
      if (campaign.status !== 'RUNNING') {
        return NextResponse.json({ message: "Only running campaigns can be paused" }, { status: 400 });
      }

      await pauseCampaignQueue(id);
      
      campaign.status = "PAUSED";
      campaign.pausedReason = 'USER_PAUSED';
      campaign.pausedAt = new Date();
      campaign.audit.pausedAt = campaign.pausedAt;
      campaign.audit.pausedBy = user?._id;
      campaign.execution.pausedBy = user?._id;

      await Campaign.addAuditEntry(id, 'PAUSED', {
        userId: user?._id,
        reason: 'Campaign paused via lifecycle action',
        meta: { action: 'pause' }
      });

      await campaign.save();

      broadcastToWorkspace(workspace._id.toString(), 'campaign:status_update', {
        campaignId: id,
        status: 'PAUSED',
        action: 'PAUSED',
        updatedAt: campaign.updatedAt,
        pausedAt: campaign.pausedAt,
        pausedReason: campaign.pausedReason,
        totals: campaign.totals,
        batching: campaign.batching,
      });

      return NextResponse.json({
        success: true,
        message: "Campaign paused successfully",
        data: { status: 'PAUSED' }
      });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[Campaign Lifecycle API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
