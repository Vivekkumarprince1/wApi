import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * Minimal Workspace mirror in the campaign-service DB.
 *
 * Fields here are the ones the campaign worker / event bus actually read
 * during a send (`inboxSettings.agentMessagesPerMinute` for throttling,
 * etc.). The full Workspace lives on the monolith; this projection is
 * synced opportunistically.
 */
export interface IWorkspaceInboxSettings {
  /** Per-agent throttle used to compute campaign send pacing. */
  agentMessagesPerMinute?: number;
  /** Optional cap on concurrent agent sessions. */
  maxConcurrentAgents?: number;
}

export interface IWorkspace {
  name: string;
  owner: Types.ObjectId;
  whatsappConnected: boolean;
  inboxSettings?: IWorkspaceInboxSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceDocument extends IWorkspace, Document {}

const InboxSettingsSchema = new Schema<IWorkspaceInboxSettings>({
  agentMessagesPerMinute: { type: Number, default: 600 },
  maxConcurrentAgents: { type: Number },
}, { _id: false });

const WorkspaceSchema = new Schema<IWorkspaceDocument>({
  name: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  whatsappConnected: { type: Boolean, default: false },
  inboxSettings: { type: InboxSettingsSchema, default: () => ({}) },
}, {
  timestamps: true
});

export const Workspace: Model<IWorkspaceDocument> = mongoose.models.Workspace || mongoose.model<IWorkspaceDocument>('Workspace', WorkspaceSchema);
