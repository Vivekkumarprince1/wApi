/**
 * FEATURE GATE MIDDLEWARE
 * Server-side protection for plan-restricted modules.
 */

import { NextRequest, NextResponse } from "next/server";
import { AuthenticatedHandler } from "./auth";
import { Plan } from "../models";

/**
 * withFeature Higher-Order Function
 * Usage: export const GET = withAuth(withFeature('CRM', async (req, { workspace }) => { ... }))
 */
export function withFeature(featureKey: string, handler: AuthenticatedHandler) {
  return async (req: NextRequest, context: { params: any; user: any; workspace: any; isImpersonating?: boolean; permissions: any }) => {
    const { workspace } = context;

    if (!workspace) {
      return NextResponse.json({ message: "Workspace context required" }, { status: 400 });
    }

    // Hydrate plan if it's just an ID
    let plan = workspace.plan;
    if (plan && (typeof plan === 'string' || plan instanceof String)) {
      plan = await Plan.findById(String(plan));
    } else if (plan && plan._id && !plan.features) {
       // Re-fetch to be safe if it's a skeletal object
       plan = await Plan.findById(plan._id);
    }

    // If no plan is found, we assume 'free' which usually has minimal features
    const features = plan?.features || [];
    
    // Check for explicit match or 'ALL' wildcard (for admins/enterprise)
    const hasAccess = features.includes(featureKey) || features.includes('ALL');

    if (!hasAccess) {
      console.warn(`[FeatureGate] Access denied: Workspace ${workspace._id} (${workspace.name}) attempted to access ${featureKey} without proper plan.`);
      return NextResponse.json({ 
        message: `Your current plan does not include the ${featureKey} service.`,
        requiredFeature: featureKey,
        upgradeRequired: true
      }, { status: 403 });
    }

    return handler(req, { ...context, workspace: { ...workspace, plan } });
  };
}
