import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IFAQ {
  workspace: Types.ObjectId;
  question: string;
  answer: string;
  variations: string[];
  status: 'draft' | 'approved';
  source: 'answerbot' | 'manual';
  answerBotSource?: Types.ObjectId;
  
  matchCount: number;
  lastMatchedAt?: Date;
  
  interactive?: {
    type: 'button';
    header?: string;
    body?: string;
    footer?: string;
    buttons: Array<{ id: string; title: string }>;
  };
  
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface IFAQDocument extends IFAQ, Document {}

const FAQSchema = new Schema<IFAQDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  variations: { type: [String], default: [] },
  status: { type: String, enum: ['draft', 'approved'], default: 'draft', index: true },
  source: { type: String, enum: ['answerbot', 'manual'], default: 'answerbot' },
  answerBotSource: { type: Schema.Types.ObjectId, ref: 'AnswerBotSource' },
  
  matchCount: { type: Number, default: 0 },
  lastMatchedAt: Date,
  
  interactive: {
    type: { type: String, enum: ['button'], default: 'button' },
    header: String,
    body: String,
    footer: String,
    buttons: [{ id: String, title: String }]
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: Date
});

FAQSchema.index({ workspace: 1, status: 1 });
FAQSchema.index({ workspace: 1, source: 1 });
FAQSchema.index({ workspace: 1, createdAt: -1 });
FAQSchema.index({ question: 'text', answer: 'text', variations: 'text' });

export const FAQ = (mongoose.models.FAQ as Model<IFAQDocument>) || mongoose.model<IFAQDocument>('FAQ', FAQSchema);
