import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { RazorpayService } from "@/lib/services/billing/razorpay-service";

export const POST = withAuth(async (req: NextRequest, { workspace }: any) => {
  try {
    const order = await RazorpayService.createVerificationOrder(workspace._id.toString());
    
    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err: any) {
    console.error("[Payment Method Order Error]:", err.message);
    return NextResponse.json({ message: "Failed to initiate verification", error: err.message }, { status: 500 });
  }
}) as any;
