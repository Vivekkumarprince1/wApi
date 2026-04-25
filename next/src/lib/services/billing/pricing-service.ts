/**
 * PRICING SERVICE
 * 
 * Logic for calculating conversation costs based on Meta categories.
 */

import { Plan } from "@/lib/models/auth/Plan";
import { Workspace } from "@/lib/models/workspace/Workspace";
import { Types } from "mongoose";

export type ConversationCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE';

export class PricingService {
  /**
   * Resolve Meta template category to billing category
   */
  static resolveCategory(templateCategory: string): ConversationCategory {
    const cat = templateCategory?.toUpperCase().trim();
    if (cat === 'MARKETING' || cat === 'PROMOTIONAL') return 'MARKETING';
    if (cat === 'UTILITY' || cat === 'TRANSACTIONAL') return 'UTILITY';
    if (cat === 'AUTHENTICATION' || cat === 'OTP') return 'AUTHENTICATION';
    return 'UTILITY';
  }

  /**
   * Get the cost for a specific category based on workspace plan
   */
  static async getCost(workspaceId: string | Types.ObjectId, category: ConversationCategory): Promise<number> {
    const workspace = await Workspace.findById(workspaceId).select('plan').lean();
    if (!workspace) return 0;

    const planId = workspace.plan;
    const plan = await Plan.findById(planId).lean();
    if (!plan) return 0;

    // Use fixedPricePaise from the Plan model
    switch (category) {
      case 'MARKETING': return plan.fixedPricePaise?.marketing || 80;
      case 'UTILITY': return plan.fixedPricePaise?.utility || 40;
      case 'AUTHENTICATION': return plan.fixedPricePaise?.authentication || 30;
      case 'SERVICE': return plan.fixedPricePaise?.service || 0;
      default: return 40;
    }
  }
}
