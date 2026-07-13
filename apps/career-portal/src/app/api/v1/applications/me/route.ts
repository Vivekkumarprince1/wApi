import { NextRequest, NextResponse } from "next/server";
import { listCandidateApplications } from "@/lib/career-store";
import { getRequestUser, unauthorized } from "@/lib/api-auth";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  return NextResponse.json({
    data: listCandidateApplications(user.email),
  });
}
