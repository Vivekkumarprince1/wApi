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
    const workspace = await WorkspaceModel.findById(workspaceId).select('plan planId').lean();
    
    let planId = (workspace as any)?.plan;
    
    if (!planId && (workspace as any)?.planId) {
      const planBySlug = await PlanModel.findOne({ slug: (workspace as any).planId }).lean();
      if (planBySlug) {
        planId = planBySlug._id;
      }
    }
    
    // Fallback if Workspace/plan not found in billing DB (e.g. hasn't been synced yet)
    if (!planId) {
        const defaultPlan = await PlanModel.findOne({ isDefault: true }).lean();
        planId = defaultPlan?._id;
    }

    if (!planId) return 40; // Hard default

    const plan = await PlanModel.findById(planId).lean();
    if (!plan) return 40;

    switch (category) {
      case 'MARKETING': return (plan as any).fixedPricePaise?.marketing || 80;
      case 'UTILITY': return (plan as any).fixedPricePaise?.utility || 40;
      case 'AUTHENTICATION': return (plan as any).fixedPricePaise?.authentication || 30;
      case 'SERVICE': return (plan as any).fixedPricePaise?.service || 0;
      default: return 40;
    }
  }
}
