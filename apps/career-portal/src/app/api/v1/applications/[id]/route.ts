import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { getApplicationById, transitionApplicationStatus } from "@/lib/career-store";
import { hasPermission } from "@/lib/auth-store";
import { applicationStatusSchema } from "@/lib/validators";

function canViewApplication(user: NonNullable<ReturnType<typeof getRequestUser>>, applicationEmail: string) {
  return hasPermission(user, "canViewApplicants") || user.email.toLowerCase() === applicationEmail.toLowerCase();
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const application = getApplicationById(id);
  if (!application) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Application not found." } }, { status: 404 });
  }
  if (!canViewApplication(user, application.candidate.email)) return forbidden();

  return NextResponse.json({ data: application });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canViewApplicants")) return forbidden();

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = applicationStatusSchema.safeParse(body);
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

  try {
    return NextResponse.json({
      data: transitionApplicationStatus(id, result.data.status, user.name, result.data.candidateMessage),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Application not found.",
        },
      },
      { status: 404 },
    );
  }
}
