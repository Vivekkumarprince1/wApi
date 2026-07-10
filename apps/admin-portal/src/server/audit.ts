import "server-only";
import type { AdminTokenPayload } from "./auth";
import { coreModels } from "./models";

/**
 * Admin audit trail.
 *
 * Records every mutating action taken from the admin portal into the core DB
 * `auditlogs` collection via the shared @connectsphere/database-models AuditLog model.
 * Writes here are operational metadata about admin activity — not domain
 * mutations — so a direct insert is appropriate (Rule #5 governs DOMAIN writes).
 */

export interface AuditInput {
  actor: AdminTokenPayload;
  action: string;
  target?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  outcome?: "success" | "failure";
}

/** Best-effort audit write — never throws into the request path. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const { AuditLog } = await coreModels();
    await AuditLog.create({
      actorId: input.actor.userId,
      actorEmail: input.actor.email,
      actorRole: input.actor.role,
      sessionId: input.actor.sid,
      action: input.action,
      target: input.target,
      targetId: input.targetId,
      metadata: input.metadata,
      ip: input.ip,
      outcome: input.outcome || "success",
      source: "admin-portal",
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[admin-portal/audit] failed to record audit:", err);
  }
}

/** Extracts the client IP from a request's forwarded headers. */
export function clientIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || undefined;
}
