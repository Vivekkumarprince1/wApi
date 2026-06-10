import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type ProviderTokenDocument = HydratedDocument<ProviderToken>;

@Schema({ timestamps: true, collection: 'bsp_tokens' })
export class ProviderToken extends WorkspaceScopedModel {
  @Prop({ required: true })
  tokenType!: 'partner' | 'app';

  @Prop()
  appId?: string;

  @Prop({ required: true })
  token!: string;

  @Prop()
  expiresAt?: Date;

  @Prop({ default: 'active' })
  status!: 'active' | 'expired' | 'revoked';
}

export const ProviderTokenSchema = SchemaFactory.createForClass(ProviderToken);
ProviderTokenSchema.index({ workspaceId: 1, provider: 1, tokenType: 1, appId: 1 });
