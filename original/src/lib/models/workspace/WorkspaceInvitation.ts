import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { IPermissionsConfig } from '../auth/Permission';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface IWorkspaceInvitation {
  email: string;
  name?: string;
  workspace: Types.ObjectId;
  role: string;
  permissionsOverride?: Partial<IPermissionsConfig>;
  invitedBy: Types.ObjectId;
  token: string;
  status: InvitationStatus;
  phone?: string;
  teams: Types.ObjectId[]; // Pre-assigned teams
  expiresAt: Date;
  joinedAt?: Date;
  resendCount?: number;
  lastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceInvitationDocument extends IWorkspaceInvitation, Document {}

const WorkspaceInvitationSchema = new Schema<IWorkspaceInvitationDocument>({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  name: { type: String },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  role: { type: String, required: true },
  permissionsOverride: { type: Object },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true, index: true },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'expired', 'revoked'], 
    default: 'pending' 
  },
  phone: { type: String, trim: true },
  teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  expiresAt: { type: Date, required: true },
  joinedAt: { type: Date },
  resendCount: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Ensure only one pending invitation per email per workspace
WorkspaceInvitationSchema.index({ email: 1, workspace: 1, status: 1 }, { 
  unique: true, 
  partialFilterExpression: { status: 'pending' } 
});

export const WorkspaceInvitation: Model<IWorkspaceInvitationDocument> = 
  mongoose.models.WorkspaceInvitation || mongoose.model<IWorkspaceInvitationDocument>('WorkspaceInvitation', WorkspaceInvitationSchema);
