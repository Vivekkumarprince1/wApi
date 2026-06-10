import type { Schema as SchemaType, Types } from "mongoose";
import type { SchemaCtor } from "../types";

export type BillingStatus = "trialing" | "active" | "past_due" | "suspended" | "canceled";

export interface IWorkspace {
  name: string;
  owner?: Types.ObjectId;
  plan?: Types.ObjectId;
  planId?: string;
  billingCycle?: "monthly" | "yearly";
  billingStatus?: BillingStatus;
  suspensionReason?: string;
  whatsappConnected?: boolean;
  bspPhoneNumberId?: string;
  wallet?: {
    balance?: number;
    parkedBalance?: number;
    currency?: string;
  };
  usage?: Record<string, number>;
  planLimits?: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Focused Workspace schema for cross-service reads. Declared `strict: false`
 * so the many unmodeled fields owned by core-server (onboarding, esbFlow, BSP,
 * etc.) still round-trip untouched. The full canonical schema remains in
 * services/core-server/src/models/workspace/Workspace.ts; a verbatim move
 * here is a follow-up that must be validated against core-server's build.
 */
export function buildWorkspaceSchema(Schema: SchemaCtor): SchemaType<IWorkspace> {
  const WorkspaceSchema = new Schema<IWorkspace>(
    {
      name: { type: String, required: true },
      owner: { type: Schema.Types.ObjectId, ref: "User", index: true },
      plan: { type: Schema.Types.ObjectId, ref: "Plan", index: true },
      planId: { type: String },
      billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
      billingStatus: {
        type: String,
        enum: ["trialing", "active", "past_due", "suspended", "canceled"],
        default: "trialing",
      },
      suspensionReason: { type: String },
      whatsappConnected: { type: Boolean, default: false },
      bspPhoneNumberId: { type: String },
      wallet: {
        balance: { type: Number, default: 0 },
        parkedBalance: { type: Number, default: 0 },
        currency: { type: String, default: "INR" },
      },
      usage: { type: Schema.Types.Mixed },
      planLimits: { type: Schema.Types.Mixed },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    { strict: false, collection: "workspaces" }
  );

  return WorkspaceSchema;
}
