/**
 * CAMPAIGN SCHEDULER
 * 
 * Handles execution of campaigns at a future timestamp.
 */

import { Campaign } from "@/lib/models";
import { CampaignQueueService } from "./campaign-queue";
import { CampaignService } from "./campaign-service";
import dbConnect from "@/lib/db-connect";

export class CampaignScheduler {
  /**
   * Scan for campaigns that should have started by now
   * (Used as a fallback/cron job)
   */
  static async processScheduledCampaigns(): Promise<number> {
    await dbConnect();
    
    const now = new Date();
    const campaigns = await Campaign.find({
      status: 'SCHEDULED',
      scheduledAt: { $lte: now }
    });

    for (const campaign of campaigns) {
      try {
        console.log(`[Scheduler] ⏰ Triggering scheduled campaign: ${campaign.name} (${campaign._id})`);
        
        // Use CampaignService to start properly (with locking/preflight)
        await CampaignService.startCampaign(
          campaign._id.toString(),
          campaign.workspace.toString(),
          campaign.createdBy?.toString() || 'SYSTEM'
        );

        // Enqueue initialization job
        await CampaignQueueService.enqueue(
          campaign._id.toString(),
          campaign.workspace.toString()
        );

      } catch (err: any) {
        console.error(`[Scheduler] Failed to start campaign ${campaign._id}:`, err.message);
        campaign.status = 'FAILED';
        await campaign.save();
        await (Campaign as any).addAuditEntry(campaign._id.toString(), 'FAILED', { reason: `Scheduled start failed: ${err.message}` });
      }
    }

    return campaigns.length;
  }


  /**
   * Scan for campaigns stuck in 'RUNNING' state with no active progress
   * (Self-healing for server crashes)
   */
  static async processStalledCampaigns(): Promise<number> {
    await dbConnect();
    
    // Find campaigns that have been RUNNING for more than 4 hours 
    // without any recent updates or batches
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    const stalled = await Campaign.find({
      status: 'RUNNING',
      updatedAt: { $lte: fourHoursAgo }
    });

    for (const campaign of stalled) {
      try {
        console.warn(`[Scheduler] ⚠️ Detected stalled campaign: ${campaign.name} (${campaign._id})`);
        
        // Check if there are truly no pending batches
        const { CampaignBatch } = await import("@/lib/models/campaign/CampaignBatch");
        const pendingCount = await CampaignBatch.countDocuments({
          campaign: campaign._id,
          status: { $in: ['pending', 'processing'] }
        });

        if (pendingCount === 0) {
           console.log(`[Scheduler] 🔄 No pending batches for ${campaign._id}. Marking as COMPLETED with warnings.`);
           campaign.status = 'COMPLETED';
           await campaign.save();
           await (Campaign as any).addAuditEntry(campaign._id.toString(), 'SYSTEM_RECOVERED', { reason: 'No pending batches found after stall check' });
        } else {
           // If there ARE pending batches, we might need a manual intervention or automated re-enqueue
           // For now, we'll mark as PAUSED so the user can review
           campaign.status = 'PAUSED';
           await campaign.save();
           await (Campaign as any).addAuditEntry(campaign._id.toString(), 'SYSTEM_PAUSED', { reason: 'Stalled with pending batches. User review required.' });
        }
      } catch (err: any) {
        console.error(`[Scheduler] Failed recovery for campaign ${campaign._id}:`, err.message);
      }
    }

    return stalled.length;
  }
}
