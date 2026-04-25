/**
 * API: /api/workspace/billing/plan/verify
 * Verifies Razorpay payment signature and activates the new plan.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Workspace, Plan, WalletTransaction } from "@/lib/models";
import { RazorpayService } from "@/lib/services/billing/razorpay-service";
import dbConnect from "@/lib/db-connect";

export const POST = withAuth(async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ message: "Invalid payment details" }, { status: 400 });
    }

    // 1. Verify Signature
    const isValid = RazorpayService.verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json({ message: "Invalid payment signature" }, { status: 400 });
    }

    // 2. Fetch Order Details to find the plan slug
    const order = await (RazorpayService as any).getInstance().orders.fetch(razorpay_order_id);
    const planSlug = order.notes.planSlug;

    if (!planSlug) {
      return NextResponse.json({ message: "Plan context missing in order" }, { status: 400 });
    }

    // 3. Find the target plan
    const targetPlan = await Plan.findOne({ slug: planSlug });
    if (!targetPlan) {
      return NextResponse.json({ message: "Target plan not found" }, { status: 404 });
    }

    // 4. Update Workspace (Activate Plan & Set Billing Pivot)
    const oldPlanId = workspace.plan;
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

    // 5. Record Transaction
    const transaction = await WalletTransaction.create({
      workspace: workspace._id,
      type: 'SUBSCRIPTION_PURCHASE',
      amount: order.amount, // Record the actual amount paid (in paise)
      status: 'COMPLETED',
      referenceType: 'SUBSCRIPTION',
      referenceId: razorpay_payment_id,
      description: `Plan switched from ${oldPlanId || 'Free'} to ${targetPlan.name} (Paid Upgrade)`
    });

    // 6. Generate Automated Invoice
    try {
      const { BillingInvoiceService } = await import('@/lib/services/billing/billing-invoice-service');
      await BillingInvoiceService.generateForTransaction(transaction._id);
    } catch (invoiceErr: any) {
      console.error('[Plan:InvoiceError]:', invoiceErr.message);
    }

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
