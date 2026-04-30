import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import axios from "axios";

const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || "http://localhost:3003";

/**
 * GET: Fetch conversation costs for the current workspace
 * /api/workspace/pricing
 */
export const GET = withAuth(async (req: NextRequest, { workspace }) => {
  try {
    const categories = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'] as const;
    const pricing: Record<string, number> = {};

    for (const category of categories) {
      const response = await axios.get(`${BILLING_SERVICE_URL}/api/billing/wallets/${workspace._id}/pricing`, {
        params: { category }
      });
      pricing[category] = response.data.cost;
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
