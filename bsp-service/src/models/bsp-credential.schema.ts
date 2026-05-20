import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type BspCredentialDocument = HydratedDocument<BspCredential>;

@Schema({ timestamps: true, collection: 'bsp_credentials' })
export class BspCredential extends WorkspaceScopedModel {
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

export const BspCredentialSchema = SchemaFactory.createForClass(BspCredential);
