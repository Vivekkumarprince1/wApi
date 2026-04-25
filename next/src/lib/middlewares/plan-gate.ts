/**
 * PLAN GATE MIDDLEWARE
 * 
 * Enforces subscription plan limits on specialized API routes.
 * Blocks execution if the workspace has exceeded its quota.
 */

import { NextResponse } from 'next/server';
import { Plan, Workspace } from '@/lib/models';
import dbConnect from '@/lib/db-connect';

export type GateableResource = 'messages' | 'contacts' | 'automations' | 'templates';

/**
 * Higher-order middleware function to check plan limits
 */
export function withPlanGate(resource: GateableResource, amount: number = 1) {
  return (handler: any) => {
    return async (req: any, context: any, ...args: any[]) => {
      try {
        await dbConnect();
        
        // Handle both standard req.workspace and withAuth's context.workspace
        const workspaceId = req.workspace?._id || context?.workspace?._id;
        
        if (!workspaceId) {
          // Fallback: If no auth context, proceed to handler (which might fail auth later)
          return handler(req, context, ...args);
        }

        const workspace = await Workspace.findById(workspaceId).populate('plan');
        if (!workspace) {
          return NextResponse.json({ message: 'Workspace context lost' }, { status: 403 });
        }

        const plan = workspace.plan as any;
        if (!plan) {
          // If no plan, we resolve the dynamic default
          const defaultPlan = await Plan.findOne({ isDefault: true }) || await Plan.findOne({ isActive: true });
          if (!defaultPlan) return handler(req, context, ...args); // System configuration error
          return checkLimits(defaultPlan, workspace, resource, amount, handler, req, context, args);
        }

        return checkLimits(plan, workspace, resource, amount, handler, req, context, args);

      } catch (err: any) {
        console.error(`[PlanGate Error]: ${resource}`, err.message);
        return NextResponse.json({ message: 'Error validating plan limits' }, { status: 500 });
      }
    };
  };
}

async function checkLimits(
  plan: any, 
  workspace: any, 
  resource: GateableResource, 
  amount: number, 
  handler: any, 
  req: any, 
  context: any,
  args: any[]
) {
  const limits = plan.limits || {};
  const usage = workspace.usage || {};

  let limit = -1;
  let currentUsage = 0;

  switch (resource) {
    case 'messages':
      limit = limits.maxMessagesPerMonth || -1;
      currentUsage = usage.messagesThisMonth || 0;
      break;
    case 'contacts':
      limit = limits.maxContacts || -1;
      currentUsage = usage.contacts || 0;
      break;
    case 'automations':
      limit = limits.maxAutomations || -1;
      currentUsage = usage.automations || 0;
      break;
    case 'templates':
      limit = limits.maxTemplates || -1;
      currentUsage = usage.templates || 0;
      break;
  }

  // -1 means unlimited
  if (limit !== -1 && currentUsage + amount > limit) {
    return NextResponse.json({
      success: false,
      message: `Plan limit exceeded for ${resource}. Current: ${currentUsage}/${limit}.`,
      code: 'PLAN_LIMIT_EXCEEDED',
      limit,
      current: currentUsage,
      resource
    }, { status: 402 }); // 402 Payment Required is semantically correct for limits
  }

  return handler(req, context, ...args);
}
