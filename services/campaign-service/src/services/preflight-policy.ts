/**
 * PREFLIGHT POLICY SERVICE
 * 
 * Validates campaign readiness before execution.
 * In the microservice, this provides basic validation.
 * Full BSP/wallet checks are delegated to the monolith via internal API.
 */

import { Campaign } from '../models';
import { Types } from 'mongoose';

export const PLAN_LIMITS = {
  free: { messagesDaily: 1000, messagesMonthly: 30000, campaigns: 5 },
  basic: { messagesDaily: 10000, messagesMonthly: 300000, campaigns: 20 },
  premium: { messagesDaily: 100000, messagesMonthly: 3000000, campaigns: -1 },
  enterprise: { messagesDaily: -1, messagesMonthly: -1, campaigns: -1 },
};

export type PreflightResult = {
  valid: boolean;
  reason?: string;
  details?: any;
};

export class PreflightPolicyService {
  /**
   * Basic validation before a campaign is started
   */
  static async validate(workspaceId: string | Types.ObjectId, campaignId: string | Types.ObjectId): Promise<PreflightResult> {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return { valid: false, reason: 'CAMPAIGN_NOT_FOUND' };

    // Basic template check
    if (!campaign.template) return { valid: false, reason: 'TEMPLATE_MISSING' };

    // Basic contact check
    if (!campaign.contacts || campaign.contacts.length === 0) {
      return { valid: false, reason: 'NO_RECIPIENTS' };
    }

    return { valid: true };
  }

  /**
   * Fast check for runtime pausing
   */
  static async shouldAutoPause(workspaceId: string | Types.ObjectId, campaignId: string | Types.ObjectId): Promise<boolean> {
    const result = await this.validate(workspaceId, campaignId);
    return !result.valid;
  }
}
