import { NextResponse } from "next/server";

import { authorizeRecruitment } from "@/lib/auth/authorization";
import { apiErrorResponse } from "@/lib/http/api-error";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { sendApplicationActionEmail } from "@/modules/recruitment/server/applications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ identifier: string }> },
) {
  try {
    await enforceRateLimit(request, {
      namespace: "application-email",
      limit: 30,
      windowMs: 15 * 60_000,
    });
    const actor = await authorizeRecruitment("canViewApplicants");
    const result = await sendApplicationActionEmail(
      (await params).identifier,
      await request.json(),
      actor,
    );
    return NextResponse.json({
      message: result.duplicate ? "Email was already sent" : "Email sent",
      ...result,
    });
  } catch (error) {
    return apiErrorResponse(error, "Unable to send application email");
  }
}
