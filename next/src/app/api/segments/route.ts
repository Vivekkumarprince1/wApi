/**
 * API: /api/segments
 * Port of legacy segmentController
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Segment, Contact } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET: List all segments
 */
export const GET = withAuth(async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();

    const segments = await Segment.find({ workspace: workspace._id })
      .select('name description filters contactCount lastResolvedAt createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      segments,
      total: segments.length
    });
  } catch (err: any) {
    console.error("[Segments List API Error]:", err.message);
    return NextResponse.json({ 
      message: "Server Error", 
      error: err.message 
    }, { status: 500 });
  }
});

/**
 * POST: Create a new segment
 */
export const POST = withAuth(async (req: NextRequest, { workspace, user }) => {
  try {
    await dbConnect();

    const { name, description, filters } = await req.json();

    if (!name) {
      return NextResponse.json({ message: "Segment name is required" }, { status: 400 });
    }

    // Calculate initial contact count
    const count = await resolveSegmentCount(workspace._id, filters);

    const segment = await Segment.create({
      workspace: workspace._id,
      name,
      description,
      filters: filters || {},
      contactCount: count,
      lastResolvedAt: new Date(),
      createdBy: user._id
    });

    return NextResponse.json({
      success: true,
      segment,
      message: "Segment created successfully"
    }, { status: 201 });
  } catch (err: any) {
    console.error("[Segments Create API Error]:", err.message);
    return NextResponse.json({ 
      message: "Failed to create segment", 
      error: err.message 
    }, { status: 400 });
  }
});

/**
 * Helper: Calculate segment contact count
 */
async function resolveSegmentCount(workspaceId: any, filters: any) {
  const query: any = { workspace: workspaceId };

  if (filters?.tags?.length > 0) {
    query.tags = { $in: filters.tags };
  }

  if (filters?.notTags?.length > 0) {
    query.tags = { ...query.tags, $nin: filters.notTags };
  }

  if (filters?.status?.length > 0) {
    query.status = { $in: filters.status };
  }

  return await Contact.countDocuments(query);
}
