/**
 * API: /api/workspace/billing/plan
 * Proxies plan management to billing-service.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/middlewares/auth";
import { Workspace, Plan } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { BillingProxy } from "@/lib/services/billing/billing-proxy";

/**
 * GET: Fetch Available Plans
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    await dbConnect();
    const plans = await Plan.find({ isActive: true }).sort({ monthlyBaseFeeCents: 1 });
    return NextResponse.json({ success: true, data: plans });
  } catch (err: any) {
    console.error("[Plans Fetch Error]:", err.message);
    return NextResponse.json({ message: "Failed to fetch plans", error: err.message }, { status: 500 });
  }
});

/**
 * POST: Change Plan
 */
export const POST = withRole(['owner', 'admin'], async (req: NextRequest, { workspace, user }) => {
  try {
    await dbConnect();
    const { planId, planSlug } = await req.json();

    const targetPlan = planId 
      ? await Plan.findById(planId)
      : await Plan.findOne({ slug: planSlug });

    if (!targetPlan) {
      return NextResponse.json({ message: "Requested plan not found" }, { status: 404 });
    }

    // SCENARIO 1: Paid Plan (Initiate Checkout via Billing Service)
    if (targetPlan.monthlyBaseFeeCents > 0) {
      const response = await BillingProxy.forward('POST', `/api/billing/wallets/${workspace._id}/plan`, {
        data: {
          amountPaise: targetPlan.monthlyBaseFeeCents,
          planSlug: targetPlan.slug
        },
        workspaceId: workspace._id.toString(),
        userId: user._id.toString()
      });

      return NextResponse.json({
        success: response.status === 200,
        requiresPayment: true,
        ...response.data,
        keyId: process.env.RAZORPAY_KEY_ID,
        planName: targetPlan.name
      }, { status: response.status });
    }

    // SCENARIO 2: Free Plan (Instant Activation)
    // We update local workspace for auth/routing, but also sync with billing service
    await BillingProxy.forward('POST', `/api/billing/wallets/${workspace._id}/add-funds`, {
        data: {
          amount: 0,
          description: `Plan switched to ${targetPlan.name} (Instant Activation)`,
          externalReferenceId: `free_plan_${Date.now()}`
        },
        workspaceId: workspace._id.toString(),
        userId: user._id.toString()
    });

    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      workspace._id,
      {
        $set: {
          plan: targetPlan._id,
          planId: targetPlan.slug,
          billingStatus: 'active',
          planLimits: targetPlan.limits || workspace.planLimits
        }
      },
      { returnDocument: 'after' }
    );

    return NextResponse.json({
      success: true,
      requiresPayment: false,
      message: `Successfully switched to ${targetPlan.name} plan.`,
      workspace: updatedWorkspace
    });

  } catch (err: any) {
    console.error("[Billing Plan Auth Error]:", err.message);
    return NextResponse.json({ message: "Failed to update plan", error: err.message }, { status: 500 });
  }
});
