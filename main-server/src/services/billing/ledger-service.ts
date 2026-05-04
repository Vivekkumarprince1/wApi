import { Types } from "mongoose";
import { proxyController } from "../../controllers/proxyController";

/**
 * MONOLITH LEDGER SERVICE
 * Proxies financial operations to the Billing Microservice.
 * Parity with legacy direct DB access.
 */
export class LedgerService {
  /**
   * Deduct credits (SPEND) via Billing Service
   */
  static async deduct(
    workspaceId: string | Types.ObjectId, 
    amountPaise: number, 
    metadata: { 
      description: string;
      referenceId?: string; 
      type?: string;
      referenceType?: string;
    }
  ): Promise<{ success: boolean; newBalance: number }> {
    const response = await proxyController.forwardToService('billing', {
      method: 'POST',
      path: `/api/billing/wallets/${workspaceId}/deduct`,
      data: {
        amount: amountPaise,
        description: metadata.description,
        externalReferenceId: metadata.referenceId,
        type: metadata.type,
        referenceType: metadata.referenceType
      }
    });

    if (response.status !== 200) {
      throw new Error(response.data?.error || "Billing Service Error");
    }

    return { success: true, newBalance: response.data.wallet.availableBalance };
  }

  /**
   * Credit funds via Billing Service
   */
  static async credit(
    workspaceId: string | Types.ObjectId,
    amountPaise: number,
    metadata: {
      description: string;
      externalReferenceId?: string;
      type?: string;
      referenceType?: string;
    }
  ): Promise<{ success: boolean; newBalance: number }> {
    const response = await proxyController.forwardToService('billing', {
      method: 'POST',
      path: `/api/billing/wallets/${workspaceId}/add-funds`,
      data: {
        amount: amountPaise,
        description: metadata.description,
        externalReferenceId: metadata.externalReferenceId,
        type: metadata.type,
        referenceType: metadata.referenceType
      }
    });

    if (response.status !== 200) {
      throw new Error(response.data?.error || "Billing Service Error");
    }

    return { success: true, newBalance: response.data.wallet.availableBalance };
  }

  /**
   * Reserve budget for a campaign via Billing Service
   */
  static async reserveCampaignBudget(
    workspaceId: string | Types.ObjectId,
    amountPaise: number,
    campaignId: string | Types.ObjectId
  ): Promise<boolean> {
    const response = await proxyController.forwardToService('billing', {
      method: 'POST',
      path: `/api/billing/wallets/${workspaceId}/reserve`,
      data: {
        amount: amountPaise,
        campaignId: campaignId.toString()
      }
    });

    if (response.status !== 200) {
      throw new Error(response.data?.error || "Billing Service Error");
    }

    return true;
  }

  /**
   * Settle (finalize) campaign budget via Billing Service
   */
  static async settleCampaignBudget(
    workspaceId: string | Types.ObjectId,
    campaignId: string | Types.ObjectId,
    reservedAmount: number,
    actualSpend: number
  ): Promise<boolean> {
    const response = await proxyController.forwardToService('billing', {
      method: 'POST',
      path: `/api/billing/wallets/${workspaceId}/settle`,
      data: {
        campaignId: campaignId.toString(),
        reservedAmount,
        actualSpend
      }
    });

    if (response.status !== 200) {
      throw new Error(response.data?.error || "Billing Service Error");
    }

    return true;
  }

  /**
   * Get global billing stats (Admin)
   */
  static async getGlobalStats(): Promise<{ grossRevenue: number; totalTransactions: number }> {
    const response = await proxyController.forwardToService('billing', {
      method: 'GET',
      path: '/api/billing/wallets/admin/stats'
    });
    if (response.status !== 200) {
      return { grossRevenue: 0, totalTransactions: 0 };
    }
    return response.data.stats || { grossRevenue: 0, totalTransactions: 0 };
  }
}
