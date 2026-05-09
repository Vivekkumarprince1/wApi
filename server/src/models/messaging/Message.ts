import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-SCHEMAS & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface IMessageTemplate {
  id?: Types.ObjectId;
  name?: string;
  metaTemplateName?: string;
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language?: string;
  variables?: {
    header: string[];
    body: string[];
    buttons: string[];
  };
  header?: {
    format?: string;
    text?: string;
    mediaUrl?: string;
    mediaId?: string;
  };
  buttons?: Array<{
    type?: string;
    text?: string;
    url?: string;
    phoneNumber?: string;
  }>;
}

export interface IConversationBilling {
  category?: 'marketing_conversation' | 'utility_conversation' | 'authentication_conversation' | 'service_conversation';
  windowStart?: Date;
  windowEnd?: Date;
  isNewConversation: boolean;
  pricingModel?: string;
  estimatedCost?: number;
}

export interface IMessageMedia {
  id?: string;
  url?: string;
  mimeType?: string;
  filename?: string;
  fileSize?: number;
  sha256?: string;
  caption?: string;
}

export interface IMessageCampaign {
  id?: Types.ObjectId;
  name?: string;
  batchId?: string;
}

export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'template' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'location' | 'contacts' | 'interactive' | 'reaction' | 'note' | 'payment' | 'pix' | 'boleto' | 'email' | 'sms';
export type MessageStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received' | 'unknown';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MESSAGE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

export interface IMessage {
  workspace: Types.ObjectId;
  contact?: Types.ObjectId;
  conversation?: Types.ObjectId;
  
  sentBy?: Types.ObjectId;
  direction: MessageDirection;
  type: MessageType;
  body?: string;
  isInternalNote: boolean;

  status: MessageStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  failureReason?: string;

  whatsappMessageId?: string;
  whatsappConversationId?: string;

  template?: IMessageTemplate;
  conversationBilling?: IConversationBilling;
  media?: IMessageMedia;
  campaign?: IMessageCampaign;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any;
  recipientPhone?: string;
  
  // Email specific
  subject?: string;
  emailHtml?: string;
  snippet?: string;

  createdAt: Date;
  updatedAt?: Date;
}

export interface IMessageDocument extends IMessage, Document {
  updateStatus(newStatus: MessageStatus, timestamp?: number): Promise<IMessageDocument>;
  isInConversationWindow(): boolean;
}

export interface IMessageModel extends Model<IMessageDocument> {
  findByWhatsAppId(wamid: string): Promise<IMessageDocument | null>;
  getConversationHistory(workspaceId: string | Types.ObjectId, contactId: string | Types.ObjectId, options?: { limit?: number; before?: Date; after?: Date }): Promise<IMessage[]>;
  getTemplateStats(workspaceId: string | Types.ObjectId, startDate?: Date, endDate?: Date): Promise<any[]>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONGOOSE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

const MessageSchema = new Schema<IMessageDocument, IMessageModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', index: true },
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
  
  sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true, index: true },
  type: { 
    type: String, 
    enum: ['text', 'template', 'image', 'video', 'document', 'audio', 'sticker', 'location', 'contacts', 'interactive', 'reaction', 'note', 'payment', 'pix', 'boleto', 'email', 'sms'], 
    default: 'text', 
    index: true 
  },
  body: { type: String },
  isInternalNote: { type: Boolean, default: false, index: true },

  status: { 
    type: String, 
    enum: ['queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'received', 'unknown'], 
    default: (doc: any) => {
      // Inbound messages default to 'received', outbound to 'queued'
      return doc.direction === 'inbound' ? 'received' : 'queued';
    },
    index: true 
  },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  failureReason: { type: String },

  whatsappMessageId: { type: String, index: true },
  whatsappConversationId: { type: String },

  template: {
    id: { type: Schema.Types.ObjectId, ref: 'Template' },
    name: { type: String },
    metaTemplateName: { type: String },
    category: { type: String, enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'] },
    language: { type: String },
    variables: {
      header: [String],
      body: [String],
      buttons: [String]
    },
    header: {
      format: { type: String },
      text: { type: String },
      mediaUrl: { type: String },
      mediaId: { type: String }
    },
    buttons: [{
      type: { type: String },
      text: { type: String },
      url: { type: String },
      phoneNumber: { type: String }
    }]
  },

  conversationBilling: {
    category: { type: String, enum: ['marketing_conversation', 'utility_conversation', 'authentication_conversation', 'service_conversation'] },
    windowStart: { type: Date },
    windowEnd: { type: Date },
    isNewConversation: { type: Boolean, default: false },
    pricingModel: { type: String },
    estimatedCost: { type: Number }
  },

  media: {
    id: { type: String },
    url: { type: String },
    mimeType: { type: String },
    filename: { type: String },
    fileSize: { type: Number },
    sha256: { type: String },
    caption: { type: String }
  },

  campaign: {
    id: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    name: { type: String },
    batchId: { type: String }
  },

  meta: { type: Schema.Types.Mixed, default: {} },
  recipientPhone: { type: String, index: true },

  // Email specific
  subject: { type: String },
  emailHtml: { type: String },
  snippet: { type: String },

  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

// Middleware
MessageSchema.pre<IMessageDocument>('save', function () {
  this.updatedAt = new Date();
});

// Indexes
MessageSchema.index({ workspace: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, contact: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, conversation: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, type: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, 'template.category': 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, whatsappMessageId: 1 }, { unique: true, sparse: true });
MessageSchema.index({ workspace: 1, direction: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, status: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, 'campaign.id': 1 });
MessageSchema.index({ workspace: 1, body: 'text' });
MessageSchema.methods.updateStatus = async function (this: IMessageDocument, newStatus: MessageStatus, timestamp?: number) {
  this.status = newStatus;
  const now = timestamp ? new Date(timestamp * 1000) : new Date();

  switch (newStatus) {
    case 'sent':
      this.sentAt = this.sentAt || now;
      break;
    case 'delivered':
      this.deliveredAt = now;
      break;
    case 'read':
      this.readAt = now;
      break;
    case 'failed':
      this.failedAt = now;
      break;
  }
  return this.save();
};

MessageSchema.methods.isInConversationWindow = function (this: IMessageDocument) {
  if (!this.conversationBilling?.windowEnd) return false;
  return new Date() < this.conversationBilling.windowEnd;
};

// Statics
MessageSchema.statics.findByWhatsAppId = function (wamid: string) {
  return this.findOne({ whatsappMessageId: wamid });
};

MessageSchema.statics.getConversationHistory = function (workspaceId: string | Types.ObjectId, contactId: string | Types.ObjectId, options: any = {}) {
  const { limit = 50, before, after } = options;
  const query: any = { workspace: workspaceId, contact: contactId };

  if (before) query.createdAt = { $lt: new Date(before) };
  if (after) query.createdAt = { ...query.createdAt, $gt: new Date(after) };

  return this.find(query).sort({ createdAt: -1 }).limit(limit).lean();
};

MessageSchema.statics.getTemplateStats = function (workspaceId: string | Types.ObjectId, startDate?: Date, endDate?: Date) {
  const match: any = {
    workspace: workspaceId,
    type: 'template',
    direction: 'outbound'
  };

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: { category: '$template.category', status: '$status' },
        count: { $sum: 1 }
      }
    }
  ]);
};

export const Message = (mongoose.models.Message as IMessageModel) || mongoose.model<IMessageDocument, IMessageModel>('Message', MessageSchema);
