import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { BillingProxy } from "@/lib/services/billing/billing-proxy";

export const POST = withAuth(async (req: NextRequest, { workspace, user }: any) => {
  try {
    const response = await BillingProxy.forward('POST', `/api/billing/wallets/${workspace._id}/verify-order`, {
      workspaceId: workspace._id.toString(),
      userId: user._id.toString()
    });
    
    return NextResponse.json({
      success: response.status === 200,
      ...response.data,
      keyId: process.env.RAZORPAY_KEY_ID
    }, { status: response.status });
  } catch (err: any) {
    console.error("[Payment Method Order Proxy Error]:", err.message);
    return NextResponse.json({ message: "Failed to initiate verification", error: err.message }, { status: 500 });
  }
});
