import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type ConversationCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE';
export type ConversationInitiator = 'BUSINESS' | 'USER';
export type ConversationSource = 'CAMPAIGN' | 'INBOX' | 'API' | 'AUTOMATION' | 'ANSWERBOT';

export interface IConversationLedger {
  workspace: Types.ObjectId;
  conversation: Types.ObjectId;
  contact: Types.ObjectId;
  phoneNumber: string;

  category: ConversationCategory;
  initiatedBy: ConversationInitiator;
  source: ConversationSource;

  startedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  closedAt?: Date;

  billable: boolean;
  billed: boolean;
  invoiceId?: string;
  billingPeriod?: string;

  template?: Types.ObjectId;
  templateName?: string;
  templateCategory?: string;

  firstMessageId?: Types.ObjectId;
  messageCount: number;
  businessMessageCount: number;
  userMessageCount: number;
  lastMessageAt?: Date;

  campaign?: Types.ObjectId;
  campaignName?: string;

  initiatedByUser?: Types.ObjectId;

  whatsappMessageId?: string;
  metaConversationId?: string;
  metaPricingType?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metaBillingData?: any;

  createdAt: Date;
  updatedAt: Date;
  notes?: string;
}

export interface IConversationLedgerDocument extends IConversationLedger, Document {
  isWindowActive(): boolean;
  recordMessage(direction: 'inbound' | 'outbound'): Promise<IConversationLedgerDocument>;
  closeWindow(): Promise<IConversationLedgerDocument>;
}

export interface IConversationLedgerModel extends Model<IConversationLedgerDocument> {
  findActiveWindow(workspaceId: string | Types.ObjectId, contactId: string | Types.ObjectId): Promise<IConversationLedgerDocument | null>;
  getBillingSummary(workspaceId: string | Types.ObjectId, startDate: Date | string, endDate: Date | string): Promise<any>;
  getMonthlyUsage(workspaceId: string | Types.ObjectId, year: number | string, month: number | string): Promise<any>;
}

const ConversationLedgerSchema = new Schema<IConversationLedgerDocument, IConversationLedgerModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  phoneNumber: { type: String, required: true, index: true },

  category: { type: String, enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'], required: true, index: true },
  initiatedBy: { type: String, enum: ['BUSINESS', 'USER'], required: true, index: true },
  source: { type: String, enum: ['CAMPAIGN', 'INBOX', 'API', 'AUTOMATION', 'ANSWERBOT'], required: true, index: true },

  startedAt: { type: Date, required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  closedAt: { type: Date },

  billable: { type: Boolean, default: true, index: true },
  billed: { type: Boolean, default: false },
  invoiceId: { type: String },
  billingPeriod: { type: String, index: true },

  template: { type: Schema.Types.ObjectId, ref: 'Template' },
  templateName: { type: String },
  templateCategory: { type: String },

  firstMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
  messageCount: { type: Number, default: 1 },
  businessMessageCount: { type: Number, default: 0 },
  userMessageCount: { type: Number, default: 0 },
  lastMessageAt: { type: Date },

  campaign: { type: Schema.Types.ObjectId, ref: 'Campaign' },
  campaignName: { type: String },

  initiatedByUser: { type: Schema.Types.ObjectId, ref: 'User' },

  whatsappMessageId: { type: String },
  metaConversationId: { type: String },
  metaPricingType: { type: String },
  metaBillingData: { type: Schema.Types.Mixed },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  notes: { type: String }
}, { timestamps: true });

ConversationLedgerSchema.index({ workspace: 1, contact: 1, category: 1, isActive: 1, expiresAt: 1 });
ConversationLedgerSchema.index({ workspace: 1, billingPeriod: 1, category: 1, billable: 1 });
ConversationLedgerSchema.index({ workspace: 1, startedAt: 1, category: 1 });
ConversationLedgerSchema.index({ workspace: 1, campaign: 1, billable: 1 });
ConversationLedgerSchema.index({ workspace: 1, source: 1, startedAt: 1 });

ConversationLedgerSchema.statics.findActiveWindow = async function(workspaceId, contactId) {
  return this.findOne({
    workspace: workspaceId,
    contact: contactId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ startedAt: -1 });
};

ConversationLedgerSchema.statics.getBillingSummary = async function(workspaceId, startDate, endDate) {
  return this.aggregate([
    { $match: { workspace: new mongoose.Types.ObjectId(workspaceId as string), startedAt: { $gte: new Date(startDate), $lte: new Date(endDate) }, billable: true } },
    { $group: { _id: '$category', count: { $sum: 1 }, totalMessages: { $sum: '$messageCount' } } },
    { $project: { category: '$_id', count: 1, totalMessages: 1, _id: 0 } }
  ]);
};

ConversationLedgerSchema.statics.getMonthlyUsage = async function(workspaceId, year, month) {
  const billingPeriod = `${year}-${String(month).padStart(2, '0')}`;
  return this.aggregate([
    { $match: { workspace: new mongoose.Types.ObjectId(workspaceId as string), billingPeriod, billable: true } },
    { $group: { _id: { category: '$category', initiatedBy: '$initiatedBy' }, count: { $sum: 1 } } },
    { $group: { _id: null, total: { $sum: '$count' }, breakdown: { $push: { category: '$_id.category', initiatedBy: '$_id.initiatedBy', count: '$count' } } } }
  ]);
};

ConversationLedgerSchema.methods.isWindowActive = function(this: IConversationLedgerDocument) {
  return this.isActive && this.expiresAt > new Date();
};

ConversationLedgerSchema.methods.recordMessage = function(this: IConversationLedgerDocument, direction: 'inbound' | 'outbound') {
  this.messageCount += 1;
  this.lastMessageAt = new Date();
  if (direction === 'outbound') this.businessMessageCount += 1;
  else this.userMessageCount += 1;
  return this.save();
};

ConversationLedgerSchema.methods.closeWindow = function(this: IConversationLedgerDocument) {
  this.isActive = false;
  this.closedAt = new Date();
  return this.save();
};

ConversationLedgerSchema.pre<IConversationLedgerDocument>('save', function() {
  if (this.startedAt && !this.expiresAt) {
    this.expiresAt = new Date(this.startedAt.getTime() + 24 * 60 * 60 * 1000);
  }
  if (this.startedAt && !this.billingPeriod) {
    const date = new Date(this.startedAt);
    this.billingPeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  if (this.expiresAt && new Date() > this.expiresAt) {
    this.isActive = false;
    if (!this.closedAt) this.closedAt = this.expiresAt;
  }
  this.updatedAt = new Date();
  
});

export const ConversationLedger = (mongoose.models.ConversationLedger as IConversationLedgerModel) || mongoose.model<IConversationLedgerDocument, IConversationLedgerModel>('ConversationLedger', ConversationLedgerSchema);
