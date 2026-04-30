import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IWorkflowExecutionAction {
  type?: string;
  status?: 'pending' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
}

export interface IWorkflowExecution {
  workspace: Types.ObjectId;
  workflow: Types.ObjectId;
  
  triggerEvent: {
    type: 'message_received' | 'status_updated' | 'campaign_completed' | 'ad_lead';
    messageId?: Types.ObjectId;
    contactId?: Types.ObjectId;
    campaignId?: Types.ObjectId;
    adId?: Types.ObjectId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any;
  };
  
  idempotencyKey: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  
  actionsExecuted: IWorkflowExecutionAction[];
  
  startedAt?: Date;
  completedAt?: Date;
  delayUntil?: Date;
  
  error?: string;
  errorStack?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: any;
  
  createdAt: Date;
}

export interface IWorkflowExecutionDocument extends IWorkflowExecution, Document {}

const WorkflowExecutionSchema = new Schema<IWorkflowExecutionDocument>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  workflow: { type: Schema.Types.ObjectId, ref: 'AutomationRule', required: true },
  
  triggerEvent: {
    type: { type: String, enum: ['message_received', 'status_updated', 'campaign_completed', 'ad_lead'], required: true },
    messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact' },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    adId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAd' },
    payload: { type: Object }
  },
  
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'skipped'], default: 'pending' },
  
  actionsExecuted: [{
    type: { type: String },
    status: { type: String, enum: ['pending', 'completed', 'failed'] },
    startedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String },
    result: { type: Object }
  }],
  
  startedAt: { type: Date },
  completedAt: { type: Date },
  delayUntil: { type: Date },
  
  error: { type: String },
  errorStack: { type: String },
  
  meta: { type: Object, default: {} },
  
  createdAt: { type: Date, default: Date.now }
});

WorkflowExecutionSchema.index({ workspace: 1, createdAt: -1 });
WorkflowExecutionSchema.index({ workflow: 1, status: 1 });
WorkflowExecutionSchema.index({ status: 1, delayUntil: 1 });
WorkflowExecutionSchema.index({ workspace: 1, status: 1, createdAt: -1 });

export const WorkflowExecution = (mongoose.models.WorkflowExecution as Model<IWorkflowExecutionDocument>) || mongoose.model<IWorkflowExecutionDocument>('WorkflowExecution', WorkflowExecutionSchema);
