import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Campaign } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withFeature('CAMPAIGNS', withAuth(async (req: NextRequest, { workspace, params }) => {
  try {
    await dbConnect();
    const id = params.id;
    const campaign = await Campaign.findOne({ _id: id, workspace: workspace._id })
      .populate('template', 'name category language body header footer buttons components')
      .lean();
    if (!campaign) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, campaign });
  } catch (err: any) {
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}));

export const PUT = withFeature('CAMPAIGNS', withAuth(async (req: NextRequest, { workspace, params }) => {
  try {
    await dbConnect();
    const id = params.id;
    const updates = await req.json();
    
    const campaign = await Campaign.findOneAndUpdate(
      { _id: id, workspace: workspace._id, status: { $in: ['DRAFT', 'SCHEDULED', 'PAUSED'] } },
      { $set: updates },
      { returnDocument: 'after' }
    );
    
    if (!campaign) return NextResponse.json({ message: "Not found or cannot edit in current status" }, { status: 404 });
    return NextResponse.json({ success: true, campaign });
  } catch (err: any) {
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}));

export const DELETE = withFeature('CAMPAIGNS', withAuth(async (req: NextRequest, { workspace, params }) => {
  try {
    await dbConnect();
    const id = params.id;
    const campaign = await Campaign.findOneAndDelete({ _id: id, workspace: workspace._id });
    if (!campaign) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}));
