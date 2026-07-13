import { NextRequest, NextResponse } from "next/server";
import { resumeAccess } from "@/lib/career-store";
import { getRequestUser, unauthorized } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  try {
    return NextResponse.json({ data: resumeAccess(id, user) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "RESUME_ACCESS_ERROR", message: error instanceof Error ? error.message : "Resume not found." } },
      { status: 404 },
    );
  }
}
