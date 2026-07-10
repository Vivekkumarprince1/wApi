import type { Schema as SchemaType, Types } from "mongoose";
import type { SchemaCtor } from "../types";

/* Read-only schemas for the campaign (wa_campaigns) and automation
 * (connectsphere_automation) databases. Focused + strict:false. */

export interface ICampaign {
  workspace: Types.ObjectId;
  name?: string;
  status?: string;
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function buildCampaignSchema(Schema: SchemaCtor): SchemaType<ICampaign> {
  return new Schema<ICampaign>(
    {
      workspace: { type: Schema.Types.ObjectId, index: true },
      name: { type: String },
      status: { type: String, index: true },
      scheduledAt: { type: Date },
    },
    { strict: false, collection: "campaigns", timestamps: true }
  );
}

export interface IAutomationRule {
  workspace: Types.ObjectId;
  name?: string;
  enabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function buildAutomationRuleSchema(Schema: SchemaCtor): SchemaType<IAutomationRule> {
  return new Schema<IAutomationRule>(
    {
      workspace: { type: Schema.Types.ObjectId, index: true },
      name: { type: String },
      enabled: { type: Boolean, index: true },
    },
    { strict: false, collection: "automationrules", timestamps: true }
  );
}
