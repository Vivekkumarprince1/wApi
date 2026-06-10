import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProviderDocument = HydratedDocument<Provider>;

@Schema({ timestamps: true, collection: 'bsp_providers' })
export class Provider {
  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: true })
  active!: boolean;

  @Prop({ type: Object, default: {} })
  config!: Record<string, unknown>;
}

export const ProviderSchema = SchemaFactory.createForClass(Provider);
