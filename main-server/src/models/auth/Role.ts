import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { IPermissionsConfig } from './Permission';

export interface IRole {
  name: string;
  slug: string; // for system roles
  description?: string;
  workspace?: Types.ObjectId; // null for system roles
  permissions: IPermissionsConfig;
  isSystem: boolean;
  color?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoleDocument extends IRole, Document {}

const RoleSchema = new Schema<IRoleDocument>({
  name: { type: String, required: true },
  slug: { type: String, index: true },
  description: { type: String },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
  permissions: { type: Object, required: true },
  isSystem: { type: Boolean, default: false },
  color: { type: String, default: 'slate' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Ensure unique role names per workspace
RoleSchema.index({ workspace: 1, name: 1 }, { unique: true, sparse: true });

export const Role = (mongoose.models.Role as Model<IRoleDocument>) || mongoose.model<IRoleDocument>('Role', RoleSchema);
