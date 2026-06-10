import { Prop } from '@nestjs/mongoose';

export class WorkspaceScopedModel {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ default: 'gupshup', index: true })
  provider!: string;
}
