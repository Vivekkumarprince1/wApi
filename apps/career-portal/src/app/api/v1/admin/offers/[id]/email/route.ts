import { NextRequest, NextResponse } from "next/server";
import { getOfferById } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canGenerateOfferLetter")) return forbidden();

  const { id } = await params;
  const offer = getOfferById(id);
  if (!offer) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Offer not found." } }, { status: 404 });

  return NextResponse.json({
    data: {
      queued: true,
      offerId: offer.id,
      publicId: offer.publicId,
      queuedAt: new Date().toISOString(),
    },
  });
}
