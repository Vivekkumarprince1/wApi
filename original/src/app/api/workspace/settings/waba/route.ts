/**
 * API: /api/workspace/settings/waba
 * Port of legacy settingsController.getWABASettings & settingsController.updateWABASettings
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/middlewares/auth";
import { Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET: Retrieve WABA configuration and connection status
 */
export const GET = withAuth(async (req: NextRequest, { workspace }) => {
  return NextResponse.json({
    success: true,
    waba: {
      isConnected: !!workspace.whatsappPhoneNumberId,
      hasToken: !!workspace.whatsappAccessToken,
      phoneNumber: workspace.whatsappPhoneNumber || null,
      displayPhoneNumber: workspace.bspDisplayPhoneNumber || workspace.whatsappPhoneNumber || null,
      phoneNumberId: workspace.whatsappPhoneNumberId || workspace.bspPhoneNumberId || null,
      whatsappPhoneNumberId: workspace.whatsappPhoneNumberId || workspace.bspPhoneNumberId || null,
      wabaId: workspace.bspWabaId || workspace.wabaId || null,
      businessAccountId: workspace.businessAccountId || null,
      whatsappVerifyToken: workspace.whatsappVerifyToken || null,
      status: workspace.bspPhoneStatus || (workspace.whatsappPhoneNumberId ? 'CONNECTED' : 'NOT_CONNECTED'),
      bspManaged: !!workspace.bspManaged,
      onboarding: workspace.onboarding,
      connectedAt: workspace.connectedAt
    }
  });
});

/**
 * PUT: Update WABA identifiers (Internal/Admin tool parity)
 */
export const PUT = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  try {
    const { wabaId, phoneNumberId, phoneNumber } = await req.json();

    await dbConnect();

    const updated = await Workspace.findByIdAndUpdate(
      workspace._id,
      {
        $set: {
          bspWabaId: wabaId || workspace.bspWabaId,
          whatsappPhoneNumberId: phoneNumberId || workspace.whatsappPhoneNumberId,
          whatsappPhoneNumber: phoneNumber || workspace.whatsappPhoneNumber,
          // If manually updating, we assume it's part of an onboarding step completion
          'onboarding.whatsappSetupCompleted': !!(wabaId && phoneNumberId),
          'onboarding.step': (wabaId && phoneNumberId) ? 'completed' : workspace.onboarding?.step
        }
      },
      { returnDocument: 'after' }
    );

    return NextResponse.json({
      success: true,
      message: "WABA configuration updated successfully",
      waba: updated
    });
  } catch (err: any) {
    console.error("[WABA Settings PUT Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
