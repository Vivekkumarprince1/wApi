import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type ProviderCredentialDocument = HydratedDocument<ProviderCredential>;

@Schema({ timestamps: true, collection: 'bsp_credentials' })
export class ProviderCredential extends WorkspaceScopedModel {
  @Prop({ required: true })
  appId!: string;

  @Prop({ required: true })
  kind!: 'partner' | 'app' | 'webhook';

  @Prop({ required: true })
  encryptedValue!: string;

  @Prop()
  expiresAt?: Date;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;
}

export const ProviderCredentialSchema = SchemaFactory.createForClass(ProviderCredential);
