import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";

export const GET = withAuth(async (req: NextRequest) => {
  // Mock response for template library stats
  return NextResponse.json({
    success: true,
    data: {
      total: 120,
      approved: 95,
      rejected: 5,
      pending: 20
    }
  });
});
