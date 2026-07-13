import { NextRequest, NextResponse } from "next/server";
import { updateReview } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { reviewUpdateSchema } from "@/lib/validators";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageReviews")) return forbidden();

  const body = await request.json().catch(() => null);
  const result = reviewUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the review fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  try {
    const { reviewId } = await params;
    return NextResponse.json({ data: updateReview(reviewId, result.data) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Review not found." } },
      { status: 404 },
    );
  }
}
