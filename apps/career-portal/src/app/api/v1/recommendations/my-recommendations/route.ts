import { NextRequest, NextResponse } from "next/server";
import { listRecommendationsByUser } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { isEmployeeUser } from "@/lib/auth-store";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isEmployeeUser(user) || !["active", "former"].includes(user.status)) return forbidden();

  return NextResponse.json({ data: listRecommendationsByUser(user.name) });
}
