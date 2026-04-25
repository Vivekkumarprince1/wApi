/**
 * CAMPAIGN SERVICE
 * 
 * High-level orchestration for broadcasts.
 * Handles locking, retargeting, and preflight safety checks.
 */

import { Campaign, ICampaignDocument, Workspace } from "@/lib/models";
import { CampaignBatch } from "@/lib/models/campaign/CampaignBatch";
import { Message } from "@/lib/models/messaging/Message";
import { SegmentService } from "./segment-service";
import { Types } from "mongoose";
import { getSharedConnection } from '@/lib/ioredis';
import { config } from "@/lib/config";

const redis = getSharedConnection();

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
   * Run pre-flight safety checks (Credits, Quality, BSP Health)
   */
  static async runPreflight(workspaceId: string | Types.ObjectId): Promise<{ safe: boolean; reason?: string }> {
    const workspace = await Workspace.findById(workspaceId).select('wallet.balance settings').lean();
    if (!workspace) return { safe: false, reason: 'WORKSPACE_NOT_FOUND' };

    // 1. Wallet Check
    if ((workspace.wallet?.balance || 0) <= 0) {
      return { safe: false, reason: 'INSUFFICIENT_BALANCE' };
    }

    // 2. Global Kill Switch check
    if (process.env.DISABLE_BROADCASTS === 'true') {
      return { safe: false, reason: 'GLOBAL_KILL_SWITCH_ACTIVE' };
    }

    return { safe: true };
  }

  /**
   * Start a campaign execution
   */
  static async startCampaign(campaignId: string, workspaceId: string, userId: string): Promise<any> {
    // 1. Acquisition Lock
    if (!(await this.acquireLock(campaignId))) {
      throw new Error('CAMPAIGN_ALREADY_RUNNING');
    }

    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign || !campaign.canStart()) throw new Error('INVALID_CAMPAIGN_STATUS');

      // 2. Preflight Guards
      const preflight = await this.runPreflight(workspaceId);
      if (!preflight.safe) throw new Error(`PREFLIGHT_FAILED: ${preflight.reason}`);

      // 3. Resolve Contacts if Segment-based
      let recipients = campaign.contacts;
      if (campaign.recipientFilter?.type === 'segment' && campaign.recipientFilter.segmentId) {
        recipients = await SegmentService.resolveSegmentContacts(workspaceId, campaign.recipientFilter.segmentId);
        campaign.contacts = recipients;
      }

      // Trigger Job (Handled by CampaignWorker)
      const { CampaignQueueService } = await import("./campaign-queue");
      await CampaignQueueService.enqueue(campaignId, workspaceId);

      // 5. Update Status
      campaign.status = 'RUNNING';
      campaign.startedAt = new Date();
      await Campaign.addAuditEntry(campaign._id as Types.ObjectId, 'STARTED', { userId });
      await campaign.save();

      return { success: true, recipientCount: recipients.length };
    } catch (err) {
      await this.releaseLock(campaignId);
      throw err;
    }
  }

  /**
   * Create a retargeting campaign for non-responders
   */
  static async retargetCampaign(
    parentCampaignId: string, 
    workspaceId: string, 
    userId: string, 
    type: 'NON_READ' | 'NON_REPLY'
  ): Promise<ICampaignDocument> {
    const parent = await Campaign.findById(parentCampaignId);
    if (!parent) throw new Error('PARENT_CAMPAIGN_NOT_FOUND');

    // Identify targets (Parity with legacy query)
    const query: any = { workspace: workspaceId, campaign: parentCampaignId };
    if (type === 'NON_READ') {
      query.status = { $ne: 'read' };
    }

    // Find contact IDs who received but didn't read/reply
    // In our simplified model, we check Conversation or Message status
    const targets = await Message.find({
        workspace: workspaceId,
        'meta.campaignId': parentCampaignId,
        direction: 'outbound',
        status: type === 'NON_READ' ? { $ne: 'read' } : { $exists: true }
    }).distinct('contact');

    if (targets.length === 0) throw new Error('NO_TARGETS_FOUND');

    // Create Cloned Draft
    const retarget = await Campaign.create({
      workspace: workspaceId,
      name: `🎯 Retarget: ${parent.name} (${type})`,
      template: parent.template,
      templateSnapshot: parent.templateSnapshot,
      variableMapping: parent.variableMapping,
      contacts: targets,
      campaignType: 'one-time',
      status: 'DRAFT',
      createdBy: userId,
      totals: { totalRecipients: targets.length }
    });

    await Campaign.addAuditEntry(parent._id as Types.ObjectId, 'RETARGETED', { userId, reason: type });

    return retarget;
  }
}
