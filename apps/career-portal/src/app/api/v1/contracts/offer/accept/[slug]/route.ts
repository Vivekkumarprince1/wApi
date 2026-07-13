import { NextResponse } from "next/server";
import { decideOffer, getOfferForAcceptance } from "@/lib/career-store";
import { offerDecisionSchema } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    return NextResponse.json({ data: getOfferForAcceptance(slug) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Offer not found." } },
      { status: 404 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const result = offerDecisionSchema.safeParse({ ...body, decision: "accepted" });

  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the offer acceptance fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ data: decideOffer(slug, result.data) });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Offer not found." } },
      { status: 404 },
    );
  }
}
