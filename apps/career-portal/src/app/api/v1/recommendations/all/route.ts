import { NextRequest, NextResponse } from "next/server";
import { listRecommendations } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import type { Recommendation } from "@/types/career";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageRecommendations")) return forbidden();

  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    data: listRecommendations({
      status: (searchParams.get("status") as Recommendation["status"] | null) || undefined,
      q: searchParams.get("q") || undefined,
    }),
  });
}
