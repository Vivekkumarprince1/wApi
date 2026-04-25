import mongoose, { Document, Model, Schema } from 'mongoose';

export type OtpChannel = 'email' | 'phone';
export type OtpPurpose =
  | 'phone_login'
  | 'email_login'
  | 'email_verification'
  | 'phone_verification'
  | 'signup_email';

export interface IOtpChallenge {
  identifier: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  retryCount: number;
  lastSentAt: Date;
  consumedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOtpChallengeDocument extends IOtpChallenge, Document {}

const OtpChallengeSchema = new Schema<IOtpChallengeDocument>({
  identifier: { type: String, required: true, index: true },
  channel: { type: String, enum: ['email', 'phone'], required: true },
  purpose: {
    type: String,
    enum: ['phone_login', 'email_login', 'email_verification', 'phone_verification', 'signup_email'],
    required: true,
    index: true
  },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  retryCount: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  consumedAt: { type: Date },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

OtpChallengeSchema.index({ identifier: 1, purpose: 1, consumedAt: 1 });

export const OtpChallenge: Model<IOtpChallengeDocument> =
  mongoose.models.OtpChallenge || mongoose.model<IOtpChallengeDocument>('OtpChallenge', OtpChallengeSchema);
