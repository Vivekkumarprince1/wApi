import type { Schema as SchemaType } from "mongoose";
import type { SchemaCtor } from "../types";

export interface IAuditLog {
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  sessionId?: string;
  action: string;
  target?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  outcome?: "success" | "failure";
  source?: string;
  createdAt: Date;
}

/**
 * Audit log schema (core DB `auditlogs`). strict:false so it co-exists with
 * the existing AuditLog model's fields. Used by the admin portal's audit
 * writer and audit-log reads.
 */
export function buildAuditLogSchema(Schema: SchemaCtor): SchemaType<IAuditLog> {
  return new Schema<IAuditLog>(
    {
      actorId: { type: String },
      actorEmail: { type: String },
      actorRole: { type: String },
      sessionId: { type: String },
      action: { type: String, index: true },
      target: { type: String },
      targetId: { type: String },
      metadata: { type: Schema.Types.Mixed },
      ip: { type: String },
      outcome: { type: String, enum: ["success", "failure"], default: "success" },
      source: { type: String },
      createdAt: { type: Date, default: Date.now, index: true },
    },
    { strict: false, collection: "auditlogs" }
  );
}
