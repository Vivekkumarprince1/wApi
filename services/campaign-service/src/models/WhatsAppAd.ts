import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAdTargeting {
  ageMin: number;
  ageMax: number;
  genders: Array<'MALE' | 'FEMALE' | 'ALL'>;
  countries: string[];
  languages: string[];
  interests: string[];
  behaviors: string[];
  customAudiences: string[];
  lookalikeLevels: number[];
  excludedAudiences: string[];
}

export interface IAdApiLog {
  timestamp: Date;
  action?: string;
  request?: any;
  response?: any;
  error?: string;
  metaRequestId?: string;
}

export interface IWhatsAppAd extends Document {
  workspace: mongoose.Types.ObjectId;
  name: string;
  objective: 'MESSAGES';
  metaCampaignId?: string;
  metaAdSetId?: string;
  metaAdCreativeId?: string;
  metaAdId?: string;
  budget: number;
  currency: string;
  scheduleStart: Date;
  scheduleEnd?: Date;
  isScheduled: boolean;
  targeting: IAdTargeting;
  template: mongoose.Types.ObjectId;
  templateVariableMapping: any;
  welcomeMessage?: string;
  phoneNumberId: string;
  ctaText: string;
  displayFormat: 'TEXT' | 'CAROUSEL';
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'rejected' | 'completed' | 'error';
  metaStatus?: string;
  metaStatusUpdatedAt?: Date;
  pausedReason?: string;
  pausedAt?: Date;
  pausedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  rejectedAt?: Date;
  rejectionDetails?: any;
  spentAmount: number;
  spentAmountUpdatedAt?: Date;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  metaApiLogs: IAdApiLog[];
}

const WhatsAppAdSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  name: { type: String, required: true },
  objective: { type: String, enum: ['MESSAGES'], default: 'MESSAGES' },
  metaCampaignId: { type: String },
  metaAdSetId: { type: String },
  metaAdCreativeId: { type: String },
  metaAdId: { type: String },
  budget: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  scheduleStart: { type: Date, required: true },
  scheduleEnd: { type: Date },
  isScheduled: { type: Boolean, default: false },
  targeting: {
    ageMin: { type: Number, default: 18 },
    ageMax: { type: Number, default: 65 },
    genders: [{ type: String, enum: ['MALE', 'FEMALE', 'ALL'] }],
    countries: [{ type: String }],
    languages: [{ type: String }],
    interests: [{ type: String }],
    behaviors: [{ type: String }],
    customAudiences: [{ type: String }],
    lookalikeLevels: [{ type: Number }],
    excludedAudiences: [{ type: String }]
  },
  template: { type: Schema.Types.ObjectId, ref: 'Template', required: true },
  templateVariableMapping: { type: Object, default: {} },
  welcomeMessage: { type: String },
  phoneNumberId: { type: String, required: true },
  ctaText: { type: String, default: 'Message us' },
  displayFormat: { type: String, enum: ['TEXT', 'CAROUSEL'], default: 'TEXT' },
  status: { 
    type: String, 
    enum: ['draft', 'pending_review', 'active', 'paused', 'rejected', 'completed', 'error'], 
    default: 'draft' 
  },
  metaStatus: { type: String },
  metaStatusUpdatedAt: { type: Date },
  pausedReason: { type: String },
  pausedAt: { type: Date },
  pausedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String },
  rejectedAt: { type: Date },
  rejectionDetails: { type: Object },
  spentAmount: { type: Number, default: 0 },
  spentAmountUpdatedAt: { type: Date },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  ctr: { type: Number, default: 0 },
  cpc: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  metaApiLogs: [{
    timestamp: { type: Date, default: Date.now },
    action: String,
    request: Schema.Types.Mixed,
    response: Schema.Types.Mixed,
    error: String,
    metaRequestId: String
  }]
}, { timestamps: true });

export const WhatsAppAd: Model<IWhatsAppAd> = (mongoose.models.WhatsAppAd as any) || mongoose.model<IWhatsAppAd>('WhatsAppAd', WhatsAppAdSchema);
