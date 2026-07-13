import { NextRequest, NextResponse } from "next/server";
import { listSortedJobs } from "@/lib/career-store";

export function GET(request: NextRequest) {
  return NextResponse.json({ data: listSortedJobs(request.nextUrl.searchParams.get("sortBy") ?? undefined) });
}
