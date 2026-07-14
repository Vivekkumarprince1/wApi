import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/authorization";
import { apiErrorResponse } from "@/lib/http/api-error";
import {
  createJobAlert,
  listJobAlerts,
} from "@/modules/engagement/server/engagement";

export async function GET() {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    return NextResponse.json({ alerts: await listJobAlerts(session.user.id) });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load job alerts");
  }
}
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    return NextResponse.json(
      { alert: await createJobAlert(session.user.id, await request.json()) },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Unable to create job alert");
  }
}
