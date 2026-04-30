import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IWorkspace {
  name: string;
  owner: Types.ObjectId;
  whatsappConnected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceDocument extends IWorkspace, Document {}

const WorkspaceSchema = new Schema<IWorkspaceDocument>({
  name: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  whatsappConnected: { type: Boolean, default: false },
}, {
  timestamps: true
});

export const Workspace: Model<IWorkspaceDocument> = mongoose.models.Workspace || mongoose.model<IWorkspaceDocument>('Workspace', WorkspaceSchema);
