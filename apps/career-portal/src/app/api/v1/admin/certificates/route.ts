import { NextRequest, NextResponse } from "next/server";
import { issueCertificate, listCertificates } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { certificateIssueSchema } from "@/lib/validators";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user)) return forbidden();

  return NextResponse.json({ data: listCertificates() });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canGenerateCertificate")) return forbidden();

  const body = await request.json().catch(() => null);
  const result = certificateIssueSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the certificate fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ data: issueCertificate(result.data, user.name) }, { status: 201 });
}
