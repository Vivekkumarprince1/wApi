import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type ProviderMessageDispatchDocument = HydratedDocument<ProviderMessageDispatch>;

@Schema({ timestamps: true, collection: 'bsp_message_dispatches' })
export class ProviderMessageDispatch extends WorkspaceScopedModel {
  @Prop({ required: true, index: true })
  appId!: string;

  @Prop({ required: true })
  to!: string;

  @Prop({ required: true })
  type!: string;

  @Prop()
  conversationId?: string;

  @Prop()
  contactId?: string;

  @Prop()
  campaignId?: string;

  @Prop()
  idempotencyKey?: string;

  @Prop({ required: true, index: true })
  internalMessageId!: string;

  @Prop({ default: 1 })
  attempt!: number;

  @Prop()
  providerMessageId?: string;

  @Prop()
  providerEnvelopeId?: string;

  @Prop({ default: 'accepted', index: true })
  status!: 'dispatching' | 'accepted' | 'sent' | 'delivered' | 'read' | 'failed' | 'rejected' | 'expired' | 'unknown' | 'reconciliation_required';

  @Prop()
  errorCode?: string;

  @Prop()
  errorMessage?: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  providerResponse!: Record<string, unknown>;
}

export const ProviderMessageDispatchSchema = SchemaFactory.createForClass(ProviderMessageDispatch);
ProviderMessageDispatchSchema.index({ workspaceId: 1, internalMessageId: 1 }, { unique: true });
ProviderMessageDispatchSchema.index({ workspaceId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
