import { NextRequest, NextResponse } from "next/server";
import { getApplicationById, issueOffer } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { offerIssueSchema } from "@/lib/validators";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canGenerateOfferLetter")) return forbidden();

  const { id } = await params;
  const application = getApplicationById(id);
  if (!application) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Application not found." } }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const result = offerIssueSchema.safeParse({
    ...body,
    applicationId: application.id,
    candidateName: body?.candidateName || application.candidate.name,
    candidateEmail: body?.candidateEmail || application.candidate.email,
    position: body?.position || body?.role || application.jobTitle,
  });
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the offer fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: issueOffer(result.data, user.name) }, { status: 201 });
}
