import mongoose, { Document, Model, Schema, Types } from 'mongoose';
type UserRole = string;

export const WEBHOOK_SUBSCRIPTION_MODES = [
  'NONE',
  'TEMPLATE',
  'ACCOUNT',
  'PAYMENTS',
  'FLOWS_MESSAGE',
  'MESSAGE',
  'OTHERS',
  'ALL',
  'BILLING',
  'FAILED',
  'SENT',
  'DELIVERED',
  'READ',
  'ENQUEUED',
  'COEXISTENCE',
  'DELETED'
] as const;

export type WebhookSubscriptionMode = (typeof WEBHOOK_SUBSCRIPTION_MODES)[number];
export type WebhookPolicyScope = 'global' | 'workspace' | 'app';
export type WebhookRuntimeMode = 'sandbox' | 'production';

export interface IWebhookPolicy {
  scope: WebhookPolicyScope;
  workspace?: Types.ObjectId;
  appId?: string;
  webhookEnabled?: boolean;
  webhookMode?: WebhookRuntimeMode;
  defaultModes?: WebhookSubscriptionMode[];
  allowedModes?: WebhookSubscriptionMode[];
  statusViewRoles?: UserRole[];
  notes?: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWebhookPolicyDocument extends IWebhookPolicy, Document {}

const WorkspaceRoles: UserRole[] = ['owner', 'admin', 'manager', 'agent', 'member', 'viewer', 'super_admin'];

const WebhookPolicySchema = new Schema<IWebhookPolicyDocument>(
  {
    scope: {
      type: String,
      enum: ['global', 'workspace', 'app'],
      required: true
    },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true
    },
    appId: {
      type: String,
      trim: true,
      index: true
    },
    webhookEnabled: {
      type: Boolean,
      default: true
    },
    webhookMode: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'production'
    },
    defaultModes: {
      type: [{ type: String, enum: WEBHOOK_SUBSCRIPTION_MODES }],
      default: undefined
    },
    allowedModes: {
      type: [{ type: String, enum: WEBHOOK_SUBSCRIPTION_MODES }],
      default: undefined
    },
    statusViewRoles: {
      type: [{ type: String, enum: WorkspaceRoles }],
      default: undefined
    },
    notes: {
      type: String,
      trim: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

WebhookPolicySchema.index({ scope: 1 }, { unique: true, partialFilterExpression: { scope: 'global' } });
WebhookPolicySchema.index({ scope: 1, workspace: 1 }, { unique: true, partialFilterExpression: { scope: 'workspace' } });
WebhookPolicySchema.index(
  { scope: 1, workspace: 1, appId: 1 },
  { unique: true, partialFilterExpression: { scope: 'app' } }
);

export const WebhookPolicy: Model<IWebhookPolicyDocument> =
  (mongoose.models.WebhookPolicy as Model<IWebhookPolicyDocument>) ||
  mongoose.model<IWebhookPolicyDocument>('WebhookPolicy', WebhookPolicySchema);
