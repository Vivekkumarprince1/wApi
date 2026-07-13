import { NextResponse } from "next/server";
import { decideOffer } from "@/lib/career-store";
import { offerDecisionSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = offerDecisionSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Choose accept or reject.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ data: decideOffer(id, result.data) });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Offer not found.",
        },
      },
      { status: 404 },
    );
  }
}
