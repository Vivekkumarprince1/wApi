import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * AUTOMATION RULE - Stage 7 (Visual Workflows)
 */

export interface ICondition {
  field: string;
  operator: string;
  value?: any;
  logicalOperator: 'AND' | 'OR';
}

export interface ITrigger {
  event: string;
  type?: string;
  config?: Record<string, any>;
  filters?: {
    channel?: 'whatsapp' | 'instagram' | 'all';
    messageTypes?: string[];
    keywords?: string[];
    keywordMatchMode?: 'exact' | 'contains' | 'starts_with';
    requiredTags?: string[];
    excludeTags?: string[];
    source?: 'organic' | 'campaign' | 'ads' | 'api' | 'all';
    businessHoursOnly?: boolean;
  };
}

export interface IAction {
  type: string;
  config: Record<string, any>;
  order: number;
  continueOnFailure: boolean;
}

export interface IRateLimit {
  maxExecutions: number;
  windowSeconds: number;
  perContactCooldown: number;
  perConversationCooldown: number;
  maxPerContactPerDay: number;
}

export interface IAutomationRule extends Document {
  workspace: mongoose.Types.ObjectId;
  name: string;
  category: 'workflow' | 'auto_reply';
  description?: string;
  enabled: boolean;
  priority: number;
  trigger?: ITrigger;
  conditions: ICondition[];
  actions: IAction[];
  flowConfig: {
    nodes: any[];
    edges: any[];
    viewport: { x: number; y: number; zoom: number };
  };
  rateLimit: IRateLimit;
  currentWindowCount: number;
  currentWindowStart?: Date;
  stats: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    skippedExecutions: number;
    lastExecutedAt?: Date;
  };
  deletedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConditionSchema = new Schema({
  field: { type: String, required: true },
  operator: { type: String, required: true },
  value: Schema.Types.Mixed,
  logicalOperator: { type: String, enum: ['AND', 'OR'], default: 'AND' }
}, { _id: false });

const TriggerSchema = new Schema({
  event: { type: String, required: true },
  type: { type: String },
  config: { type: Schema.Types.Mixed },
  filters: {
    channel: { type: String, default: 'all' },
    messageTypes: [String],
    keywords: [String],
    keywordMatchMode: { type: String, default: 'contains' },
    requiredTags: [String],
    excludeTags: [String],
    source: { type: String, default: 'all' },
    businessHoursOnly: { type: Boolean, default: false }
  }
}, { _id: false });

const ActionSchema = new Schema({
  type: { type: String, required: true },
  config: { type: Schema.Types.Mixed, default: {} },
  order: { type: Number, default: 0 },
  continueOnFailure: { type: Boolean, default: true }
}, { _id: false });

const AutomationRuleSchema: Schema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: ['workflow', 'auto_reply'], default: 'workflow', index: true },
  description: { type: String },
  enabled: { type: Boolean, default: true, index: true },
  priority: { type: Number, default: 0 },
  trigger: TriggerSchema,
  conditions: [ConditionSchema],
  actions: [ActionSchema],
  flowConfig: {
    nodes: { type: [Schema.Types.Mixed as any], default: [] },
    edges: { type: [Schema.Types.Mixed as any], default: [] },
    viewport: { type: Object, default: { x: 0, y: 0, zoom: 1 } }
  },
  rateLimit: {
    maxExecutions: { type: Number, default: 0 },
    windowSeconds: { type: Number, default: 0 },
    perContactCooldown: { type: Number, default: 0 },
    perConversationCooldown: { type: Number, default: 0 },
    maxPerContactPerDay: { type: Number, default: 0 }
  },
  currentWindowCount: { type: Number, default: 0 },
  currentWindowStart: { type: Date },
  stats: {
    totalExecutions: { type: Number, default: 0 },
    successfulExecutions: { type: Number, default: 0 },
    failedExecutions: { type: Number, default: 0 },
    skippedExecutions: { type: Number, default: 0 },
    lastExecutedAt: Date
  },
  deletedAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Optimized index for rule evaluation
AutomationRuleSchema.index({ workspace: 1, enabled: 1, 'trigger.event': 1, deletedAt: 1 });

export const AutomationRule: Model<IAutomationRule> = mongoose.models.AutomationRule || mongoose.model<IAutomationRule>('AutomationRule', AutomationRuleSchema);
