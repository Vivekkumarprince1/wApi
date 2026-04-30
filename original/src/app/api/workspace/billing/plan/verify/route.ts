import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Workspace, Plan } from "@/lib/models";
import { BillingProxy } from "@/lib/services/billing/billing-proxy";

export const POST = withAuth(async (req: NextRequest, { workspace, user }) => {
  try {
    const body = await req.json();

    // 1. Proxy verification to Billing Service
    const response = await BillingProxy.forward('POST', '/api/billing/wallets/plan/verify', {
      data: {
        ...body,
        workspaceId: workspace._id,
        workspaceDetails: {
            name: workspace.name,
            country: workspace.country,
            walletCurrency: workspace.walletCurrency || 'INR'
        }
      },
      workspaceId: workspace._id.toString(),
      userId: user._id.toString()
    });

    if (response.status !== 200) {
      return NextResponse.json({ 
        message: "Payment verification failed", 
        error: response.data?.error || "Unknown error" 
      }, { status: response.status });
    }

    const { planSlug } = response.data;

    // 2. Sync Plan state back to Monolith Workspace
    const targetPlan = await Plan.findOne({ slug: planSlug });
    if (!targetPlan) {
      throw new Error("PLAN_SYNC_FAILED_PLAN_NOT_FOUND_LOCALLY");
    }

    const nextPivot = new Date();
    const interval = targetPlan.billingIntervalMonths || 1;
    nextPivot.setMonth(nextPivot.getMonth() + interval);

    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      workspace._id,
      {
        $set: {
          plan: targetPlan._id,
          planId: targetPlan.slug,
          billingStatus: 'active',
          planLimits: targetPlan.limits || workspace.planLimits,
          billingPivotDate: nextPivot,
          autoPay: true
        }
      },
      { returnDocument: 'after' }
    );

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${targetPlan.name} plan!`,
      workspace: updatedWorkspace
    });

  } catch (err: any) {
    console.error("[Plan Verification Error]:", err.message);
    return NextResponse.json({ 
      message: "Payment verification failed", 
      error: err.message 
    }, { status: 500 });
  }
});
