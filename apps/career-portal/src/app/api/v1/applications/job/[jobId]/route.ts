import { NextRequest, NextResponse } from "next/server";
import { listApplications } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import type { ApplicationStatus } from "@/types/career";

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canViewApplicants")) return forbidden();

  const { jobId } = await params;
  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    data: listApplications({
      jobId,
      q: searchParams.get("q") || undefined,
      status: (searchParams.get("status") as ApplicationStatus | "all" | null) || "all",
    }),
  });
}
