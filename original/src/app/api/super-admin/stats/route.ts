import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Workspace, User, Message } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import { LedgerService } from "@/lib/services/billing/ledger-service";

export const GET = withRole(['super_admin'], async (req: NextRequest) => {
  try {
    await dbConnect();
    
    // 1. Total Workspaces
    const totalWorkspaces = await Workspace.countDocuments({});
    
    // 2. Total Users
    const totalUsers = await User.countDocuments({});
    
    // 3. Messages in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const totalMessages30d = await Message.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo },
      isInternalNote: false 
    });
    
    // 4. Active Revenue (From Billing Service)
    const billingStats = await LedgerService.getGlobalStats();
    const activeRevenue = (billingStats.grossRevenue || 0) / 100; // Convert Paisa to Rupees

    return NextResponse.json({
      success: true,
      data: {
        totalWorkspaces,
        totalUsers,
        totalMessages30d,
        activeRevenue
      }
    });

  } catch (err: any) {
    console.error("[Admin Stats API Error]:", err.message);
    return NextResponse.json({ 
      success: false, 
      message: "Server Error", 
      error: err.message 
    }, { status: 500 });
  }
}) as any;
