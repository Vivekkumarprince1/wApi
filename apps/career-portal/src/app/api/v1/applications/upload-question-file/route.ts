import { NextRequest, NextResponse } from "next/server";
import { questionFileUploadDemo } from "@/lib/career-store";
import { getRequestUser, unauthorized } from "@/lib/api-auth";
import { fileNameSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const result = fileNameSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Provide fileName." } }, { status: 400 });

  return NextResponse.json({ data: questionFileUploadDemo(result.data.fileName) }, { status: 201 });
}
