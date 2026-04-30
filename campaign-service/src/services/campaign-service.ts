/**
 * CAMPAIGN SERVICE
 * 
 * High-level orchestration for broadcasts.
 * Handles locking, retargeting, and preflight safety checks.
 */

import { Campaign, ICampaignModel } from '../models';
import { CampaignBatch } from '../models/CampaignBatch';
import { SegmentService } from './segment-service';
import { Types } from 'mongoose';

export class CampaignService {
  /**
   * Start a campaign execution
   */
  static async startCampaign(campaignId: string, workspaceId: string, userId: string): Promise<any> {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign || !campaign.canStart()) throw new Error('INVALID_CAMPAIGN_STATUS');

    // Resolve Contacts if Segment-based
    let recipients = campaign.contacts;
    if (campaign.recipientFilter?.type === 'segment' && campaign.recipientFilter.segmentId) {
      recipients = await SegmentService.resolveSegmentContacts(workspaceId, campaign.recipientFilter.segmentId);
      campaign.contacts = recipients;
    }

    // Update Status
    campaign.status = 'RUNNING';
    campaign.startedAt = new Date();
    await (Campaign as ICampaignModel).addAuditEntry(campaign._id as Types.ObjectId, 'STARTED', { userId });
    await campaign.save();

    return { success: true, recipientCount: recipients.length };
  }

  /**
   * Create a retargeting campaign for non-responders
   */
  static async retargetCampaign(
    parentCampaignId: string,
    workspaceId: string,
    userId: string,
    type: 'NON_READ' | 'NON_REPLY'
  ) {
    const parent = await Campaign.findById(parentCampaignId);
    if (!parent) throw new Error('PARENT_CAMPAIGN_NOT_FOUND');

    const { CampaignMessage } = await import('../models/CampaignMessage');
    const targets = await CampaignMessage.find({
      campaign: parentCampaignId,
      workspace: workspaceId,
      status: type === 'NON_READ' ? { $ne: 'read' } : { $exists: true }
    }).distinct('contact');

    if (targets.length === 0) throw new Error('NO_TARGETS_FOUND');

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

    await (Campaign as ICampaignModel).addAuditEntry(parent._id as Types.ObjectId, 'RETARGETED', { userId, reason: type });
    return retarget;
  }
}
