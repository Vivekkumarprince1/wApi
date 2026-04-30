/**
 * API: /api/templates/sync
 * Port of legacy templateController.syncTemplates
 * Triggers provider sync and reconciles local DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { WabaService } from "@/lib/services/messaging/waba-service";
import dbConnect from "@/lib/db-connect";

export const POST = withAuth(async (req: NextRequest, { user, workspace }) => {
  try {
    // Explicitly consume the body to prevent 'disturbed or locked' stream errors
    await req.json().catch(() => ({}));

    await dbConnect();

    // Trigger high-level sync logic
    const result = await WabaService.syncTemplates(workspace._id);

    return NextResponse.json({
      success: true,
      message: "Template synchronization completed",
      stats: result.stats,
      totalFromProvider: result.totalFromProvider
    });

  } catch (err: any) {
    console.error("[Template Sync API Error]:", err.message);
    
    let status = 500;
    if (err.message === 'WABA_NOT_CONFIGURED') status = 400;
    if (err.message === 'APP_TOKEN_MISSING' || err.message === 'APP_TOKEN_MISSING_FOR_TEMPLATE_SYNC') status = 400;
    if (err.message === 'WORKSPACE_NOT_FOUND') status = 404;

    return NextResponse.json({ 
      success: false, 
      message: err.message || "Failed to synchronize templates",
      code: err.code || 'SYNC_FAILED'
    }, { status });
  }
});
