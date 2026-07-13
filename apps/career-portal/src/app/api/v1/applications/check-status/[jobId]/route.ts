import { NextRequest, NextResponse } from "next/server";
import { getApplicationStatusForJob } from "@/lib/career-store";
import { getRequestUser, unauthorized } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { jobId } = await params;
  return NextResponse.json({ data: getApplicationStatusForJob(jobId, user.email) });
}
