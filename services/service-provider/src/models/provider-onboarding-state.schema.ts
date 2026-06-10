import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OnboardingStep =
  | 'EMAIL_VERIFICATION'
  | 'PHONE_VERIFICATION'
  | 'BUSINESS_INFO'
  | 'BUSINESS_VERIFICATION'
  | 'BUSINESS_CONFIRMATION'
  | 'APP_ASSIGNMENT'
  | 'COMPLETED';

@Schema({ timestamps: true })
export class ProviderOnboardingState extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Workspace', index: true })
  workspace: Types.ObjectId;

  @Prop({
    type: String,
    enum: [
      'EMAIL_VERIFICATION',
      'PHONE_VERIFICATION',
      'BUSINESS_INFO',
      'BUSINESS_VERIFICATION',
      'BUSINESS_CONFIRMATION',
      'APP_ASSIGNMENT',
      'COMPLETED',
    ],
    required: true,
    default: 'EMAIL_VERIFICATION',
    index: true,
  })
  currentStep: OnboardingStep;

  @Prop([
    {
      type: String,
      enum: [
        'EMAIL_VERIFICATION',
        'PHONE_VERIFICATION',
        'BUSINESS_INFO',
        'BUSINESS_VERIFICATION',
        'BUSINESS_CONFIRMATION',
        'APP_ASSIGNMENT',
        'COMPLETED',
      ],
    },
  ])
  completedSteps: OnboardingStep[];

  @Prop({ type: String, enum: ['in_progress', 'completed'], default: 'in_progress', index: true })
  status: 'in_progress' | 'completed';

  @Prop({ type: Object })
  metadata: Record<string, unknown>;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ProviderOnboardingStateSchema = SchemaFactory.createForClass(ProviderOnboardingState);
