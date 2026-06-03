import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAuditLogResource {
  type?: string;
  id?: Types.ObjectId;
  name?: string;
}

export interface IAuditLog {
  workspace: Types.ObjectId;
  user?: Types.ObjectId;
  action: string;
  resource?: IAuditLogResource;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

export interface IAuditLogModel extends Model<IAuditLogDocument> {
  logAdminAction(data: {
    workspaceId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    action: string;
    resource?: IAuditLogResource;
    details?: any;
    req?: any;
  }): Promise<IAuditLogDocument>;
}

const AuditLogSchema = new Schema<IAuditLogDocument, IAuditLogModel>({
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true, index: true },
  resource: {
    type: { type: String },
    id: { type: Schema.Types.ObjectId },
    name: { type: String }
  },
  details: { type: Schema.Types.Mixed },
  ip: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now }
});

AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
AuditLogSchema.index({ workspace: 1, action: 1, createdAt: -1 });

AuditLogSchema.statics.logAdminAction = async function(data: any) {
  const { workspaceId, userId, action, resource, details, req } = data;
  
  let ip = 'unknown';
  let userAgent = 'unknown';
  let finalWorkspaceId = workspaceId;

  if (req) {
    // In Express, headers can be accessed via req.headers or req.get()
    // req.headers.get is not standard Express
    ip = req.headers?.['x-forwarded-for'] || req.ip || 'unknown';
    userAgent = req.headers?.['user-agent'] || 'unknown';
    
    if (!finalWorkspaceId) {
      finalWorkspaceId = req.workspace?._id || req.user?.activeWorkspace || req.user?.workspace;
    }
  }

  // If we still don't have a workspaceId, try to find it from the user
  if (!finalWorkspaceId && userId) {
    try {
      const User = mongoose.model('User');
      const user = await User.findById(userId).select('activeWorkspace workspace');
      finalWorkspaceId = user?.activeWorkspace || user?.workspace;
    } catch (err) {
      console.error("[AuditLog Hardening] Failed to resolve user workspace:", err);
    }
  }

  // Final fallback to a placeholder or global context if strictly required
  // But usually every admin action has a user with a workspace.
  
  return this.create({
    workspace: finalWorkspaceId,
    user: userId,
    action,
    resource,
    details,
    ip,
    userAgent
  });
};

export const AuditLog = (mongoose.models.AuditLog as IAuditLogModel) || mongoose.model<IAuditLogDocument, IAuditLogModel>('AuditLog', AuditLogSchema);
