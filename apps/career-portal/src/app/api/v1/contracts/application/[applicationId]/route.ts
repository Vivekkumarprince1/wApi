import { NextRequest, NextResponse } from "next/server";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { getContractByApplicationId } from "@/lib/career-store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ applicationId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canViewApplicants")) return forbidden();

  const { applicationId } = await params;
  const contract = getContractByApplicationId(applicationId);
  if (!contract) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Contract not found." } }, { status: 404 });
  }

  return NextResponse.json({ data: contract });
}
