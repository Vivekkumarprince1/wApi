import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { RazorpayService } from "@/lib/services/billing/razorpay-service";
import { Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const POST = withAuth(async (req: NextRequest, { workspace }: any) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    const isValid = RazorpayService.verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    }

    await dbConnect();
    
    // In a real scenario, we would store the payment_id or a token for future use.
    // For now, we'll mark the workspace as having a verified payment method.
    await Workspace.findByIdAndUpdate(workspace._id, {
      $set: { 
        billingStatus: 'active',
        // Here we could also save the razorpay_customer_id or payment token
      }
    });

    return NextResponse.json({
      success: true,
      message: "Payment method verified and saved successfully"
    });
  } catch (err: any) {
    console.error("[Payment Method Verify Error]:", err.message);
    return NextResponse.json({ message: "Verification failed", error: err.message }, { status: 500 });
  }
}) as any;
