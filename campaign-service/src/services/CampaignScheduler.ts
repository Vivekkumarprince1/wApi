import { Campaign } from '../models';
import { CampaignQueueService } from '../lib/campaign-queue';
import { CampaignService } from './CampaignService';

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
          (campaign.createdBy as any)?.toString() || 'SYSTEM'
        );

        await CampaignQueueService.enqueue(
          campaign._id.toString(),
          campaign.workspace.toString()
        );

      } catch (err: any) {
        console.error(`[Scheduler] Failed to start campaign ${campaign._id}:`, err.message);
        campaign.status = 'FAILED';
        await campaign.save();
      }
    }

    return campaigns.length;
  }
}
