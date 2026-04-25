import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICampaignSummary {
  workspace: Types.ObjectId;
  date: Date;
  
  campaignsInitiated: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesRead: number;
  messagesFailed: number;
  
  estimatedCost: number;
  
  updatedAt: Date;
}

export interface ICampaignSummaryDocument extends ICampaignSummary, Document {}

const CampaignSummarySchema = new Schema<ICampaignSummaryDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  date: { type: Date, required: true },
  
  campaignsInitiated: { type: Number, default: 0 },
  messagesSent: { type: Number, default: 0 },
  messagesDelivered: { type: Number, default: 0 },
  messagesRead: { type: Number, default: 0 },
  messagesFailed: { type: Number, default: 0 },
  
  estimatedCost: { type: Number, default: 0 },
  
  updatedAt: { type: Date, default: Date.now }
});

CampaignSummarySchema.index({ workspace: 1, date: -1 }, { unique: true });

CampaignSummarySchema.pre<ICampaignSummaryDocument>('save', function() {
  this.updatedAt = new Date();
  
});

export const CampaignSummary = (mongoose.models.CampaignSummary as Model<ICampaignSummaryDocument>) || mongoose.model<ICampaignSummaryDocument>('CampaignSummary', CampaignSummarySchema);
