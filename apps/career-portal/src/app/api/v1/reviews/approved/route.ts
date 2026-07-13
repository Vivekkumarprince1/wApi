import { NextResponse } from "next/server";
import { getApprovedReviews } from "@/lib/career-store";

export function GET() {
  return NextResponse.json({ data: getApprovedReviews() });
}
