import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAgentConversationsMetrics {
  assigned: number;
  reassignedFrom: number;
  reassignedTo: number;
  resolved: number;
  closed: number;
  activeAssigned: number;
}

export interface IAgentResponseMetrics {
  totalReplies: number;
  firstResponses: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  medianResponseTime: number;
  responseTimeBuckets: {
    under1min: number;
    under5min: number;
    under15min: number;
    under1hour: number;
    over1hour: number;
  };
}

export interface IAgentSlaMetrics {
  breaches: number;
  met: number;
  complianceRate: number;
}

export interface IAgentActivityMetrics {
  firstActivityAt?: Date;
  lastActivityAt?: Date;
  activeMinutes: number;
  internalNotesAdded: number;
  tagsAdded: number;
  contactsUpdated: number;
}

export interface IAgentSatisfactionMetrics {
  surveysServed: number;
  responsesReceived: number;
  avgScore: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface IAgentDailyAnalytics {
  workspace: Types.ObjectId;
  agent: Types.ObjectId;
  date: Date;
  conversations: IAgentConversationsMetrics;
  responses: IAgentResponseMetrics;
  sla: IAgentSlaMetrics;
  activity: IAgentActivityMetrics;
  satisfaction: IAgentSatisfactionMetrics;
  computedAt: Date;
}

export interface IAgentDailyAnalyticsDocument extends IAgentDailyAnalytics, Document {}

const AgentDailyAnalyticsSchema = new Schema<IAgentDailyAnalyticsDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  agent: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  
  conversations: {
    assigned: { type: Number, default: 0 },
    reassignedFrom: { type: Number, default: 0 },
    reassignedTo: { type: Number, default: 0 },
    resolved: { type: Number, default: 0 },
    closed: { type: Number, default: 0 },
    activeAssigned: { type: Number, default: 0 }
  },
  
  responses: {
    totalReplies: { type: Number, default: 0 },
    firstResponses: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 },
    minResponseTime: { type: Number, default: 0 },
    maxResponseTime: { type: Number, default: 0 },
    medianResponseTime: { type: Number, default: 0 },
    responseTimeBuckets: {
      under1min: { type: Number, default: 0 },
      under5min: { type: Number, default: 0 },
      under15min: { type: Number, default: 0 },
      under1hour: { type: Number, default: 0 },
      over1hour: { type: Number, default: 0 }
    }
  },
  
  sla: {
    breaches: { type: Number, default: 0 },
    met: { type: Number, default: 0 },
    complianceRate: { type: Number, default: 0 }
  },
  
  activity: {
    firstActivityAt: { type: Date },
    lastActivityAt: { type: Date },
    activeMinutes: { type: Number, default: 0 },
    internalNotesAdded: { type: Number, default: 0 },
    tagsAdded: { type: Number, default: 0 },
    contactsUpdated: { type: Number, default: 0 }
  },
  
  satisfaction: {
    surveysServed: { type: Number, default: 0 },
    responsesReceived: { type: Number, default: 0 },
    avgScore: { type: Number, default: 0 },
    promoters: { type: Number, default: 0 },
    passives: { type: Number, default: 0 },
    detractors: { type: Number, default: 0 }
  },
  
  computedAt: { type: Date, default: Date.now }
});

AgentDailyAnalyticsSchema.index({ workspace: 1, agent: 1, date: 1 }, { unique: true });
AgentDailyAnalyticsSchema.index({ workspace: 1, date: -1 });
AgentDailyAnalyticsSchema.index({ agent: 1, date: -1 });
AgentDailyAnalyticsSchema.index({ workspace: 1, agent: 1, date: -1 });

export const AgentDailyAnalytics = (mongoose.models.AgentDailyAnalytics as Model<IAgentDailyAnalyticsDocument>) || mongoose.model<IAgentDailyAnalyticsDocument>('AgentDailyAnalytics', AgentDailyAnalyticsSchema);
