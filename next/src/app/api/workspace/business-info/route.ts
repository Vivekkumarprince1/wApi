/**
 * API: /api/workspace/business-info
 * Port of legacy settingsController.updateBusinessInfo
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const PATCH = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  try {
    const body = await req.json();
    const {
      name,
      industry,
      companySize,
      website,
      address,
      city,
      state,
      country,
      zipCode,
      description,
      businessDocuments
    } = body;

    await dbConnect();

    // Update workspace
    const updated = await Workspace.findByIdAndUpdate(
      workspace._id,
      {
        $set: {
          name: name || workspace.name,
          industry,
          companySize,
          website,
          address,
          city,
          state,
          country,
          zipCode,
          description,
          businessDocuments: {
            ...workspace.businessDocuments,
            ...businessDocuments
          },
          // Update onboarding logic if needed
          'onboarding.businessInfoCompleted': true,
          'onboarding.businessInfoCompletedAt': new Date(),
          'onboarding.step': workspace.onboarding?.step === 'business-info' ? 'whatsapp-setup' : workspace.onboarding?.step
        }
      },
      { returnDocument: 'after' }
    );

    return NextResponse.json({
      message: "Business information updated successfully",
      workspace: updated
    });
  } catch (err: any) {
    console.error("[Business Info API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
