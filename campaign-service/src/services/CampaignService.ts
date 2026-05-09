import { Campaign, ICampaignDocument, Workspace, ICampaignModel } from '../models';
import { CampaignBatch } from '../models/CampaignBatch';
import { SegmentService } from './SegmentService';
import { Types } from 'mongoose';
import { getSharedRedis } from '../lib/redis';
import { monolithWorkerBridge } from '../lib/monolith-worker-client';

const redis = getSharedRedis();

export class CampaignService {
  // Lock TTL is short and only covers the start-up window. The lock is
  // released once the BullMQ job has been successfully enqueued; the worker
  // then enforces idempotency by checking for existing batches.
  private static readonly LOCK_TTL_SECONDS = 60;

  /**
   * Acquire a distributed execution lock for a campaign
   */
  static async acquireLock(campaignId: string): Promise<boolean> {
    const lockKey = `lock:campaign:exec:${campaignId}`;
    const acquired = await redis.set(lockKey, 'locked', 'EX', this.LOCK_TTL_SECONDS, 'NX');
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
   * Start a campaign execution.
   *
   * The status is intentionally NOT flipped to RUNNING here — that happens
   * inside the EventBus's `BudgetReservedEvent` handler after billing has
   * actually parked the funds. If billing fails the
   * `BudgetReservationFailedEvent` handler moves the campaign to PAUSED.
   * This avoids the race where the UI shows RUNNING but no funds are
   * reserved.
   */
  static async startCampaign(campaignId: string, workspaceId: string, userId: string): Promise<any> {
    if (!(await this.acquireLock(campaignId))) {
      throw new Error('CAMPAIGN_ALREADY_RUNNING');
    }

    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign || !campaign.canStart()) throw new Error('INVALID_CAMPAIGN_STATUS');

      const preflight = await this.runPreflight(workspaceId, campaign);
      if (!preflight.valid) throw new Error(`PREFLIGHT_FAILED: ${preflight.reason}`);

      let recipients = campaign.contacts;
      if (campaign.recipientFilter?.type === 'segment' && campaign.recipientFilter.segmentId) {
        recipients = await SegmentService.resolveSegmentContacts(workspaceId, campaign.recipientFilter.segmentId);
        campaign.contacts = recipients;
      }

      const { CampaignQueueService } = await import("../lib/campaign-queue");
      await CampaignQueueService.enqueue(campaignId, workspaceId);

      // Audit only — actual status flip is deferred to handleBudgetReserved.
      await (Campaign as ICampaignModel).addAuditEntry(campaign._id.toString(), 'STARTED', { userId });
      await campaign.save();

      return { success: true, recipientCount: recipients.length };
    } finally {
      // Release the lock regardless of outcome. BullMQ enqueue + the
      // worker's batch-existence guard prevent double execution beyond this
      // point.
      await this.releaseLock(campaignId);
    }
  }
}
