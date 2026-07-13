import { NextRequest, NextResponse } from "next/server";
import { getApplicationById, getApplicationOffer, offerArtifact } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const application = getApplicationById(id);
  if (!application) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Application not found." } }, { status: 404 });
  }

  const canAccess = user.email.toLowerCase() === application.candidate.email.toLowerCase() || user.permissions.canViewApplicants;
  if (!canAccess) return forbidden();

  const offer = getApplicationOffer(application.id);
  if (!offer) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Offer letter not found." } }, { status: 404 });
  }

  return new NextResponse(offerArtifact(offer.id), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="offer-${offer.publicId}.txt"`,
    },
  });
}
