import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Workspace, User, Plan } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withRole(['super_admin'], async (req: NextRequest) => {
  try {
    await dbConnect();
    
    // Fetch all workspaces with basic populates
    const workspaces = await Workspace.find({})
      .populate('owner', 'name email')
      .populate('plan', 'name slug features limits isActive')
      .select(
        'name owner plan billingStatus whatsappConnected bspPhoneStatus wallet createdAt updatedAt gupshupIdentity gupshupAppId gupshupAppName gupshupAppLive gupshupAppHealth gupshupWalletBalance bspSyncStatus bspLastSyncedAt bspPhoneNumberId bspDisplayPhoneNumber bspVerifiedName bspQualityRating bspMessagingTier whatsappPhoneNumber whatsappPhoneNumberId phoneNumbers businessId wabaId childWabaId metaBusinessId businessAccountId esbFlow'
      )
      .sort({ createdAt: -1 });

    return NextResponse.json(workspaces);
  } catch (err: any) {
    console.error("[Workspaces Admin API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}) as any;
