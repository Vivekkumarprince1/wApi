import { NextRequest, NextResponse } from "next/server";
import { certificateArtifact } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { canAccessAdminArea } from "@/lib/auth-store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user)) return forbidden();

  const { id } = await params;
  try {
    return new NextResponse(certificateArtifact(id), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="certificate-${id}.txt"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Certificate not found." } },
      { status: 404 },
    );
  }
}
