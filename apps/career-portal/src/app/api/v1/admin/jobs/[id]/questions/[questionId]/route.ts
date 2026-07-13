import { NextRequest, NextResponse } from "next/server";
import { deleteJobQuestion, updateJobQuestion } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { hasPermission } from "@/lib/auth-store";
import { questionSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canCreateJob")) return forbidden();

  const { id, questionId } = await params;
  const body = await request.json().catch(() => null);
  const result = questionSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Correct the question fields." } }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: updateJobQuestion(id, questionId, result.data) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Question not found." } },
      { status: 404 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canCreateJob")) return forbidden();

  const { id, questionId } = await params;
  try {
    return NextResponse.json({ data: deleteJobQuestion(id, questionId) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Question not found." } },
      { status: 404 },
    );
  }
}
