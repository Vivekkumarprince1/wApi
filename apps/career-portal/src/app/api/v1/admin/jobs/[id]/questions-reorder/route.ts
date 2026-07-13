import { NextRequest, NextResponse } from "next/server";
import { reorderJobQuestions } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { hasPermission } from "@/lib/auth-store";
import { questionReorderSchema } from "@/lib/validators";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!hasPermission(user, "canCreateJob")) return forbidden();

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = questionReorderSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Provide question ids in order." } }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: reorderJobQuestions(id, result.data) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Job not found." } },
      { status: 404 },
    );
  }
}
