import { NextRequest, NextResponse } from "next/server";
import { getApplicationById, getApplicationOffer } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ applicationId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { applicationId } = await params;
  const application = getApplicationById(applicationId);
  if (!application) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Application not found." } }, { status: 404 });

  const canAccess = user.email.toLowerCase() === application.candidate.email.toLowerCase() || user.permissions.canViewApplicants;
  if (!canAccess) return forbidden();

  const offer = getApplicationOffer(application.id);
  if (!offer) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Offer letter not found." } }, { status: 404 });
  return NextResponse.json({ data: offer });
}
