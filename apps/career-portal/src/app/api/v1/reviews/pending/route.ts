import { NextRequest, NextResponse } from "next/server";
import { listReviews } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageReviews")) return forbidden();

  const { searchParams } = new URL(request.url);
  return NextResponse.json({ data: listReviews({ status: "pending", q: searchParams.get("q") || undefined }) });
}
