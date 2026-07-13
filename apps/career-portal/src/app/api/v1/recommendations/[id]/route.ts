import { NextRequest, NextResponse } from "next/server";
import { deleteRecommendation } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { isEmployeeUser } from "@/lib/auth-store";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isEmployeeUser(user) || !["active", "former"].includes(user.status)) return forbidden();

  const { id } = await params;
  try {
    return NextResponse.json({ data: deleteRecommendation(id, user) });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "RECOMMENDATION_ERROR",
          message: error instanceof Error ? error.message : "Recommendation could not be deleted.",
        },
      },
      { status: 409 },
    );
  }
}
