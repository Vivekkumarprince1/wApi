import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWorkspace extends Document {
  name: string;
  owner?: mongoose.Types.ObjectId;
  plan?: mongoose.Types.ObjectId;
  gupshupAppId?: string;
  bspPhoneNumberId?: string;
  apiKeys: any[];
  webhookSubscriptions: any[];
}

const WebhookSubscriptionSchema = new Schema({
  name: { type: String, default: 'Outbound Endpoint' },
  url: { type: String, required: true },
  events: [{ type: String }],
  secret: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastDeliveryAt: { type: Date },
  lastDeliveryStatus: { type: String }
});

const ApiKeySchema = new Schema({
  key: { type: String, required: true, index: true },
  name: { type: String, default: 'Default Key' },
  templateName: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date }
});

const WorkspaceSchema = new Schema({
  name: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  plan: { type: Schema.Types.ObjectId, ref: 'Plan' },
  gupshupAppId: { type: String },
  bspPhoneNumberId: { type: String },
  apiKeys: [ApiKeySchema],
  webhookSubscriptions: [WebhookSubscriptionSchema]
}, { timestamps: true });

export const Workspace: Model<IWorkspace> = (mongoose.models.Workspace as any) || mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
