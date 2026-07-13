import { NextResponse } from "next/server";
import { getJobBySlug, getRelatedJobs } from "@/lib/career-store";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = getJobBySlug(slug);

  if (!job) {
    return NextResponse.json(
      {
        error: {
          code: "JOB_NOT_FOUND",
          message: "This role is not available.",
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      job,
      relatedJobs: getRelatedJobs(job),
    },
  });
}
