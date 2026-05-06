import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IWorkspaceIntegration {
  workspaceId: Types.ObjectId;
  appId: Types.ObjectId;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  credentials?: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    webhookSecret?: string;
    expiresAt?: Date;
    storeUrl?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
  activeWorkflows: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceIntegrationDocument extends IWorkspaceIntegration, Document {}

const WorkspaceIntegrationSchema = new Schema<IWorkspaceIntegrationDocument>({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  appId: { type: Schema.Types.ObjectId, ref: 'IntegrationApp', required: true },
  status: { type: String, enum: ['CONNECTED', 'DISCONNECTED', 'ERROR'], default: 'CONNECTED' },
  credentials: {
    accessToken: String,
    refreshToken: String,
    apiKey: String,
    webhookSecret: String,
    expiresAt: Date,
    storeUrl: String
  },
  metadata: Schema.Types.Mixed,
  activeWorkflows: [{ type: Schema.Types.ObjectId, ref: 'AutomationWorkflow' }]
}, { timestamps: true });

export const WorkspaceIntegration = (mongoose.models.WorkspaceIntegration as Model<IWorkspaceIntegrationDocument>) || mongoose.model<IWorkspaceIntegrationDocument>('WorkspaceIntegration', WorkspaceIntegrationSchema);
