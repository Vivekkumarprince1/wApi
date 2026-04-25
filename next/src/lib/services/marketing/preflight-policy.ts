import { Workspace, Template, Campaign, Contact, ITemplate } from "@/lib/models";
import { PricingService } from "../billing/pricing-service";
import dbConnect from "@/lib/db-connect";
import { Types } from "mongoose";

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
   * Comprehensive validation before a campaign is queued or started
   */
  static async validate(workspaceId: string | Types.ObjectId, campaignId: string | Types.ObjectId): Promise<PreflightResult> {
    await dbConnect();

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return { valid: false, reason: 'WORKSPACE_NOT_FOUND' };

    const campaign = await Campaign.findById(campaignId).populate('template');
    if (!campaign) return { valid: false, reason: 'CAMPAIGN_NOT_FOUND' };

    const template = campaign.template as unknown as ITemplate;
    if (!template) return { valid: false, reason: 'TEMPLATE_MISSING' };

    // 1. Connection Health
    const isConnected = workspace.esbFlow?.status === 'completed' && !!workspace.phoneNumberId;
    if (!isConnected) {
      return { valid: false, reason: 'WHATSAPP_DISCONNECTED', details: 'WABA connection is required to send campaigns.' };
    }

    // 2. Token Expiry (Modern parity)
    if (workspace.esbFlow?.tokenExpiry) {
      if (new Date() > new Date(workspace.esbFlow.tokenExpiry)) {
        return { valid: false, reason: 'TOKEN_EXPIRED', details: 'System access token has expired. Please refresh connection.' };
      }
    }

    // 3. Template Status
    if (template.status !== 'APPROVED') {
      return { valid: false, reason: 'TEMPLATE_NOT_APPROVED', details: `Template status is ${template.status}. Only APPROVED templates can be used.` };
    }

    // 4. Wallet Balance (Dynamic with PricingService)
    const category = PricingService.resolveCategory(template.category || 'MARKETING');
    const costPerMsg = await PricingService.getCost(workspaceId, category);
    const estimatedCost = (campaign.contacts?.length || 0) * costPerMsg;

    const availableBalance = workspace.walletBalance || 0;

    if (availableBalance < estimatedCost) {
      return { 
        valid: false, 
        reason: 'INSUFFICIENT_FUNDS', 
        details: {
          required: estimatedCost,
          available: availableBalance
        } 
      };
    }

    // 5. Plan Limits
    const plan = (workspace.planId || 'free') as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    if (limits.messagesDaily !== -1) {
      const dailyUsage = workspace.usage?.messagesSentToday || 0;
      if (dailyUsage + campaign.totalContacts > limits.messagesDaily) {
        return { valid: false, reason: 'DAILY_LIMIT_EXCEEDED', details: { limit: limits.messagesDaily, current: dailyUsage } };
      }
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
