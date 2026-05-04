/**
 * Activity Log Model
 * Audit trail for all workspace mutations
 */

import { Schema, model, Document } from 'mongoose';

export interface IActivityLog extends Document {
  workspace: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  action: string; // 'create', 'update', 'delete', 'send', etc.
  entityType: string; // 'contact', 'message', 'campaign', etc.
  entityId?: Schema.Types.ObjectId;
  entityName?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  status: 'success' | 'failed';
  errorDetails?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  metadata?: any;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: ['create', 'read', 'update', 'delete', 'send', 'execute', 'login', 'export', 'import'],
      index: true
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        'contact', 'message', 'conversation', 'campaign',
        'automation', 'deal', 'task', 'template', 'integration',
        'workspace', 'user', 'permission', 'settings'
      ],
      index: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      sparse: true,
      index: true
    },
    entityName: String,
    changes: {
      before: Schema.Types.Mixed,
      after: Schema.Types.Mixed
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
      index: true
    },
    errorDetails: String,
    ipAddress: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    metadata: Schema.Types.Mixed
  },
  { timestamps: false }
);

// Indexes for efficient querying
activityLogSchema.index({ workspace: 1, timestamp: -1 });
activityLogSchema.index({ workspace: 1, user: 1, timestamp: -1 });
activityLogSchema.index({ workspace: 1, entityType: 1, timestamp: -1 });
activityLogSchema.index({ workspace: 1, action: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // Auto-delete after 90 days

export const ActivityLog = model<IActivityLog>('ActivityLog', activityLogSchema);
