import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProviderWebhookEventDocument = HydratedDocument<ProviderWebhookEvent>;

@Schema({ timestamps: true, collection: 'bsp_webhook_events' })
export class ProviderWebhookEvent {
  @Prop({ required: true, unique: true })
  eventId!: string;

  @Prop({ default: 'gupshup', index: true })
  provider!: string;

  @Prop({ index: true })
  workspaceId?: string;

  @Prop({ index: true })
  appId?: string;

  @Prop({ required: true, index: true })
  eventType!: string;

  @Prop({ default: 'received' })
  status!: 'received' | 'processed' | 'failed' | 'ignored';

  @Prop({ type: Object, required: true })
  rawPayload!: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  normalizedPayload!: Record<string, unknown>;

  @Prop()
  processedAt?: Date;
}

export const ProviderWebhookEventSchema = SchemaFactory.createForClass(ProviderWebhookEvent);
