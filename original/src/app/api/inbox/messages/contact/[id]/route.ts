import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Message } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withAuth(async (req: NextRequest, { params, workspace }) => {
  try {
    const { id: contactId } = await params;
    if (!contactId) {
      return NextResponse.json({ message: "Contact ID is required" }, { status: 400 });
    }

    await dbConnect();

    // Fetch last 3 messages for this contact in this workspace
    // Excluding internal notes to keep it a "Chat Pulse"
    const messages = await Message.find({
      workspace: workspace._id,
      contact: contactId,
      isInternalNote: { $ne: true }
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

    return NextResponse.json({
      success: true,
      data: {
        messages
      }
    });

  } catch (err: any) {
    console.error("[Inbound Contact Messages API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
