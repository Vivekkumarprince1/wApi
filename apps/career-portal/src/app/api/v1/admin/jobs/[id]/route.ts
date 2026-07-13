import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { deleteJob, getJobById, saveJob } from "@/lib/career-store";
import { hasPermission } from "@/lib/auth-store";
import { jobEditorSchema } from "@/lib/validators";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canCreateJob") && !hasPermission(user, "canAccessDashboard")) return forbidden();

  const { id } = await params;
  const job = getJobById(id);
  if (!job) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Job not found." } }, { status: 404 });
  }
  return NextResponse.json({ data: job });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canCreateJob")) return forbidden();

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = jobEditorSchema.safeParse({ ...body, id });
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the highlighted fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: saveJob(result.data) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canCreateJob")) return forbidden();

  const { id } = await params;
  try {
    return NextResponse.json({ data: deleteJob(id) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Job not found." } },
      { status: 404 },
    );
  }
}
