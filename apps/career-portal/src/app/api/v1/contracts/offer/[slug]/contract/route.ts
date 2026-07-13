import { NextResponse } from "next/server";
import { submitOfferContract } from "@/lib/career-store";
import { contractSubmissionSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const result = contractSubmissionSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the onboarding contract fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ data: submitOfferContract(slug, result.data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: error instanceof Error ? error.message : "Offer not found." } },
      { status: 404 },
    );
  }
}
