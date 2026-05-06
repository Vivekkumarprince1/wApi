import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IConversationMetrics {
  newCount: number;
  reopenedCount: number;
  closedCount: number;
  resolvedCount: number;
  activeCount: number;
  byStatus: {
    open: number;
    pending: number;
    resolved: number;
    closed: number;
    snoozed: number;
  };
  bySource: {
    organic: number;
    campaign: number;
    automation: number;
    widget: number;
    api: number;
  };
}

export interface IResponseTimeMetrics {
  avgFirstResponseTime: number;
  minFirstResponseTime: number;
  maxFirstResponseTime: number;
  medianFirstResponseTime: number;
  conversationsWithResponse: number;
  slaBreachCount: number;
  slaMetCount: number;
  slaComplianceRate: number;
}

export interface IMessageMetrics {
  totalInbound: number;
  totalOutbound: number;
  byType: {
    text: number;
    image: number;
    video: number;
    document: number;
    audio: number;
    template: number;
    interactive: number;
    location: number;
    contacts: number;
    sticker: number;
  };
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
}

export interface IAgentMetrics {
  activeCount: number;
  totalReplies: number;
  avgRepliesPerAgent: number;
  avgResponseTime: number;
}

export interface IBillingMetrics {
  totalBillableConversations: number;
  byCategory: {
    marketing: number;
    utility: number;
    authentication: number;
    service: number;
  };
  businessInitiated: number;
  userInitiated: number;
  templateConversations: number;
}

export interface ICampaignMetrics {
  campaignsRun: number;
  messagesSent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
}

export interface IContactMetrics {
  newContacts: number;
  totalContacts: number;
  optOuts: number;
  optIns: number;
}

export interface IDailyAnalytics {
  workspace: Types.ObjectId;
  date: Date;
  conversations: IConversationMetrics;
  responseTime: IResponseTimeMetrics;
  messages: IMessageMetrics;
  agents: IAgentMetrics;
  billing: IBillingMetrics;
  campaigns: ICampaignMetrics;
  contacts: IContactMetrics;
  computedAt: Date;
  version: number;
}

export interface IDailyAnalyticsDocument extends IDailyAnalytics, Document {}

const DailyAnalyticsSchema = new Schema<IDailyAnalyticsDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  date: { type: Date, required: true },
  
  conversations: {
    newCount: { type: Number, default: 0 },
    reopenedCount: { type: Number, default: 0 },
    closedCount: { type: Number, default: 0 },
    resolvedCount: { type: Number, default: 0 },
    activeCount: { type: Number, default: 0 },
    byStatus: {
      open: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
      resolved: { type: Number, default: 0 },
      closed: { type: Number, default: 0 },
      snoozed: { type: Number, default: 0 }
    },
    bySource: {
      organic: { type: Number, default: 0 },
      campaign: { type: Number, default: 0 },
      automation: { type: Number, default: 0 },
      widget: { type: Number, default: 0 },
      api: { type: Number, default: 0 }
    }
  },
  
  responseTime: {
    avgFirstResponseTime: { type: Number, default: 0 },
    minFirstResponseTime: { type: Number, default: 0 },
    maxFirstResponseTime: { type: Number, default: 0 },
    medianFirstResponseTime: { type: Number, default: 0 },
    conversationsWithResponse: { type: Number, default: 0 },
    slaBreachCount: { type: Number, default: 0 },
    slaMetCount: { type: Number, default: 0 },
    slaComplianceRate: { type: Number, default: 0 }
  },
  
  messages: {
    totalInbound: { type: Number, default: 0 },
    totalOutbound: { type: Number, default: 0 },
    byType: {
      text: { type: Number, default: 0 },
      image: { type: Number, default: 0 },
      video: { type: Number, default: 0 },
      document: { type: Number, default: 0 },
      audio: { type: Number, default: 0 },
      template: { type: Number, default: 0 },
      interactive: { type: Number, default: 0 },
      location: { type: Number, default: 0 },
      contacts: { type: Number, default: 0 },
      sticker: { type: Number, default: 0 }
    },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    deliveryRate: { type: Number, default: 0 },
    readRate: { type: Number, default: 0 }
  },
  
  agents: {
    activeCount: { type: Number, default: 0 },
    totalReplies: { type: Number, default: 0 },
    avgRepliesPerAgent: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 }
  },
  
  billing: {
    totalBillableConversations: { type: Number, default: 0 },
    byCategory: {
      marketing: { type: Number, default: 0 },
      utility: { type: Number, default: 0 },
      authentication: { type: Number, default: 0 },
      service: { type: Number, default: 0 }
    },
    businessInitiated: { type: Number, default: 0 },
    userInitiated: { type: Number, default: 0 },
    templateConversations: { type: Number, default: 0 }
  },
  
  campaigns: {
    campaignsRun: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    replied: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    deliveryRate: { type: Number, default: 0 },
    readRate: { type: Number, default: 0 },
    replyRate: { type: Number, default: 0 }
  },
  
  contacts: {
    newContacts: { type: Number, default: 0 },
    totalContacts: { type: Number, default: 0 },
    optOuts: { type: Number, default: 0 },
    optIns: { type: Number, default: 0 }
  },
  
  computedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 }
});

DailyAnalyticsSchema.index({ workspace: 1, date: 1 }, { unique: true });
DailyAnalyticsSchema.index({ workspace: 1, date: -1 });
DailyAnalyticsSchema.index({ date: 1 });

export const DailyAnalytics = (mongoose.models.DailyAnalytics as Model<IDailyAnalyticsDocument>) || mongoose.model<IDailyAnalyticsDocument>('DailyAnalytics', DailyAnalyticsSchema);
