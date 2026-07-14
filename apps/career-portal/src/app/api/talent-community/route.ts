import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/http/api-error";
import { joinTalentCommunity } from "@/modules/engagement/server/engagement";

export async function POST(request: Request) {
  try {
    return NextResponse.json(
      { member: await joinTalentCommunity(await request.json()) },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Unable to join the talent community");
  }
}
