import { NextRequest, NextResponse } from "next/server";
import { listJobs } from "@/lib/career-store";

export function GET(request: NextRequest) {
  return NextResponse.json({ data: listJobs({ q: request.nextUrl.searchParams.get("q") ?? undefined }) });
}
