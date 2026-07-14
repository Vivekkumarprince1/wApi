import { NextResponse } from "next/server";

import { authorizeRecruitment } from "@/lib/auth/authorization";
import { apiErrorResponse } from "@/lib/http/api-error";
import { emailOffer } from "@/modules/documents/server/documents";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await authorizeRecruitment("canGenerateOfferLetter");
    await emailOffer((await params).id, actor);
    return NextResponse.json({ message: "Offer PDF emailed" });
  } catch (error) {
    return apiErrorResponse(error, "Unable to email offer");
  }
}
