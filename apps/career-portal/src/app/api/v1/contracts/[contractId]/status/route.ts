import { NextRequest, NextResponse } from "next/server";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { setContractStatus } from "@/lib/career-store";
import { contractStatusSchema } from "@/lib/validators";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canViewApplicants")) return forbidden();

  const body = await request.json().catch(() => null);
  const result = contractStatusSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the contract status fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  try {
    const { contractId } = await params;
    return NextResponse.json({ data: setContractStatus(contractId, result.data, user.name) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Contract not found." } },
      { status: 404 },
    );
  }
}

export const PATCH = PUT;
