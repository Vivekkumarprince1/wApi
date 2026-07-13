import { NextRequest, NextResponse } from "next/server";
import { getNotifications } from "@/lib/career-store";
import { canAccessAdminArea } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user)) return forbidden();

  return NextResponse.json({ data: getNotifications() });
}
