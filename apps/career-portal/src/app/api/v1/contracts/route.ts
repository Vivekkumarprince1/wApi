import { NextRequest, NextResponse } from "next/server";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { listContracts } from "@/lib/career-store";
import type { ContractStatus } from "@/types/career";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canViewApplicants")) return forbidden();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as ContractStatus | null;
  const q = searchParams.get("q") || undefined;
  return NextResponse.json({ data: listContracts({ status: status || undefined, q }) });
}
