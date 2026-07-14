import {
  CampaignStatus,
  CommunicationChannel,
  TemplateStatus,
  type Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeCollaboration } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { deliverEmail } from "@/lib/email/delivery";
import { sendApplicationEmail } from "@/lib/email/mailer";
import { apiErrorResponse, ApiError } from "@/lib/http/api-error";

const template = z.object({
  action: z.literal("template"),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  channel: z.enum(CommunicationChannel),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(2).max(20_000),
  variables: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  status: z.enum(TemplateStatus).default(TemplateStatus.DRAFT),
});
const campaign = z.object({
  action: z.literal("campaign"),
  name: z.string().trim().min(2).max(160),
  templateCode: z.string().trim().min(2).max(80),
  channel: z.enum(CommunicationChannel),
  audience: z.record(z.string(), z.unknown()),
  scheduledAt: z.coerce.date().optional(),
});
const message = z.object({
  action: z.literal("message"),
  candidateProfileId: z.string().regex(/^[a-f\d]{24}$/i),
  applicationId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  templateCode: z.string().trim().min(2).max(80),
  variables: z.record(z.string(), z.string().max(2_000)).default({}),
  purpose: z.enum(["RECRUITMENT", "MARKETING"]).default("RECRUITMENT"),
});
const schema = z.discriminatedUnion("action", [template, campaign, message]);

function render(value: string, variables: Record<string, string>) {
  return value.replace(
    /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g,
    (_, key: string) => variables[key] ?? "",
  );
}

export async function GET() {
  try {
    await authorizeCollaboration("canViewApplicants");
    const [templates, campaigns, messages] = await Promise.all([
      prisma.communicationTemplate.findMany({
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.communicationCampaign.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.candidateMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          candidateProfileId: true,
          applicationId: true,
          channel: true,
          direction: true,
          subject: true,
          templateCode: true,
          status: true,
          sentAt: true,
          createdAt: true,
        },
      }),
    ]);
    return NextResponse.json({ templates, campaigns, messages });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load communications");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await authorizeCollaboration("canManageCommunications");
    const input = schema.parse(await request.json());
    if (input.action === "template") {
      const record = await prisma.communicationTemplate.upsert({
        where: { code: input.code },
        create: {
          code: input.code,
          name: input.name,
          channel: input.channel,
          subject: input.subject ?? null,
          body: input.body,
          variables: input.variables,
          status: input.status,
          createdBy: actor.id,
        },
        update: {
          name: input.name,
          channel: input.channel,
          subject: input.subject ?? null,
          body: input.body,
          variables: input.variables,
          status: input.status,
        },
      });
      return NextResponse.json({ record }, { status: 201 });
    }
    if (input.action === "campaign") {
      const record = await prisma.communicationCampaign.create({
        data: {
          name: input.name,
          templateCode: input.templateCode,
          channel: input.channel,
          audience: input.audience as Prisma.InputJsonValue,
          scheduledAt: input.scheduledAt ?? null,
          status: input.scheduledAt
            ? CampaignStatus.SCHEDULED
            : CampaignStatus.DRAFT,
          createdBy: actor.id,
        },
      });
      return NextResponse.json({ record }, { status: 201 });
    }
    const [profile, selectedTemplate] = await Promise.all([
      prisma.candidateProfile.findUnique({
        where: { id: input.candidateProfileId },
        include: { preferences: true },
      }),
      prisma.communicationTemplate.findUnique({
        where: { code: input.templateCode },
      }),
    ]);
    if (!profile || !selectedTemplate || selectedTemplate.status !== "ACTIVE")
      throw new ApiError("Candidate profile or active template not found", 404);
    if (selectedTemplate.channel !== "EMAIL")
      throw new ApiError(
        "Only email delivery is enabled for this adapter",
        409,
      );
    if (
      input.purpose === "MARKETING" &&
      profile.preferences?.marketingEmail !== true
    )
      throw new ApiError(
        "Candidate has not opted into marketing email",
        409,
        "COMMUNICATION_SUPPRESSED",
      );
    const subject = render(
      selectedTemplate.subject ?? selectedTemplate.name,
      input.variables,
    );
    const body = render(selectedTemplate.body, input.variables);
    const record = await prisma.candidateMessage.create({
      data: {
        candidateProfileId: profile.id,
        applicationId: input.applicationId ?? null,
        channel: "EMAIL",
        direction: "OUTBOUND",
        subject,
        body,
        templateCode: selectedTemplate.code,
        status: "QUEUED",
        createdBy: actor.id,
      },
    });
    try {
      await deliverEmail({
        idempotencyKey: `candidate-message:${record.id}`,
        template: selectedTemplate.code,
        recipient: profile.primaryEmail,
        send: () =>
          sendApplicationEmail({
            to: profile.primaryEmail,
            subject,
            heading: subject,
            message: body,
          }),
      });
      await prisma.candidateMessage.update({
        where: { id: record.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    } catch (error) {
      await prisma.candidateMessage.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          failureReason:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Delivery failed",
        },
      });
      throw error;
    }
    return NextResponse.json(
      { record: { id: record.id, status: "SENT" } },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Unable to process candidate communication");
  }
}
