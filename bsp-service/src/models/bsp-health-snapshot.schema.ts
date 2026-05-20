import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BspHealthSnapshotDocument = HydratedDocument<BspHealthSnapshot>;

@Schema({ timestamps: true, collection: 'bsp_health_snapshots' })
export class BspHealthSnapshot {
  @Prop({ default: 'gupshup', index: true })
  provider!: string;

  @Prop()
  appId?: string;

  @Prop({ default: 'unknown' })
  status!: 'ok' | 'degraded' | 'down' | 'unknown';

  @Prop({ type: Object, default: {} })
  checks!: Record<string, unknown>;
}

export const BspHealthSnapshotSchema = SchemaFactory.createForClass(BspHealthSnapshot);
