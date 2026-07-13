import { NextRequest, NextResponse } from "next/server";
import { listApplications } from "@/lib/career-store";
import type { ApplicationStatus } from "@/types/career";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { hasPermission } from "@/lib/auth-store";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canViewApplicants")) return forbidden();

  const searchParams = request.nextUrl.searchParams;
  return NextResponse.json({
    data: listApplications({
      q: searchParams.get("q") ?? undefined,
      status: (searchParams.get("status") as ApplicationStatus | "all" | null) ?? "all",
      jobId: searchParams.get("jobId") ?? undefined,
    }),
  });
}
