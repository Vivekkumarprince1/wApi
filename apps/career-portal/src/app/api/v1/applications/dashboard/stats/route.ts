import { NextRequest, NextResponse } from "next/server";
import { getDashboardMetrics } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canViewApplicants")) return forbidden();

  return NextResponse.json({ data: getDashboardMetrics() });
}
