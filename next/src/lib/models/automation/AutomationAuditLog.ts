import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAutomationActionLog {
  actionType?: string;
  status?: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  error?: string;
  executedAt?: Date;
  duration?: number;
}

export interface IAutomationConditionLog {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condition?: any;
  result?: boolean;
  evaluatedAt?: Date;
}

export interface IAutomationAuditLog {
  workspaceId: Types.ObjectId;
  ruleId: Types.ObjectId;
  executionId: Types.ObjectId;
  
  conversationId: Types.ObjectId;
  contactId: Types.ObjectId;
  
  triggerType: 'conversation.created' | 'customer.message.received' | 'first.agent.reply' | 'conversation.closed' | 'sla.breached';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  triggerMetadata?: any;
  
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'PARTIAL';
  reason?: string;
  errorMessage?: string;
  
  actionsExecuted: IAutomationActionLog[];
  conditionsEvaluated: IAutomationConditionLog[];
  
  rateLimitApplied?: boolean;
  rateLimitReason?: string;
  
  loopDetected?: boolean;
  loopReason?: string;
  
  executedAt: Date;
  duration?: number;
  
  triggeredBy?: Types.ObjectId;
  manualTrigger?: boolean;
  
  retryAttempt: number;
  retriedFromLogId?: Types.ObjectId;
  
  notes?: string;
  expiresAt: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IAutomationAuditLogDocument extends IAutomationAuditLog, Document {}

export interface IAutomationAuditLogModel extends Model<IAutomationAuditLogDocument> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logExecution(data: any): Promise<IAutomationAuditLogDocument>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getLogs(workspaceId: string | Types.ObjectId, options?: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getExecutionStats(workspaceId: string | Types.ObjectId, options?: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFailureAnalysis(workspaceId: string | Types.ObjectId, options?: any): Promise<any>;
}

const AutomationAuditLogSchema = new Schema<IAutomationAuditLogDocument, IAutomationAuditLogModel>({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  ruleId: { type: Schema.Types.ObjectId, ref: 'AutomationRule', required: true, index: true },
  executionId: { type: Schema.Types.ObjectId, ref: 'AutomationExecution', required: true },

  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },

  triggerType: {
    type: String,
    enum: ['conversation.created', 'customer.message.received', 'first.agent.reply', 'conversation.closed', 'sla.breached'],
    required: true,
    index: true
  },
  triggerMetadata: Schema.Types.Mixed,

  status: { type: String, enum: ['SUCCESS', 'SKIPPED', 'FAILED', 'PARTIAL'], required: true, index: true },
  reason: String,
  errorMessage: String,

  actionsExecuted: [{
    actionType: String,
    status: { type: String, enum: ['SUCCESS', 'FAILED', 'SKIPPED'] },
    result: Schema.Types.Mixed,
    error: String,
    executedAt: Date,
    duration: Number
  }],

  conditionsEvaluated: [{
    condition: Schema.Types.Mixed,
    result: Boolean,
    evaluatedAt: Date
  }],

  rateLimitApplied: Boolean,
  rateLimitReason: String,
  loopDetected: Boolean,
  loopReason: String,

  executedAt: { type: Date, default: Date.now, index: true },
  duration: Number,

  triggeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  manualTrigger: Boolean,

  retryAttempt: { type: Number, default: 0 },
  retriedFromLogId: { type: Schema.Types.ObjectId, ref: 'AutomationAuditLog' },

  notes: String,
  expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }
}, {
  timestamps: true,
  collection: 'automationAuditLogs'
});

AutomationAuditLogSchema.index({ workspaceId: 1, createdAt: -1 });
AutomationAuditLogSchema.index({ ruleId: 1, createdAt: -1 });
AutomationAuditLogSchema.index({ conversationId: 1, createdAt: -1 });
AutomationAuditLogSchema.index({ status: 1, createdAt: -1 });
AutomationAuditLogSchema.index({ triggerType: 1, createdAt: -1 });
AutomationAuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

AutomationAuditLogSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
AutomationAuditLogSchema.index({ ruleId: 1, status: 1, createdAt: -1 });
AutomationAuditLogSchema.index({ executedAt: -1 });

