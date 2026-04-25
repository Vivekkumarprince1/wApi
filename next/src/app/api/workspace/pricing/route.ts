import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { PricingService } from "@/lib/services/billing/pricing-service";
import dbConnect from "@/lib/db-connect";

/**
 * GET: Fetch conversation costs for the current workspace
 * /api/workspace/pricing
 */
export const GET = withAuth(async (req: NextRequest, { workspace }) => {
  try {
    await dbConnect();

    const categories = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'] as const;
    const pricing: Record<string, number> = {};

    for (const category of categories) {
      pricing[category] = await PricingService.getCost(workspace._id, category);
    }

    return NextResponse.json({
      success: true,
      data: pricing,
      currency: workspace?.wallet?.currency || 'INR'
    });

  } catch (err: any) {
    console.error("[Pricing API Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
