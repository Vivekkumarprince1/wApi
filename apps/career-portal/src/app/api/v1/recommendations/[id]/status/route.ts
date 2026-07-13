import { NextRequest, NextResponse } from "next/server";
import { setRecommendationStatus } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { recommendationStatusSchema } from "@/lib/validators";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageRecommendations")) return forbidden();

  const body = await request.json().catch(() => null);
  const result = recommendationStatusSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid status." } }, { status: 400 });
  }

  try {
    const { id } = await params;
    return NextResponse.json({ data: setRecommendationStatus(id, result.data.status, result.data.adminNotes) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Recommendation not found." } },
      { status: 404 },
    );
  }
}

export const PATCH = PUT;
