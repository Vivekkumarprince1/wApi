import type { Schema as SchemaType } from "mongoose";
import type { SchemaCtor } from "../types";

export interface IWebhookPolicy {
  name?: string;
  events?: string[];
  url?: string;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Webhook delivery policy (core DB `webhookpolicies`). strict:false. */
export function buildWebhookPolicySchema(Schema: SchemaCtor): SchemaType<IWebhookPolicy> {
  return new Schema<IWebhookPolicy>(
    {
      name: { type: String },
      events: [{ type: String }],
      url: { type: String },
      isActive: { type: Boolean, default: true },
    },
    { strict: false, collection: "webhookpolicies", timestamps: true }
  );
}
