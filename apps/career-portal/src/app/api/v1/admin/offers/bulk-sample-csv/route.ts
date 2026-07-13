import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { canAccessAdminArea, hasPermission } from "@/lib/auth-store";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!canAccessAdminArea(user) || !hasPermission(user, "canGenerateOfferLetter")) return forbidden();

  const csv = [
    "candidateName,candidateEmail,position,department,salary,startDate,validUntil,workType",
    "Priya Menon,priya@example.com,People Operations Associate,People Operations,720000,2026-08-01,2026-07-25,On-site",
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"bulk_offer_sample.csv\"",
    },
  });
}
