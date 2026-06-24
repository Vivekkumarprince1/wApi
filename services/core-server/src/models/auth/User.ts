import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'manager' | 'agent' | 'member' | 'viewer';
export type AccountStatus = 'AWAITING_EMAIL_VERIFICATION' | 'AWAITING_MOBILE_VERIFICATION' | 'AWAITING_BUSINESS_INFO' | 'SIGNUP_COMPLETED';
export type UserStatus = 'active' | 'invited' | 'offline' | 'removed';
export type AuthProvider = 'local' | 'google' | 'facebook' | 'phone' | 'mixed';

export interface IUser {
  name: string;
  email?: string;
  passwordHash?: string;
  googleId?: string;
  facebookId?: string;
  profilePicture?: string;
  phone?: string;
  phoneVerified: boolean;
  authProvider: AuthProvider;
  company?: string;
  timezone?: string;
  emailVerified: boolean;
  role: UserRole;
  workspace?: Types.ObjectId; // [LEGACY] Primary workspace. Use activeWorkspace for new logic.
  activeWorkspace?: Types.ObjectId; // Current context workspace
  // team?: Types.ObjectId;      // [REMOVED] Use Team model members instead
  accountStatus: AccountStatus;
  status: UserStatus;
  invitedAt?: Date;
  invitationToken?: string;
  removedAt?: Date;
  lastLoginAt?: Date;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

const UserSchema = new Schema<IUserDocument>({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  passwordHash: { type: String },
  googleId: { type: String, unique: true, sparse: true },
  facebookId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String },
  phone: { type: String, unique: true, sparse: true, trim: true },
  phoneVerified: { type: Boolean, default: false },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'facebook', 'phone', 'mixed'],
    default: 'local'
  },
  company: { type: String },
  timezone: { type: String, default: 'Asia/Kolkata' },
  emailVerified: { type: Boolean, default: false },
  role: { 
    type: String, 
    enum: ['super_admin', 'owner', 'admin', 'manager', 'agent', 'member', 'viewer'], 
    default: 'member' 
  },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace' },
  activeWorkspace: { type: Schema.Types.ObjectId, ref: 'Workspace' },
  // team: { type: Schema.Types.ObjectId, ref: 'Team' },

  accountStatus: { 
    type: String, 
    enum: ['AWAITING_EMAIL_VERIFICATION', 'AWAITING_MOBILE_VERIFICATION', 'AWAITING_BUSINESS_INFO', 'SIGNUP_COMPLETED'],
    default: 'AWAITING_EMAIL_VERIFICATION'
  },
  status: { 
    type: String, 
    enum: ['active', 'invited', 'offline', 'removed'], 
    default: 'active' 
  },
  invitedAt: { type: Date },
  invitationToken: { type: String, index: true },
  removedAt: { type: Date },
  lastLoginAt: { type: Date },
  joinedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
UserSchema.index({ workspace: 1 });

// Middleware
UserSchema.pre<IUserDocument>('save', function() {
  this.updatedAt = new Date();
  
});

// Ensure single compilation in Next.js Serverless environments
export const User: Model<IUserDocument> = mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
