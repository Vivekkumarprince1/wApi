import { PlanModel, WorkspaceModel } from "../models";
import { Types } from "mongoose";

export type ConversationCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE';

export class PricingService {
  static resolveCategory(templateCategory: string): ConversationCategory {
    const cat = templateCategory?.toUpperCase().trim();
    if (cat === 'MARKETING' || cat === 'PROMOTIONAL') return 'MARKETING';
    if (cat === 'UTILITY' || cat === 'TRANSACTIONAL') return 'UTILITY';
    if (cat === 'AUTHENTICATION' || cat === 'OTP') return 'AUTHENTICATION';
    return 'UTILITY';
  }

  static async getCost(workspaceId: string, category: ConversationCategory): Promise<number> {
    const workspace = await WorkspaceModel.findById(workspaceId).select('planId').lean();
    
    // Fallback if Workspace not found in billing DB (e.g. hasn't been synced yet)
    let planId = (workspace as any)?.planId;
    
    // If we don't have the workspace, we try to find the default plan
    if (!planId) {
        const defaultPlan = await PlanModel.findOne({ isDefault: true }).lean();
        planId = defaultPlan?._id;
    }

    if (!planId) return 40; // Hard default

    const plan = Types.ObjectId.isValid(String(planId))
      ? await PlanModel.findById(planId).lean()
      : await PlanModel.findOne({
          $or: [
            { slug: String(planId) },
            { code: String(planId) },
            { name: String(planId) }
          ]
        }).lean();
    if (!plan) return 40;

    switch (category) {
      case 'MARKETING': return (plan as any).fixedPricePaise?.marketing || 80;
      case 'UTILITY': return (plan as any).fixedPricePaise?.utility || 40;
      case 'AUTHENTICATION': return (plan as any).fixedPricePaise?.authentication || 30;
      case 'SERVICE': return (plan as any).fixedPricePaise?.service || 0;
      default: return 40;
    }
  }

  /**
   * Per-conversation-category price map (in paise) for a workspace's plan.
   * Used by the direct-template send modal to estimate cost before sending.
   */
  static async getPricingMap(workspaceId: string): Promise<Record<ConversationCategory, number>> {
    const categories: ConversationCategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'];
    const entries = await Promise.all(
      categories.map(async (c) => [c, await this.getCost(workspaceId, c)] as const)
    );
    return Object.fromEntries(entries) as Record<ConversationCategory, number>;
  }
}
