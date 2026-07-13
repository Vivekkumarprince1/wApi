import { NextResponse } from "next/server";
import { featuredJobs } from "@/lib/career-store";

export function GET() {
  return NextResponse.json({ data: featuredJobs() });
}
