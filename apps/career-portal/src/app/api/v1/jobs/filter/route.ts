import { NextRequest, NextResponse } from "next/server";
import { listJobs } from "@/lib/career-store";

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  return NextResponse.json({
    data: listJobs({
      location: searchParams.get("location") ?? undefined,
      department: searchParams.get("department") ?? undefined,
      type: searchParams.get("type") ?? undefined,
    }),
  });
}
