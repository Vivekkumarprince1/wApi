import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type OnboardingStep =
  | 'EMAIL_VERIFICATION'
  | 'PHONE_VERIFICATION'
  | 'BUSINESS_INFO'
  | 'BUSINESS_VERIFICATION'
  | 'BUSINESS_CONFIRMATION'
  | 'APP_ASSIGNMENT'
  | 'COMPLETED';

export interface IOnboardingState {
  user: Types.ObjectId;
  workspace?: Types.ObjectId;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  status: 'in_progress' | 'completed';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOnboardingStateDocument extends IOnboardingState, Document {}

const OnboardingStateSchema = new Schema<IOnboardingStateDocument>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
  currentStep: {
    type: String,
    enum: ['EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'BUSINESS_INFO', 'BUSINESS_VERIFICATION', 'BUSINESS_CONFIRMATION', 'APP_ASSIGNMENT', 'COMPLETED'],
    required: true,
    default: 'EMAIL_VERIFICATION',
    index: true
  },
  completedSteps: [{
    type: String,
    enum: ['EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'BUSINESS_INFO', 'BUSINESS_VERIFICATION', 'BUSINESS_CONFIRMATION', 'APP_ASSIGNMENT', 'COMPLETED']
  }],
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress', index: true },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const OnboardingState: Model<IOnboardingStateDocument> =
  mongoose.models.OnboardingState || mongoose.model<IOnboardingStateDocument>('OnboardingState', OnboardingStateSchema);