// @ts-ignore
AutomationAuditLogSchema.statics.logExecution = async function(data: any) {
  try {
    const log = new this({
      workspaceId: data.workspaceId, ruleId: data.ruleId, executionId: data.executionId,
      conversationId: data.conversationId, contactId: data.contactId, triggerType: data.triggerType,
      triggerMetadata: data.triggerMetadata, status: data.status, reason: data.reason,
      errorMessage: data.errorMessage, actionsExecuted: data.actionsExecuted || [],
      conditionsEvaluated: data.conditionsEvaluated || [], rateLimitApplied: data.rateLimitApplied || false,
      rateLimitReason: data.rateLimitReason, loopDetected: data.loopDetected || false,
      loopReason: data.loopReason, duration: data.duration, triggeredBy: data.triggeredBy,
      manualTrigger: data.manualTrigger || false, notes: data.notes
    });
    await log.save();
    return log;
  } catch (error) {
    console.error('[AutomationAuditLog] Failed to log execution:', error);
    throw error;
  }
};

// @ts-ignore
AutomationAuditLogSchema.statics.getLogs = async function(workspaceId: any, options: any = {}) {
  const { ruleId, conversationId, status, triggerType, startDate, endDate, page = 1, limit = 50, sortBy = 'executedAt' } = options;
  const query: any = { workspaceId };
  if (ruleId) query.ruleId = ruleId;
  if (conversationId) query.conversationId = conversationId;
  if (status) query.status = status;
  if (triggerType) query.triggerType = triggerType;
  if (startDate || endDate) {
    query.executedAt = {};
    if (startDate) query.executedAt.$gte = new Date(startDate);
    if (endDate) query.executedAt.$lte = new Date(endDate);
  }
  const total = await this.countDocuments(query);
  const logs = await this.find(query).sort({ [sortBy]: -1 }).skip((page - 1) * limit).limit(limit).lean();
  return { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

// @ts-ignore
AutomationAuditLogSchema.statics.getExecutionStats = async function(workspaceId: any, options: any = {}) {
  const { ruleId, days = 7 } = options;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const pipeline: any[] = [{ $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId as string), executedAt: { $gte: startDate } } }];
  if (ruleId) {
    pipeline[0].$match.ruleId = new mongoose.Types.ObjectId(ruleId as string);
  }
  pipeline.push({
    $group: { _id: '$status', count: { $sum: 1 }, avgDuration: { $avg: '$duration' }, maxDuration: { $max: '$duration' }, minDuration: { $min: '$duration' } }
  });
  const stats = await this.aggregate(pipeline);
  return {
    period: { startDate, endDate: new Date(), days },
    byStatus: stats.reduce((acc: any, s: any) => {
      acc[s._id] = { count: s.count, avgDuration: Math.round(s.avgDuration || 0), maxDuration: s.maxDuration, minDuration: s.minDuration };
      return acc;
    }, {})
  };
};

// @ts-ignore
AutomationAuditLogSchema.statics.getFailureAnalysis = async function(workspaceId: any, options: any = {}) {
  const { ruleId, days = 7 } = options;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const query: any = { workspaceId, status: { $in: ['FAILED', 'PARTIAL'] }, executedAt: { $gte: startDate } };
  if (ruleId) query.ruleId = ruleId;
  const failures = await this.find(query).lean();
  const analysis: any = { totalFailures: failures.length, byReason: {}, byErrorMessage: {}, recentFailures: failures.slice(0, 10) };
  for (const failure of failures) {
    if (failure.reason) analysis.byReason[failure.reason] = (analysis.byReason[failure.reason] || 0) + 1;
    if (failure.errorMessage) analysis.byErrorMessage[failure.errorMessage] = (analysis.byErrorMessage[failure.errorMessage] || 0) + 1;
  }
  return analysis;
};

export const AutomationAuditLog = (mongoose.models.AutomationAuditLog as IAutomationAuditLogModel) || mongoose.model<IAutomationAuditLogDocument, IAutomationAuditLogModel>('AutomationAuditLog', AutomationAuditLogSchema);
