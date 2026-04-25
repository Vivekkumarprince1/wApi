import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/middlewares/auth";
import { Invoice, WalletTransaction, Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = isSuperAdmin(async (req: NextRequest) => {
  try {
    await dbConnect();
    
    // Calculate gross revenue from completed recharges
    const revenueResult = await WalletTransaction.aggregate([
      { $match: { type: 'RECHARGE', status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const grossRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Count active subscriptions (workspaces with an active plan)
    const activeSubs = await Workspace.countDocuments({ 
      'plan': { $exists: true },
      'billingStatus': 'active'
    });

    // Pending payouts (mock for now or calculate if applicable)
    const pendingPayouts = 0; 

    // Churn rate (mock or calculate)
    const churnRate = 1.4;

    return NextResponse.json({
      success: true,
      data: {
        grossRevenue,
        activeSubs,
        churnRate,
        pendingPayouts
      }
    });
  } catch (err: any) {
    console.error("[Billing Stats Admin API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}) as any;
