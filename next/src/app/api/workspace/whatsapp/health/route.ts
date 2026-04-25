import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";

export const GET = withRole(['owner', 'admin'], async (req: NextRequest, { workspace }) => {
  // Mocking Meta/Gupshup Health Response
  const healthData = {
    qualityRating: "GREEN",
    messagingLimit: "10K",
    phoneStatus: "CONNECTED",
    webhookPulse: "OPERATIONAL",
    lastChecked: new Date()
  };

  return NextResponse.json({
    success: true,
    data: healthData
  });
});
