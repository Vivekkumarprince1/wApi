import { NextRequest, NextResponse } from "next/server";
import { getApplicationById } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canViewApplicants")) return forbidden();

  const { id } = await params;
  const application = getApplicationById(id);
  if (!application) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Application not found." } }, { status: 404 });

  return NextResponse.json({
    data: {
      queued: true,
      to: application.candidate.email,
      template: "welcome",
      queuedAt: new Date().toISOString(),
    },
  });
}
