import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

export type DeliveryResult = {
  delivered: boolean;
  duplicate: boolean;
  attempts: number;
};

function recipientHash(recipient: string): string {
  return createHash("sha256")
    .update(recipient.trim().toLowerCase())
    .digest("hex");
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Delivery failed").slice(
    0,
    500,
  );
}

export async function deliverEmail(input: {
  idempotencyKey: string;
  template: string;
  recipient: string;
  send: () => Promise<{ messageId?: string } | void>;
  maximumAttempts?: number;
}): Promise<DeliveryResult> {
  const maximumAttempts = input.maximumAttempts ?? 3;
  const delivery = await prisma.emailDelivery.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      idempotencyKey: input.idempotencyKey,
      template: input.template,
      recipientHash: recipientHash(input.recipient),
    },
    update: {},
  });
  if (delivery.status === "SENT")
    return { delivered: false, duplicate: true, attempts: delivery.attempts };
  if (delivery.status === "SENDING")
    return { delivered: false, duplicate: true, attempts: delivery.attempts };

  const claimed = await prisma.emailDelivery.updateMany({
    where: {
      id: delivery.id,
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: maximumAttempts },
      nextAttemptAt: { lte: new Date() },
    },
    data: {
      status: "SENDING",
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null,
    },
  });
  if (claimed.count !== 1)
    return { delivered: false, duplicate: true, attempts: delivery.attempts };

  try {
    const result = await input.send();
    const current = await prisma.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        deliveredAt: new Date(),
        providerId: result?.messageId ?? null,
      },
      select: { attempts: true },
    });
    return { delivered: true, duplicate: false, attempts: current.attempts };
  } catch (error) {
    const current = await prisma.emailDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: { attempts: true },
    });
    await prisma.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        lastError: errorMessage(error),
        nextAttemptAt: new Date(
          Date.now() + Math.min(60_000, 1_000 * 2 ** current.attempts),
        ),
      },
    });
    throw error;
  }
}
