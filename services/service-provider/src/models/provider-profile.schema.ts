import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type ProviderProfileDocument = HydratedDocument<ProviderProfile>;

@Schema({ timestamps: true, collection: 'bsp_profiles' })
export class ProviderProfile extends WorkspaceScopedModel {
  @Prop({ required: true, index: true })
  appId!: string;

  @Prop()
  displayName?: string;

  @Prop()
  about?: string;

  @Prop()
  photoUrl?: string;

  @Prop({ type: Object, default: {} })
  profile!: Record<string, unknown>;
}

export const ProviderProfileSchema = SchemaFactory.createForClass(ProviderProfile);
ProviderProfileSchema.index({ workspaceId: 1, provider: 1, appId: 1 }, { unique: true });
