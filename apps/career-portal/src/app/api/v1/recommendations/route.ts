import { NextRequest, NextResponse } from "next/server";
import { createRecommendation, listRecommendationsByUser } from "@/lib/career-store";
import { getRequestUser, forbidden, unauthorized } from "@/lib/api-auth";
import { isEmployeeUser } from "@/lib/auth-store";
import { recommendationSchema } from "@/lib/validators";

export function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isEmployeeUser(user) || !["active", "former"].includes(user.status)) return forbidden();

  return NextResponse.json({ data: listRecommendationsByUser(user.name) });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  if (!isEmployeeUser(user) || !["active", "former"].includes(user.status)) return forbidden();

  const body = await request.json().catch(() => null);
  const result = recommendationSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Correct the recommendation fields.",
          fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ data: createRecommendation(result.data, user) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "RECOMMENDATION_ERROR",
          message: error instanceof Error ? error.message : "Recommendation could not be created.",
        },
      },
      { status: 409 },
    );
  }
}
