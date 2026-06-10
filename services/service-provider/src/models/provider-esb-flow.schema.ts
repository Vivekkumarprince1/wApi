import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EsbFlowStatus =
  | 'not_started'
  | 'signup_initiated'
  | 'code_received'
  | 'token_exchanged'
  | 'business_verified'
  | 'phone_registered'
  | 'otp_sent'
  | 'otp_verified'
  | 'system_user_created'
  | 'waba_activated'
  | 'completed'
  | 'failed'
  | 'phone_pending'
  | 'disconnected';

@Schema({ timestamps: true })
export class ProviderEsbFlow extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspace: Types.ObjectId;

  @Prop({ type: String, default: 'meta' })
  provider: 'meta' | 'gupshup';

  // OAuth State Management
  @Prop()
  authState: string;

  @Prop()
  authCode: string;

  @Prop()
  authCodeExpiresAt: Date;

  // User Access Tokens
  @Prop({ select: false })
  userAccessToken: string;

  @Prop({ select: false })
  userRefreshToken: string;

  @Prop()
  tokenExpiry: Date;

  // System User Tokens
  @Prop()
  systemUserId: string;

  @Prop({ select: false })
  systemUserToken: string;

  @Prop()
  systemUserTokenExpiry: Date;

  // Phone OTP Flow
  @Prop()
  phoneNumberIdForOTP: string;

  @Prop({ select: false })
  phoneOTPCode: string;

  @Prop()
  phoneOTPExpiry: Date;

  @Prop({ type: Number, default: 0 })
  phoneOTPAttempts: number;

  @Prop()
  phoneOTPVerifiedAt: Date;

  // Callback Handling
  @Prop()
  callbackState: string;

  @Prop({ type: Boolean, default: false })
  callbackReceived: boolean;

  @Prop()
  callbackReceivedAt: Date;

  @Prop({ type: Object })
  callbackData: Record<string, unknown>;

  // Contact/Subscription Sync
  @Prop()
  contactSyncFingerprint: string;

  @Prop()
  contactSyncedAt: Date;

  @Prop()
  subscriptionSyncedAt: Date;

  // Flow Timeline
  @Prop()
  embedUrl: string;

  @Prop({
    type: String,
    enum: [
      'not_started',
      'signup_initiated',
      'code_received',
      'token_exchanged',
      'business_verified',
      'phone_registered',
      'otp_sent',
      'otp_verified',
      'system_user_created',
      'waba_activated',
      'completed',
      'failed',
      'phone_pending',
      'disconnected',
    ],
    default: 'not_started',
    index: true,
  })
  status: EsbFlowStatus;

  @Prop()
  startedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop()
  failedAt: Date;

  @Prop()
  failureReason: string;

  // Meta Account Status
  @Prop()
  metaAccountStatus: string;

  @Prop()
  metaAccountStatusUpdatedAt: Date;

  @Prop({ type: Boolean, default: false })
  accountBlocked: boolean;

  @Prop()
  accountBlockedReason: string;

  @Prop({ type: Object })
  metaCapabilities: Record<string, unknown>;

  @Prop({ type: Boolean, default: false })
  capabilityBlocked: boolean;

  @Prop()
  capabilityBlockedReason: string;

  @Prop()
  metaDecisionStatus: string;

  // Token Refresh Tracking
  @Prop()
  lastTokenRefreshAttempt: Date;

  @Prop()
  lastTokenRefreshError: string;

  // Metadata
  @Prop()
  createdBy: string;

  @Prop()
  notes: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ProviderEsbFlowSchema = SchemaFactory.createForClass(ProviderEsbFlow);

// Indexes
ProviderEsbFlowSchema.index({ workspace: 1, provider: 1 });
ProviderEsbFlowSchema.index({ status: 1, updatedAt: -1 });
ProviderEsbFlowSchema.index({ callbackState: 1 }, { sparse: true });
