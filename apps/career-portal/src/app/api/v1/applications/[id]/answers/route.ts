import { NextRequest, NextResponse } from "next/server";
import { updateApplicationAnswers } from "@/lib/career-store";
import { getRequestUser, unauthorized } from "@/lib/api-auth";
import { applicationAnswersSchema } from "@/lib/validators";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = applicationAnswersSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Correct the answer fields." } }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: updateApplicationAnswers(id, result.data, user) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "APPLICATION_ERROR", message: error instanceof Error ? error.message : "Application not found." } },
      { status: 404 },
    );
  }
}

export const PATCH = PUT;
