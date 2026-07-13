import { NextRequest, NextResponse } from "next/server";
import { isSuperAdminUser } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { listJobs } from "@/lib/career-store";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isSuperAdminUser(user)) return forbidden("Only super admins can inspect assignable jobs.");

  return NextResponse.json({ data: listJobs() });
}
