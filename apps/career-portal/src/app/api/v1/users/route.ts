import { NextRequest, NextResponse } from "next/server";
import { canAccessAdminArea, hasPermission, listAuthUsers } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canManageEmployees")) return forbidden();

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase();
  const role = searchParams.get("role");
  const status = searchParams.get("status");

  const data = listAuthUsers().filter((item) => {
    const haystack = [item.name, item.email, item.phone, item.role, item.status, item.department, item.position]
      .join(" ")
      .toLowerCase();
    return (!query || haystack.includes(query)) && (!role || item.role === role) && (!status || item.status === status);
  });

  return NextResponse.json({ data });
}
