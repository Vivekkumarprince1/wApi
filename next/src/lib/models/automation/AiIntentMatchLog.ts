import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAiIntentMatchLog {
  workspace: Types.ObjectId;
  queryText: string;
  matchedRule: Types.ObjectId;
  confidence: number;
  conversation?: Types.ObjectId;
  contact?: Types.ObjectId;
  aiMetadata?: {
    model?: string;
    intentDetected?: string;
    reasoning?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IAiIntentMatchLogDocument extends IAiIntentMatchLog, Document {}

const AiIntentMatchLogSchema = new Schema<IAiIntentMatchLogDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  queryText: { type: String, required: true },
  matchedRule: { type: Schema.Types.ObjectId, ref: 'AutomationRule', required: true },
  confidence: { type: Number, default: 1.0 },
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact' },
  aiMetadata: {
    model: String,
    intentDetected: String,
    reasoning: String
  }
}, { timestamps: true });

AiIntentMatchLogSchema.index({ workspace: 1, createdAt: -1 });

export const AiIntentMatchLog = (mongoose.models.AiIntentMatchLog as Model<IAiIntentMatchLogDocument>) || mongoose.model<IAiIntentMatchLogDocument>('AiIntentMatchLog', AiIntentMatchLogSchema);
