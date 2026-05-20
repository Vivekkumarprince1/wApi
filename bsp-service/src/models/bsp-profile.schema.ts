import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type BspProfileDocument = HydratedDocument<BspProfile>;

@Schema({ timestamps: true, collection: 'bsp_profiles' })
export class BspProfile extends WorkspaceScopedModel {
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

export const BspProfileSchema = SchemaFactory.createForClass(BspProfile);
BspProfileSchema.index({ workspaceId: 1, provider: 1, appId: 1 }, { unique: true });
