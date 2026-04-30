/**
 * API: /api/templates/[id]
 * Handles generic template updates and individual retrieval.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { Template } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET: Fetch a single template
 */
export const GET = withFeature('TEMPLATES', withAuth(async (req: NextRequest, { params, workspace }) => {
  try {
    const { id } = await params;
    await dbConnect();

    const template = await Template.findOne({ _id: id, workspace: workspace._id });
    if (!template) {
      return NextResponse.json({ message: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (err: any) {
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}));

/**
 * PUT: Update template fields (e.g., status, metadata)
 */
export const PUT = withFeature('TEMPLATES', withAuth(async (req: NextRequest, { params, workspace }) => {
  try {
    const { id } = await params;
    const body = await req.json();
    
    await dbConnect();

    const template = await Template.findOneAndUpdate(
      { _id: id, workspace: workspace._id },
      { $set: body },
      { new: true }
    );

    if (!template) {
      return NextResponse.json({ message: "Template not found" }, { status: 404 });
    }

    console.log(`[API] Updated template ${id} for workspace ${workspace._id}. Status: ${template.status}`);

    return NextResponse.json({ 
      success: true, 
      message: "Template updated successfully", 
      data: template 
    });
  } catch (err: any) {
    console.error("[Template Update API Error]:", err.message);
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}));
