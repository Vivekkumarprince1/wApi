import { NextRequest, NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/career-store";
import { getRequestUser, unauthorized } from "@/lib/api-auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    return NextResponse.json({ data: markNotificationRead(id, user) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Notification not found." } },
      { status: 404 },
    );
  }
}
