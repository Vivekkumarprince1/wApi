import { NextRequest, NextResponse } from "next/server";
import { addJobQuestion, listJobQuestions } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { hasPermission } from "@/lib/auth-store";
import { questionSchema } from "@/lib/validators";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canCreateJob") && !hasPermission(user, "canAccessDashboard")) return forbidden();

  const { id } = await params;
  try {
    return NextResponse.json({ data: listJobQuestions(id) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Job not found." } },
      { status: 404 },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canCreateJob")) return forbidden();

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = questionSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Correct the question fields." } }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: addJobQuestion(id, result.data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Job not found." } },
      { status: 404 },
    );
  }
}
