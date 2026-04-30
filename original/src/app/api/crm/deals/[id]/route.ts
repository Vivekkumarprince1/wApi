import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Deal, Contact } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

export const GET = withFeature('CRM', async (req: NextRequest, { workspace, params }: any) => {
  try {
    const { id } = await params;
    await dbConnect();
    const deal = await Deal.findOne({ _id: id, workspace: workspace._id })
      .populate('contact', 'name phone email avatar')
      .populate('pipeline', 'name stages')
      .populate('assignedAgent', 'name email');

    if (!deal) return NextResponse.json({ message: "Deal not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: deal });
  } catch (err: any) {
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});

export const PATCH = withFeature('CRM', async (req: NextRequest, { workspace, user, params }: any) => {
  try {
    const { id } = await params;
    const body = await req.json();
    await dbConnect();

    const deal = await Deal.findOne({ _id: id, workspace: workspace._id });
    if (!deal) return NextResponse.json({ message: "Deal not found" }, { status: 404 });

    // Track changes for activity log
    const changes: string[] = [];
    if (body.title && body.title !== deal.title) changes.push(`Title updated: ${body.title}`);
    if (body.value !== undefined && body.value !== deal.value) changes.push(`Value updated: ${body.value}`);
    if (body.priority && body.priority !== deal.priority) changes.push(`Priority changed to ${body.priority}`);
    if (body.status && body.status !== deal.status) changes.push(`Status changed to ${body.status}`);

    const updatedDeal = await Deal.findOneAndUpdate(
      { _id: id, workspace: workspace._id },
      { 
        $set: body,
        $push: {
          activityLog: changes.map(text => ({
            type: 'attribute_update',
            text,
            author: user._id,
            timestamp: new Date()
          }))
        }
      },
      { returnDocument: 'after' }
    );

    return NextResponse.json({ success: true, data: updatedDeal });
  } catch (err: any) {
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});

export const DELETE = withFeature('CRM', async (req: NextRequest, { workspace, params }: any) => {
  try {
    const { id } = await params;
    await dbConnect();

    const deal = await Deal.findOneAndDelete({ _id: id, workspace: workspace._id });
    if (!deal) return NextResponse.json({ message: "Deal not found" }, { status: 404 });

    // Clean up contact reference if it was the active deal
    await Contact.updateOne(
      { activeDealId: id },
      { $unset: { activeDealId: "" } }
    );

    return NextResponse.json({ success: true, message: "Deal deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
});
