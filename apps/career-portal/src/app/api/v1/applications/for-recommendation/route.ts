import { NextRequest, NextResponse } from "next/server";
import { listApplicationsForRecommendation } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { isEmployeeUser } from "@/lib/auth-store";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isEmployeeUser(user) || !["active", "former"].includes(user.status)) return forbidden();

  return NextResponse.json({
    data: listApplicationsForRecommendation(user).map((application) => ({
      id: application.id,
      reference: application.reference,
      fullName: application.candidate.name,
      email: application.candidate.email,
      jobId: application.jobId,
      jobTitle: application.jobTitle,
      status: application.status,
      createdAt: application.createdAt,
    })),
  });
}
