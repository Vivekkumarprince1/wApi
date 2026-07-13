import { NextRequest, NextResponse } from "next/server";
import { offerArtifact } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { canAccessAdminArea } from "@/lib/auth-store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user)) return forbidden();

  const { id } = await params;
  try {
    return new NextResponse(offerArtifact(id), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="offer-${id}.txt"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Offer not found." } },
      { status: 404 },
    );
  }
}
