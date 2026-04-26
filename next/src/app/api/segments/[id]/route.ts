import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import dbConnect from "@/lib/db-connect";
import { Segment } from "@/lib/models";

/**
 * DELETE: Remove a segment
 */
export const DELETE = withAuth(async (req: NextRequest, { params, workspace }) => {
  try {
    await dbConnect();
    const { id } = params;

    if (!id) {
      return NextResponse.json({ message: "Segment ID is required" }, { status: 400 });
    }

    const segment = await Segment.findOneAndDelete({
      _id: id,
      workspace: workspace._id
    });

    if (!segment) {
      return NextResponse.json({ message: "Segment not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Segment deleted successfully"
    });
  } catch (err: any) {
    console.error("[Segments Delete API Error]:", err.message);
    return NextResponse.json({ 
      message: "Failed to delete segment", 
      error: err.message 
    }, { status: 500 });
  }
});
