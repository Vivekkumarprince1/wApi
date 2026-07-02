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
  publisherPlatforms?: string[];
  facebookPositions?: string[];
  instagramPositions?: string[];
  devicePlatforms?: string[];
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
  metaObjective?: string;
  budget: number;
  budgetType: 'DAILY' | 'LIFETIME';
  currency: string;
  bidStrategy?: 'LOWEST_COST_WITHOUT_CAP' | 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP';
  bidAmount?: number;
  billingEvent?: string;
  optimizationGoal?: string;
  destinationType?: string;
  productCatalogId?: string;
  productCatalogName?: string;
  productSetId?: string;
  productSetName?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  imageHash?: string;
  imageUrl?: string;
  carouselCards?: Array<{
    headline?: string;
    description?: string;
    imageHash?: string;
    imageUrl?: string;
    link?: string;
  }>;
  urlTags?: string;
  whatsappPhoneNumber?: string;
  scheduleStart: Date;
  scheduleEnd?: Date;
  isScheduled: boolean;
  targeting: IAdTargeting;
  template?: mongoose.Types.ObjectId;
  templateVariableMapping: any;
  welcomeMessage?: string;
  phoneNumberId: string;
  callToActionType?: string;
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
  reach: number;
  frequency: number;
  clicks: number;
  inlineLinkClicks: number;
  conversions: number;
  results: number;
  ctr: number;
  cpc: number;
  cpm: number;
  costPerResult: number;
  qualityRanking?: string;
  engagementRateRanking?: string;
  conversionRateRanking?: string;
  actionBreakdown?: any[];
  costPerActionType?: any[];
  lastSyncedAt?: Date;
  lastMetaSyncError?: string;
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
  metaObjective: { type: String, default: 'OUTCOME_ENGAGEMENT' },
  budget: { type: Number, required: true },
  budgetType: { type: String, enum: ['DAILY', 'LIFETIME'], default: 'DAILY' },
  currency: { type: String, default: 'USD' },
  bidStrategy: {
    type: String,
    enum: ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP'],
    default: 'LOWEST_COST_WITHOUT_CAP'
  },
  bidAmount: { type: Number },
  billingEvent: { type: String, default: 'IMPRESSIONS' },
  optimizationGoal: { type: String, default: 'CONVERSATIONS' },
  destinationType: { type: String, default: 'WHATSAPP' },
  productCatalogId: { type: String },
  productCatalogName: { type: String },
  productSetId: { type: String },
  productSetName: { type: String },
  primaryText: { type: String },
  headline: { type: String },
  description: { type: String },
  imageHash: { type: String },
  imageUrl: { type: String },
  carouselCards: [{
    headline: String,
    description: String,
    imageHash: String,
    imageUrl: String,
    link: String,
  }],
  urlTags: { type: String },
  whatsappPhoneNumber: { type: String },
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
    excludedAudiences: [{ type: String }],
    publisherPlatforms: [{ type: String }],
    facebookPositions: [{ type: String }],
    instagramPositions: [{ type: String }],
    devicePlatforms: [{ type: String }]
  },
  template: { type: Schema.Types.ObjectId, ref: 'Template' },
  templateVariableMapping: { type: Object, default: {} },
  welcomeMessage: { type: String },
  phoneNumberId: { type: String },
  callToActionType: { type: String, default: 'WHATSAPP_MESSAGE' },
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
  reach: { type: Number, default: 0 },
  frequency: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  inlineLinkClicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  results: { type: Number, default: 0 },
  ctr: { type: Number, default: 0 },
  cpc: { type: Number, default: 0 },
  cpm: { type: Number, default: 0 },
  costPerResult: { type: Number, default: 0 },
  qualityRanking: { type: String },
  engagementRateRanking: { type: String },
  conversionRateRanking: { type: String },
  actionBreakdown: { type: Schema.Types.Mixed },
  costPerActionType: { type: Schema.Types.Mixed },
  lastSyncedAt: { type: Date },
  lastMetaSyncError: { type: String },
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
