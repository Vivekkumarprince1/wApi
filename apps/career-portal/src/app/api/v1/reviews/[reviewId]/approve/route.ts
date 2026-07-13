import { NextRequest, NextResponse } from "next/server";
import { setReviewStatus } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageReviews")) return forbidden();

  try {
    const { reviewId } = await params;
    return NextResponse.json({ data: setReviewStatus(reviewId, "approved") });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Review not found." } },
      { status: 404 },
    );
  }
}
