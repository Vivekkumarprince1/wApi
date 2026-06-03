import type { Schema as SchemaType, Types } from "mongoose";
import type { SchemaCtor } from "../types";

export interface ITemplate {
  workspace?: Types.ObjectId;
  name?: string;
  category?: string;
  language?: string;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Read-only WhatsApp template schema (core DB `templates`). Focused + strict:false. */
export function buildTemplateSchema(Schema: SchemaCtor): SchemaType<ITemplate> {
  return new Schema<ITemplate>(
    {
      workspace: { type: Schema.Types.ObjectId, ref: "Workspace", index: true },
      name: { type: String },
      category: { type: String },
      language: { type: String },
      status: { type: String, index: true },
    },
    { strict: false, collection: "templates", timestamps: true }
  );
}
