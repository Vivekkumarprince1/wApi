import { NextRequest, NextResponse } from "next/server";
import { transitionApplicationStatus } from "@/lib/career-store";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canViewApplicants")) return forbidden();

  const body = await request.json().catch(() => ({}));
  try {
    const { id } = await params;
    return NextResponse.json({
      data: transitionApplicationStatus(
        id,
        "rejected",
        user.name,
        typeof body?.candidateMessage === "string" ? body.candidateMessage : typeof body?.reason === "string" ? body.reason : "Application was not selected.",
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Application not found." } },
      { status: 404 },
    );
  }
}
