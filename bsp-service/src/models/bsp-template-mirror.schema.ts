import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type BspTemplateMirrorDocument = HydratedDocument<BspTemplateMirror>;

@Schema({ timestamps: true, collection: 'bsp_template_mirrors' })
export class BspTemplateMirror extends WorkspaceScopedModel {
  @Prop({ required: true })
  appId!: string;

  @Prop({ required: true, index: true })
  name!: string;

  @Prop({ default: 'en' })
  language!: string;

  @Prop({ default: 'UNKNOWN', index: true })
  status!: string;

  @Prop()
  category?: string;

  @Prop({ type: Object, default: {} })
  providerData!: Record<string, unknown>;
}

export const BspTemplateMirrorSchema = SchemaFactory.createForClass(BspTemplateMirror);
BspTemplateMirrorSchema.index({ workspaceId: 1, appId: 1, name: 1, language: 1 }, { unique: true });
