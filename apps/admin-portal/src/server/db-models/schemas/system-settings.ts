import type { Schema as SchemaType } from "mongoose";
import type { SchemaCtor } from "../types";

export interface ISystemSettings {
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  allowNewSignups?: boolean;
  /**
   * The core-server stores this as a structured object
   * ({ message, level, active, updatedAt }); older data may be a plain string
   * or null. Typed loosely so reads/writes from either model agree.
   */
  systemNotice?: unknown;
  features?: Record<string, unknown>;
  updatedBy?: unknown;
  updatedAt?: Date;
}

/**
 * Platform-wide settings singleton.
 *
 * IMPORTANT: the canonical collection is `system_settings` (underscore) — that
 * is what core-server's SystemSettings model reads and writes. The admin portal
 * MUST bind to the same collection so settings/compliance changes are seen by
 * the live platform. strict:false so it co-exists with the core-server model's
 * extra fields (systemNotice object, updatedBy, etc.).
 */
export function buildSystemSettingsSchema(Schema: SchemaCtor): SchemaType<ISystemSettings> {
  return new Schema<ISystemSettings>(
    {
      maintenanceMode: { type: Boolean, default: false },
      maintenanceMessage: { type: String, default: "" },
      allowNewSignups: { type: Boolean, default: true },
      systemNotice: { type: Schema.Types.Mixed, default: null },
      features: { type: Schema.Types.Mixed },
    },
    { strict: false, collection: "system_settings", timestamps: true }
  );
}
