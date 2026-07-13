import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { createApplication, listApplications } from "@/lib/career-store";
import { applicationFormSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/auth-store";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canViewApplicants")) return forbidden();

  return NextResponse.json({
    data: listApplications(),
    meta: {
      page: 1,
      limit: 20,
      total: listApplications().length,
    },
  });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized("Sign in before applying.");
  if (!user.verified) return forbidden("Verify your email before applying.");

  const body = await request.json().catch(() => null);
  const result = applicationFormSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the highlighted fields.",
          fields: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  try {
    const application = createApplication(result.data, user);
    return NextResponse.json(
      {
        data: {
          id: application.id,
          reference: application.reference,
          status: application.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "APPLICATION_CONFLICT",
          message: error instanceof Error ? error.message : "Application could not be created.",
        },
      },
      { status: 409 }
    );
  }
}
