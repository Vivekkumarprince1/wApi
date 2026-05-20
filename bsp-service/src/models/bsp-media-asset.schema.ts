import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type BspMediaAssetDocument = HydratedDocument<BspMediaAsset>;

@Schema({ timestamps: true, collection: 'bsp_media_assets' })
export class BspMediaAsset extends WorkspaceScopedModel {
  @Prop({ required: true })
  appId!: string;

  @Prop({ required: true })
  sourceUrl!: string;

  @Prop()
  providerMediaId?: string;

  @Prop()
  mimeType?: string;

  @Prop({ default: 'created' })
  status!: 'created' | 'uploaded' | 'failed' | 'deleted';

  @Prop({ type: Object, default: {} })
  providerData!: Record<string, unknown>;
}

export const BspMediaAssetSchema = SchemaFactory.createForClass(BspMediaAsset);
