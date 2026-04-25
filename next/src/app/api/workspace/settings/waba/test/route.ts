import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const POST = withAuth(async (req: NextRequest, { workspace }) => {
  await dbConnect();
  if (!workspace.whatsappPhoneNumberId || !workspace.whatsappAccessToken) {
    return NextResponse.json({ success: false, message: "Missing credentials" }, { status: 400 });
  }
  return NextResponse.json({ success: true, phoneInfo: { display_phone_number: workspace.whatsappPhoneNumber || "Connected" } });
});
