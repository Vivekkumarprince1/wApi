import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { BillingProxy } from "@/lib/services/billing/billing-proxy";

export const POST = withAuth(async (req: NextRequest, { workspace, user }: any) => {
  try {
    const body = await req.json();

    const response = await BillingProxy.forward('POST', '/api/billing/wallets/payment-method/verify', {
        data: {
          ...body,
          workspaceId: workspace._id
        },
        workspaceId: workspace._id.toString(),
        userId: user._id.toString()
    });

    if (response.status !== 200) {
      return NextResponse.json({ 
        message: "Verification failed", 
        error: response.data?.error || "Unknown error" 
      }, { status: response.status });
    }

    await dbConnect();
    // Sync local status
    await Workspace.findByIdAndUpdate(workspace._id, {
      $set: { billingStatus: 'active' }
    });

    return NextResponse.json(response.data);
  } catch (err: any) {
    console.error("[Payment Method Verify Proxy Error]:", err.message);
    return NextResponse.json({ message: "Verification failed", error: err.message }, { status: 500 });
  }
});
