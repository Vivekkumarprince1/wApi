import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * AUTOMATION EXECUTION LOG - Stage 7
 */

export interface IActionResult {
  actionType: string;
  actionIndex: number;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  error?: string;
  result?: any;
  durationMs?: number;
  executedAt: Date;
}

export interface IAutomationExecution extends Document {
  rule: mongoose.Types.ObjectId;
  ruleName: string;
  workspace: mongoose.Types.ObjectId;
  triggerEvent: string;
  conversation?: mongoose.Types.ObjectId;
  contact?: mongoose.Types.ObjectId;
  message?: mongoose.Types.ObjectId;
  status: 'PENDING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  skipReason?: string;
  skipDetails?: string;
  failureReason?: string;
  failureDetails?: string;
  actionResults: IActionResult[];
  actionsExecuted: number;
  actionsSucceeded: number;
  actionsFailed: number;
  contextSnapshot?: any;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  isDryRun: boolean;
  triggeredBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IActionResultSchema = new Schema({
  actionType: { type: String, required: true },
  actionIndex: { type: Number, required: true },
  status: { type: String, enum: ['SUCCESS', 'FAILED', 'SKIPPED'], required: true },
  error: String,
  result: Schema.Types.Mixed,
  durationMs: Number,
  executedAt: { type: Date, default: Date.now }
}, { _id: false });

const AutomationExecutionSchema: Schema = new Schema({
  rule: { type: Schema.Types.ObjectId, ref: 'AutomationRule', required: true, index: true },
  ruleName: { type: String, required: true },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  triggerEvent: { type: String, required: true },
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
  contact: { type: Schema.Types.ObjectId, ref: 'Contact', index: true },
  message: { type: Schema.Types.ObjectId, ref: 'Message' },
  status: { type: String, enum: ['PENDING', 'SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED'], required: true, index: true },
  skipReason: { type: String },
  skipDetails: { type: String },
  failureReason: { type: String },
  failureDetails: { type: String },
  actionResults: [IActionResultSchema],
  actionsExecuted: { type: Number, default: 0 },
  actionsSucceeded: { type: Number, default: 0 },
  actionsFailed: { type: Number, default: 0 },
  contextSnapshot: Schema.Types.Mixed,
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  durationMs: Number,
  isDryRun: { type: Boolean, default: false },
  triggeredBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-delete logs after 90 days
AutomationExecutionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
AutomationExecutionSchema.index({ workspace: 1, createdAt: -1 });

export const AutomationExecution: Model<IAutomationExecution> = mongoose.models.AutomationExecution || mongoose.model<IAutomationExecution>('AutomationExecution', AutomationExecutionSchema);
