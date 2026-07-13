import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { hasPermission } from "@/lib/auth-store";
import { listJobs, saveJob } from "@/lib/career-store";
import { jobEditorSchema } from "@/lib/validators";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canCreateJob") && !hasPermission(user, "canAccessDashboard")) return forbidden();

  return NextResponse.json({ data: listJobs() });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canCreateJob")) return forbidden();

  const body = await request.json().catch(() => null);
  const result = jobEditorSchema.safeParse(body);
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

  return NextResponse.json({ data: saveJob(result.data) }, { status: 201 });
}
