/**
 * CAMPAIGN SCHEDULER
 * 
 * Handles execution of campaigns at a future timestamp.
 */

import { Campaign, ICampaignModel } from '../models';
import { CampaignBatch } from '../models/CampaignBatch';
import { CampaignService } from './campaign-service';

export class CampaignScheduler {
  /**
   * Scan for campaigns that should have started by now
   */
  static async processScheduledCampaigns(): Promise<number> {
    const now = new Date();
    const campaigns = await Campaign.find({
      status: 'SCHEDULED',
      scheduledAt: { $lte: now }
    });

    for (const campaign of campaigns) {
      try {
        console.log(`[Scheduler] ⏰ Triggering scheduled campaign: ${campaign.name} (${campaign._id})`);
        
        await CampaignService.startCampaign(
          campaign._id.toString(),
          campaign.workspace.toString(),
          campaign.createdBy?.toString() || 'SYSTEM'
        );
      } catch (err: any) {
        console.error(`[Scheduler] Failed to start campaign ${campaign._id}:`, err.message);
        campaign.status = 'FAILED';
        await campaign.save();
        await (Campaign as ICampaignModel).addAuditEntry(campaign._id.toString(), 'FAILED', { reason: `Scheduled start failed: ${err.message}` });
      }
    }

    return campaigns.length;
  }

  /**
   * Scan for campaigns stuck in 'RUNNING' state with no active progress
   */
  static async processStalledCampaigns(): Promise<number> {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    const stalled = await Campaign.find({
      status: 'RUNNING',
      updatedAt: { $lte: fourHoursAgo }
    });

    for (const campaign of stalled) {
      try {
        console.warn(`[Scheduler] ⚠️ Detected stalled campaign: ${campaign.name} (${campaign._id})`);
        
        const pendingCount = await CampaignBatch.countDocuments({
          campaign: campaign._id,
          status: { $in: ['PENDING', 'PROCESSING'] }
        });

        if (pendingCount === 0) {
          campaign.status = 'COMPLETED';
          await campaign.save();
          await (Campaign as ICampaignModel).addAuditEntry(campaign._id.toString(), 'SYSTEM_RECOVERED', { reason: 'No pending batches found after stall check' });
        } else {
          campaign.status = 'PAUSED';
          await campaign.save();
          await (Campaign as ICampaignModel).addAuditEntry(campaign._id.toString(), 'SYSTEM_PAUSED', { reason: 'Stalled with pending batches. User review required.' });
        }
      } catch (err: any) {
        console.error(`[Scheduler] Failed recovery for campaign ${campaign._id}:`, err.message);
      }
    }

    return stalled.length;
  }
}
