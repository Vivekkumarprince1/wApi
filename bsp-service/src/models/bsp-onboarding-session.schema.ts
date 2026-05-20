import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type BspOnboardingSessionDocument = HydratedDocument<BspOnboardingSession>;

@Schema({ timestamps: true, collection: 'bsp_onboarding_sessions' })
export class BspOnboardingSession extends WorkspaceScopedModel {
  @Prop({ required: true, index: true })
  sessionId!: string;

  @Prop({ required: true })
  businessId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop()
  appId?: string;

  @Prop({ required: true })
  state!: string;

  @Prop({ required: true })
  callbackUrl!: string;

  @Prop({ default: 'started', index: true })
  status!: 'started' | 'completed' | 'expired' | 'failed';

  @Prop()
  expiresAt?: Date;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;
}

export const BspOnboardingSessionSchema = SchemaFactory.createForClass(BspOnboardingSession);
