import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type ProviderSubscriptionDocument = HydratedDocument<ProviderSubscription>;

@Schema({ timestamps: true, collection: 'bsp_subscriptions' })
export class ProviderSubscription extends WorkspaceScopedModel {
  @Prop({ required: true })
  appId!: string;

  @Prop({ required: true })
  callbackUrl!: string;

  @Prop({ type: [String], default: [] })
  events!: string[];

  @Prop({ default: 'active' })
  status!: 'active' | 'disabled' | 'deleted' | 'failed';

  @Prop({ type: Object, default: {} })
  providerData!: Record<string, unknown>;
}

export const ProviderSubscriptionSchema = SchemaFactory.createForClass(ProviderSubscription);
