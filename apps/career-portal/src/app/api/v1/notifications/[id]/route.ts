import { NextRequest, NextResponse } from "next/server";
import { deleteNotification } from "@/lib/career-store";
import { getRequestUser, unauthorized } from "@/lib/api-auth";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    return NextResponse.json({ data: deleteNotification(id, user) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Notification not found." } },
      { status: 404 },
    );
  }
}
