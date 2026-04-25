import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAnswerBotSettings {
  workspace: Types.ObjectId;
  enabled: boolean;
  personaName: string;
  systemPrompt: string;
  aiModel: 'gpt-3.5-turbo' | 'gpt-4' | 'claude-3-haiku';
  confidenceThreshold: number;
  fallbackAction: 'assign_to_agent' | 'send_fallback_message';
  fallbackMessage: string;
  fallbackAgentId?: Types.ObjectId;
  allowedChannels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnswerBotSettingsDocument extends IAnswerBotSettings, Document {}

const AnswerBotSettingsSchema = new Schema<IAnswerBotSettingsDocument>({
  workspace: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true,
    index: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  personaName: {
    type: String,
    default: 'Smart Assistant'
  },
  systemPrompt: {
    type: String,
    default: 'You are a helpful customer support assistant. Only use the provided Knowledge Base to answer questions.'
  },
  aiModel: {
    type: String,
    enum: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-haiku'],
    default: 'gpt-3.5-turbo'
  },
  confidenceThreshold: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.65
  },
  fallbackAction: {
    type: String,
    enum: ['assign_to_agent', 'send_fallback_message'],
    default: 'send_fallback_message'
  },
  fallbackMessage: {
    type: String,
    default: "I'm sorry, I couldn't find the answer to your question. Let me connect you with a team member."
  },
  fallbackAgentId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  allowedChannels: {
    type: [String],
    default: ['whatsapp', 'instagram']
  }
}, {
  timestamps: true
});

export const AnswerBotSettings: Model<IAnswerBotSettingsDocument> = (mongoose.models.AnswerBotSettings as Model<IAnswerBotSettingsDocument>) || mongoose.model<IAnswerBotSettingsDocument>('AnswerBotSettings', AnswerBotSettingsSchema);
