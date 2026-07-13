import { NextRequest, NextResponse } from "next/server";
import { acceptReview, getApprovedReviews } from "@/lib/career-store";
import { reviewSchema } from "@/lib/validators";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { isEmployeeUser } from "@/lib/auth-store";

export function GET() {
  return NextResponse.json({ data: getApprovedReviews() });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isEmployeeUser(user) || !["active", "former"].includes(user.status)) {
    return forbidden("Only eligible employees can submit employment reviews.");
  }

  const body = await request.json().catch(() => null);
  const result = reviewSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the highlighted fields.",
          fields: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ data: acceptReview(result.data, user.name) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "REVIEW_CONFLICT", message: error instanceof Error ? error.message : "Review could not be submitted." } },
      { status: 409 },
    );
  }
}
