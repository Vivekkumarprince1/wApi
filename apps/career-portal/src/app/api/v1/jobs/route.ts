import { NextRequest, NextResponse } from "next/server";
import { listJobs } from "@/lib/career-store";

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  return NextResponse.json({
    data: listJobs({
      q: searchParams.get("q") ?? undefined,
      location: searchParams.get("location") ?? undefined,
      department: searchParams.get("department") ?? undefined,
      type: searchParams.get("type") ?? undefined,
    }),
    meta: {
      generatedAt: new Date().toISOString(),
    },
  });
}
