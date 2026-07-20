import type { Schema as SchemaType, Types } from "mongoose";
import type { SchemaCtor } from "../types";

export type UserRole =
  | "super_admin"
  | "super_admin_support"
  | "super_admin_finance"
  | "super_admin_readonly"
  | "owner"
  | "admin"
  | "manager"
  | "agent"
  | "member"
  | "viewer";
export type AccountStatus =
  | "AWAITING_EMAIL_VERIFICATION"
  | "AWAITING_MOBILE_VERIFICATION"
  | "AWAITING_BUSINESS_INFO"
  | "SIGNUP_COMPLETED";
export type UserStatus = "active" | "invited" | "offline" | "removed";
export type AuthProvider = "local" | "google" | "phone" | "mixed";

export interface IUser {
  name: string;
  email?: string;
  passwordHash?: string;
  googleId?: string;
  facebookId?: string;
  phone?: string;
  phoneVerified: boolean;
  authProvider: AuthProvider;
  company?: string;
  timezone?: string;
  emailVerified: boolean;
  role: UserRole;
  workspace?: Types.ObjectId;
  activeWorkspace?: Types.ObjectId;
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

/**
 * Builds the User schema using the CALLER's mongoose Schema class, so the
 * schema is compatible with whichever Mongoose version the consumer runs
 * (core-server is on 8, other services on 9). Mirrors
 * services/core-server/src/models/auth/User.ts.
 */
export function buildUserSchema(Schema: SchemaCtor): SchemaType<IUser> {
  const UserSchema = new Schema<IUser>({
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    facebookId: { type: String },
    phone: { type: String, unique: true, sparse: true, trim: true },
    phoneVerified: { type: Boolean, default: false },
    authProvider: { type: String, enum: ["local", "google", "phone", "mixed"], default: "local" },
    company: { type: String },
    timezone: { type: String, default: "Asia/Kolkata" },
    emailVerified: { type: Boolean, default: false },
    role: {
      type: String,
      enum: [
        "super_admin",
        "super_admin_support",
        "super_admin_finance",
        "super_admin_readonly",
        "owner",
        "admin",
        "manager",
        "agent",
        "member",
        "viewer",
      ],
      default: "member",
    },
    workspace: { type: Schema.Types.ObjectId, ref: "Workspace" },
    activeWorkspace: { type: Schema.Types.ObjectId, ref: "Workspace" },
    accountStatus: {
      type: String,
      enum: [
        "AWAITING_EMAIL_VERIFICATION",
        "AWAITING_MOBILE_VERIFICATION",
        "AWAITING_BUSINESS_INFO",
        "SIGNUP_COMPLETED",
      ],
      default: "AWAITING_EMAIL_VERIFICATION",
    },
    status: { type: String, enum: ["active", "invited", "offline", "removed"], default: "active" },
    invitedAt: { type: Date },
    invitationToken: { type: String, index: true },
    removedAt: { type: Date },
    lastLoginAt: { type: Date },
    joinedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  });

  UserSchema.index({ workspace: 1 });

  UserSchema.pre("save", function (this: { updatedAt: Date }) {
    this.updatedAt = new Date();
  });

  return UserSchema;
}
