import { NextRequest, NextResponse } from "next/server";
import { getCertificateById } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canGenerateCertificate")) return forbidden();

  const { id } = await params;
  const certificate = getCertificateById(id);
  if (!certificate) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Certificate not found." } }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      queued: true,
      certificateId: certificate.id,
      publicId: certificate.publicId,
      queuedAt: new Date().toISOString(),
    },
  });
}
