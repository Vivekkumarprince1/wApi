import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDeveloperOtpChallenge extends Document {
  workspaceId: mongoose.Types.ObjectId;
  phone: string;
  purpose: string;
  templateName: string;
  languageCode: string;
  otpHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt?: Date;
  metadata?: Record<string, unknown>;
}

const DeveloperOtpChallengeSchema = new Schema<IDeveloperOtpChallenge>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    phone: { type: String, required: true, index: true },
    purpose: { type: String, default: 'login', index: true },
    templateName: { type: String, required: true },
    languageCode: { type: String, default: 'en_US' },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true, collection: 'developer_otp_challenges' }
);

DeveloperOtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
DeveloperOtpChallengeSchema.index({ workspaceId: 1, phone: 1, purpose: 1, consumedAt: 1 });

export const DeveloperOtpChallenge: Model<IDeveloperOtpChallenge> =
  (mongoose.models.DeveloperOtpChallenge as any) ||
  mongoose.model<IDeveloperOtpChallenge>('DeveloperOtpChallenge', DeveloperOtpChallengeSchema);
