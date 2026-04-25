/**
 * API: /api/templates/[id]/submit
 * Handles submitting a draft template to Meta for approval.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, withFeature } from "@/lib/middlewares/auth";
import { WabaService } from "@/lib/services/messaging/waba-service";
import dbConnect from "@/lib/db-connect";

export const POST = withFeature('TEMPLATES', withAuth(async (req: NextRequest, { params, user, workspace }) => {
  try {
    const { id } = await params;
    await dbConnect();

    console.log(`[API] Submitting template ${id} for workspace ${workspace._id}...`);

    const result = await WabaService.submitTemplateForApproval(workspace._id, id);

    return NextResponse.json({
      success: true,
      message: "Template submitted for approval successfully",
      data: result
    });

  } catch (err: any) {
    console.error("[Template Submit API Error]:", err.message);
    
    // Return appropriate error status
    const status = err.message.includes('NOT_FOUND') ? 404 : 400;
    
    return NextResponse.json({ 
      success: false, 
      message: err.message || "Failed to submit template" 
    }, { status });
  }
}));
