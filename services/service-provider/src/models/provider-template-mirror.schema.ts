import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type ProviderTemplateMirrorDocument = HydratedDocument<ProviderTemplateMirror>;

@Schema({ timestamps: true, collection: 'bsp_template_mirrors' })
export class ProviderTemplateMirror extends WorkspaceScopedModel {
  @Prop({ required: true })
  appId!: string;

  @Prop({ required: true, index: true })
  name!: string;

  @Prop({ default: 'en' })
  language!: string;

  @Prop({ default: 'UNKNOWN', index: true })
  status!: string;

  @Prop({ index: true })
  providerTemplateId?: string;

  @Prop()
  providerStatus?: string;

  @Prop()
  rejectionReason?: string;

  @Prop()
  lastSyncedAt?: Date;

  @Prop({ default: 0 })
  syncFailureCount!: number;

  @Prop()
  lastSyncError?: string;

  @Prop()
  submissionKey?: string;

  @Prop()
  category?: string;

  @Prop({ type: Object, default: {} })
  providerData!: Record<string, unknown>;
}

export const ProviderTemplateMirrorSchema = SchemaFactory.createForClass(ProviderTemplateMirror);
ProviderTemplateMirrorSchema.index({ workspaceId: 1, appId: 1, name: 1, language: 1 }, { unique: true });
ProviderTemplateMirrorSchema.index({ workspaceId: 1, providerTemplateId: 1 }, { unique: true, sparse: true });
ProviderTemplateMirrorSchema.index({ workspaceId: 1, submissionKey: 1 }, { unique: true, sparse: true });
