/**
 * API: /api/workspace/billing/plan
 * Handles instant plan switching/upgrading for workspaces.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/middlewares/auth";
import { Workspace, Plan, WalletTransaction } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

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
 * Logic ported from legacy billingController.js
 */
export const POST = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();
    const { planId, planSlug } = await req.json();

    // Find the target plan
    const targetPlan = planId 
      ? await Plan.findById(planId)
      : await Plan.findOne({ slug: planSlug });

    if (!targetPlan) {
      return NextResponse.json({ message: "Requested plan not found" }, { status: 404 });
    }

    // Capture previous state for audit/ledger
    const oldPlanId = workspace.plan;

    // SCENARIO 1: Paid Plan (Initiate Checkout)
    if (targetPlan.monthlyBaseFeeCents > 0) {
      const { RazorpayService } = await import('@/lib/services/billing/razorpay-service');
      const order = await RazorpayService.createPlanOrder(
        targetPlan.monthlyBaseFeeCents, 
        workspace._id.toString(),
        targetPlan.slug
      );

      return NextResponse.json({
        success: true,
        requiresPayment: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        planName: targetPlan.name
      });
    }

    // SCENARIO 2: Free Plan (Instant Activation)
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

    await WalletTransaction.create({
        workspace: workspace._id,
        type: 'SUBSCRIPTION_PURCHASE',
        amount: 0,
        status: 'COMPLETED',
        referenceType: 'SUBSCRIPTION',
        description: `Plan switched from ${oldPlanId || 'Free'} to ${targetPlan.name} (Instant Activation)`
    });

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
