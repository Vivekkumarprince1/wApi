import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Deal, Pipeline } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withFeature('CRM', async (req: NextRequest, { workspace, params }) => {
  try {
    const contactId = params?.contactId;
    if (!contactId) {
      return NextResponse.json({ success: false, message: "Contact ID is required" }, { status: 400 });
    }

    await dbConnect();

    const deals = await Deal.find({ 
      workspace: workspace._id,
      contact: contactId 
    })
    .populate('pipeline', 'name')
    .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: deals });
  } catch (err: any) {
    console.error("[Contact Deals API Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
