import { NextRequest } from "next/server";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { contractArtifact } from "@/lib/career-store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canViewApplicants")) return forbidden();

  try {
    const { contractId } = await params;
    return new Response(contractArtifact(contractId), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="${contractId}-contract.txt"`,
      },
    });
  } catch (error) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Contract not found." } },
      { status: 404 },
    );
  }
}
