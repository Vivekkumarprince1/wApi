import { NextResponse } from "next/server";
import { listJobQuestions } from "@/lib/career-store";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    return NextResponse.json({ data: listJobQuestions(slug) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "JOB_NOT_FOUND", message: error instanceof Error ? error.message : "Job not found." } },
      { status: 404 },
    );
  }
}
