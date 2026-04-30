import { Campaign, ICampaignDocument, Workspace, ICampaignModel } from '../models';
import { CampaignBatch } from '../models/CampaignBatch';
import { SegmentService } from './SegmentService';
import { Types } from 'mongoose';
import { getSharedRedis } from '../lib/redis';
import { monolithWorkerBridge } from '../lib/monolith-worker-client';

const redis = getSharedRedis();

export class CampaignService {
  /**
   * Acquire a distributed execution lock for a campaign
   */
  static async acquireLock(campaignId: string): Promise<boolean> {
    const lockKey = `lock:campaign:exec:${campaignId}`;
    const acquired = await redis.set(lockKey, 'locked', 'EX', 1800, 'NX'); // 30 min expiry
    return acquired === 'OK';
  }

  static async releaseLock(campaignId: string): Promise<void> {
    await redis.del(`lock:campaign:exec:${campaignId}`);
  }

  /**
   * Run pre-flight safety checks (Bridged to monolith)
   */
  static async runPreflight(workspaceId: string, campaign: ICampaignDocument): Promise<{ valid: boolean; reason?: string }> {
    return await monolithWorkerBridge.preflightValidate(workspaceId, campaign.template.toString(), campaign.contacts?.length || 0);
  }

  /**
   * Start a campaign execution
   */
  static async startCampaign(campaignId: string, workspaceId: string, userId: string): Promise<any> {
    if (!(await this.acquireLock(campaignId))) {
      throw new Error('CAMPAIGN_ALREADY_RUNNING');
    }

    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign || !campaign.canStart()) throw new Error('INVALID_CAMPAIGN_STATUS');

      // 2. Preflight Guards (Bridged)
      const preflight = await this.runPreflight(workspaceId, campaign);
      if (!preflight.valid) throw new Error(`PREFLIGHT_FAILED: ${preflight.reason}`);

      // 3. Resolve Contacts if Segment-based
      let recipients = campaign.contacts;
      if (campaign.recipientFilter?.type === 'segment' && campaign.recipientFilter.segmentId) {
        recipients = await SegmentService.resolveSegmentContacts(workspaceId, campaign.recipientFilter.segmentId);
        campaign.contacts = recipients;
      }

      // 4. Trigger Job (Direct BullMQ)
      const { CampaignQueueService } = await import("../lib/campaign-queue");
      await CampaignQueueService.enqueue(campaignId, workspaceId);

      // 5. Update Status
      campaign.status = 'RUNNING';
      campaign.startedAt = new Date();
      await (Campaign as ICampaignModel).addAuditEntry(campaign._id.toString(), 'STARTED', { userId });
      await campaign.save();

      return { success: true, recipientCount: recipients.length };
    } catch (err) {
      await this.releaseLock(campaignId);
      throw err;
    }
  }
}
