import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { apiErrorResponse } from "@/lib/http/api-error";

const schema = z.object({
  recruitmentEmail: z.boolean(),
  jobAlertsEmail: z.boolean(),
  marketingEmail: z.boolean(),
  sms: z.boolean(),
  legalTextVersion: z.string().trim().min(1).max(40),
});

async function profileId(userId: string) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}
export async function GET() {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    const id = await profileId(session.user.id);
    return NextResponse.json({
      preferences: id
        ? await prisma.communicationPreference.findUnique({
            where: { candidateProfileId: id },
          })
        : null,
    });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load communication preferences");
  }
}
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    const id = await profileId(session.user.id);
    if (!id)
      return NextResponse.json(
        { message: "Candidate profile not found" },
        { status: 404 },
      );
    const input = schema.parse(await request.json());
    const preferences = await prisma.communicationPreference.upsert({
      where: { candidateProfileId: id },
      create: {
        candidateProfileId: id,
        ...input,
        unsubscribedAt:
          !input.recruitmentEmail &&
          !input.jobAlertsEmail &&
          !input.marketingEmail &&
          !input.sms
            ? new Date()
            : null,
      },
      update: {
        ...input,
        unsubscribedAt:
          !input.recruitmentEmail &&
          !input.jobAlertsEmail &&
          !input.marketingEmail &&
          !input.sms
            ? new Date()
            : null,
      },
    });
    return NextResponse.json({ preferences });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Unable to update communication preferences",
    );
  }
}
