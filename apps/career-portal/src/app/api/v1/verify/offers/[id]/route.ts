import { NextResponse } from "next/server";
import { verifyOffer } from "@/lib/career-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({
    data: verifyOffer(id),
  });
}
