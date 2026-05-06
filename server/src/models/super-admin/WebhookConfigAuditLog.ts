import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import type { NextRequest } from 'next/server';

export type WebhookAuditScope = 'global' | 'workspace' | 'app' | 'subscription';

export interface IWebhookConfigAuditLog {
  scope: WebhookAuditScope;
  action: string;
  actor: Types.ObjectId;
  actorRole: string;
  workspace?: Types.ObjectId;
  appId?: string;
  subscriptionId?: string;
  changeSet?: Record<string, unknown>;
  before?: any;
  after?: any;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  createdAt: Date;
}

export interface IWebhookConfigAuditLogDocument extends IWebhookConfigAuditLog, Document {}

export interface IWebhookConfigAuditLogModel extends Model<IWebhookConfigAuditLogDocument> {
  logChange(input: {
    scope: WebhookAuditScope;
    action: string;
    actorId: string | Types.ObjectId;
    actorRole: string;
    workspaceId?: string | Types.ObjectId;
    appId?: string;
    subscriptionId?: string;
    changeSet?: Record<string, unknown>;
    before?: any;
    after?: any;
    req?: NextRequest;
  }): Promise<IWebhookConfigAuditLogDocument>;
}

const WebhookConfigAuditLogSchema = new Schema<IWebhookConfigAuditLogDocument, IWebhookConfigAuditLogModel>({
  scope: {
    type: String,
    enum: ['global', 'workspace', 'app', 'subscription'],
    required: true,
    index: true
  },
  action: { type: String, required: true, index: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorRole: { type: String, required: true },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
  appId: { type: String, trim: true, index: true },
  subscriptionId: { type: String, trim: true, index: true },
  changeSet: { type: Schema.Types.Mixed },
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  ip: { type: String },
  userAgent: { type: String },
  method: { type: String },
  path: { type: String },
  createdAt: { type: Date, default: Date.now, index: true }
});

WebhookConfigAuditLogSchema.index({ scope: 1, createdAt: -1 });
WebhookConfigAuditLogSchema.index({ workspace: 1, appId: 1, createdAt: -1 });

WebhookConfigAuditLogSchema.statics.logChange = async function logChange(input) {
  const req = input.req;
  let ip = 'unknown';
  let userAgent = 'unknown';

  if (req) {
    if (typeof req.headers?.get === 'function') {
      ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      userAgent = req.headers.get('user-agent') || 'unknown';
    } else {
      ip = req.headers?.['x-forwarded-for'] || (req as any).ip || 'unknown';
      userAgent = req.headers?.['user-agent'] || 'unknown';
    }
  }

  return this.create({
    scope: input.scope,
    action: input.action,
    actor: input.actorId,
    actorRole: input.actorRole,
    workspace: input.workspaceId,
    appId: input.appId,
    subscriptionId: input.subscriptionId,
    changeSet: input.changeSet,
    before: input.before,
    after: input.after,
    ip,
    userAgent,
    method: req?.method,
    path: req?.path || (req as any)?.nextUrl?.pathname,
  });
};

export const WebhookConfigAuditLog: IWebhookConfigAuditLogModel =
  (mongoose.models.WebhookConfigAuditLog as IWebhookConfigAuditLogModel) ||
  mongoose.model<IWebhookConfigAuditLogDocument, IWebhookConfigAuditLogModel>(
    'WebhookConfigAuditLog',
    WebhookConfigAuditLogSchema
  );
