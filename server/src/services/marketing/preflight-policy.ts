import { Workspace, Template, Contact, ITemplate } from "@/models";
import dbConnect from "@/db-connect";
import { Types } from "mongoose";
import { config } from "@/config";

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
  static async validate(workspaceId: string | Types.ObjectId, templateId: string | Types.ObjectId, contactsCount: number): Promise<PreflightResult> {
    await dbConnect();

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return { valid: false, reason: 'WORKSPACE_NOT_FOUND' };

    const template = await Template.findById(templateId);
    if (!template) return { valid: false, reason: 'TEMPLATE_MISSING' };

    // 1. Connection Health
    const isConnected = workspace.esbFlow?.status === 'completed' && !!workspace.phoneNumberId;
    if (!isConnected) {
      return { valid: false, reason: 'WHATSAPP_DISCONNECTED', details: 'WABA connection is required to send campaigns.' };
    }

    // 2. Template Status
    if (template.status !== 'APPROVED') {
      return { valid: false, reason: 'TEMPLATE_NOT_APPROVED', details: `Template status is ${template.status}. Only APPROVED templates can be used.` };
    }

    // 4. Wallet Balance & Status (Fetch from Billing Service)
    const BILLING_SERVICE_URL = config.billingServiceUrl;
    const axios = (await import('axios')).default;
    const billingHeaders = {
      'x-internal-service-secret': config.internalServiceSecret,
      'x-workspace-id': workspaceId.toString(),
    };
    
    const billingResponse = await axios.get(`${BILLING_SERVICE_URL}/api/billing/wallets/${workspaceId}/details`, {
      headers: billingHeaders,
    });
    const { workspace: billingData } = billingResponse.data;
    const walletResponse = await axios.get(`${BILLING_SERVICE_URL}/api/billing/wallets/${workspaceId}`, {
      headers: billingHeaders,
    });
    const { wallet: walletData } = walletResponse.data;

    if (billingData.billingStatus === 'suspended' || billingData.billingStatus === 'canceled') {
        return { valid: false, reason: 'BILLING_ACCOUNT_INACTIVE', details: `Account status is ${billingData.billingStatus}` };
    }

    const pricingResponse = await axios.get(`${BILLING_SERVICE_URL}/api/billing/wallets/${workspaceId}/pricing`, {
      headers: billingHeaders,
      params: { category: template.category || 'MARKETING' }
    });
    const costPerMsg = pricingResponse.data.cost;
    const estimatedCost = contactsCount * costPerMsg;


    const availableBalance = walletData?.availableBalance || 0;

    if (availableBalance < estimatedCost) {
      return { 
        valid: false, 
        reason: 'INSUFFICIENT_FUNDS', 
        details: {
          required: estimatedCost / 100,
          available: availableBalance / 100
        } 
      };
    }


    // 5. Plan Limits
    const plan = (billingData.planSlug || 'free') as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;


    if (limits.messagesDaily !== -1) {
      const dailyUsage = workspace.usage?.messagesSentToday || 0;
      if (dailyUsage + contactsCount > limits.messagesDaily) {
        return { valid: false, reason: 'DAILY_LIMIT_EXCEEDED', details: { limit: limits.messagesDaily, current: dailyUsage } };
      }
    }

    return { valid: true };
  }

  /**
   * Fast check for runtime pausing
   */
  static async shouldAutoPause(workspaceId: string | Types.ObjectId, templateId: string | Types.ObjectId, contactsCount: number): Promise<boolean> {
    const result = await this.validate(workspaceId, templateId, contactsCount);
    return !result.valid;
  }
}
