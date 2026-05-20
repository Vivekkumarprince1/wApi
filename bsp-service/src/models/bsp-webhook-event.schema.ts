import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BspWebhookEventDocument = HydratedDocument<BspWebhookEvent>;

@Schema({ timestamps: true, collection: 'bsp_webhook_events' })
export class BspWebhookEvent {
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

export const BspWebhookEventSchema = SchemaFactory.createForClass(BspWebhookEvent);
