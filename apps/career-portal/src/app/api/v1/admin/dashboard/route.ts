import { NextRequest, NextResponse } from "next/server";
import { getAdminDashboard } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { canAccessAdminArea } from "@/lib/auth-store";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user)) return forbidden();

  return NextResponse.json({
    data: getAdminDashboard(),
  });
}
