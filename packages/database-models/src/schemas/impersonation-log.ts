import type { Schema as SchemaType } from "mongoose";
import type { SchemaCtor } from "../types";

export interface IImpersonationLog {
  adminId: string;
  adminEmail: string;
  adminRole: string;
  sessionId: string;
  workspaceId: string;
  targetUserId?: string;
  targetEmail?: string;
  ip?: string;
  startedAt: Date;
  endedAt?: Date;
  outcome: "success" | "failure";
}

/**
 * Dedicated audit trail for impersonation events (core DB `impersonation_logs`).
 * Separate from the general audit log so impersonation can be reviewed in
 * isolation for compliance.
 */
export function buildImpersonationLogSchema(Schema: SchemaCtor): SchemaType<IImpersonationLog> {
  return new Schema<IImpersonationLog>(
    {
      adminId: { type: String, index: true },
      adminEmail: { type: String },
      adminRole: { type: String },
      sessionId: { type: String },
      workspaceId: { type: String, index: true },
      targetUserId: { type: String },
      targetEmail: { type: String },
      ip: { type: String },
      startedAt: { type: Date, default: Date.now, index: true },
      endedAt: { type: Date },
      outcome: { type: String, enum: ["success", "failure"], default: "success" },
    },
    { strict: false, collection: "impersonation_logs" }
  );
}
