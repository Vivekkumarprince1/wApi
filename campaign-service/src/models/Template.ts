import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ITemplate {
  workspace: Types.ObjectId;
  name: string;
  category: string;
  language: string;
  status: string;
  components?: any[];
  metaTemplateName?: string;
}

export interface ITemplateDocument extends ITemplate, Document {}

const TemplateSchema = new Schema<ITemplateDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true },
  category: { type: String },
  language: { type: String },
  status: { type: String },
  components: [Schema.Types.Mixed],
  metaTemplateName: { type: String }
}, { collection: 'templates' });

export const Template = mongoose.models.Template || mongoose.model<ITemplateDocument>('Template', TemplateSchema);
