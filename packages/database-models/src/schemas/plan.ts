import type { Schema as SchemaType } from "mongoose";
import type { SchemaCtor } from "../types";

export interface IPlan {
  name: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
  pricing?: Record<string, unknown>;
  features?: string[];
  limits?: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

/** Focused billing Plan schema. strict:false preserves owner-service fields. */
export function buildPlanSchema(Schema: SchemaCtor): SchemaType<IPlan> {
  return new Schema<IPlan>(
    {
      name: { type: String, required: true },
      slug: { type: String, index: true },
      description: { type: String },
      isActive: { type: Boolean, default: true },
      pricing: { type: Schema.Types.Mixed },
      features: [{ type: String }],
      limits: { type: Schema.Types.Mixed },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    { strict: false, collection: "plans" }
  );
}
