import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkspaceScopedModel } from './common';

export type ProviderTemplateRuleDocument = HydratedDocument<ProviderTemplateRule>;

/**
 * Template auto-trigger rule: fires a template when an inbound event matches
 * (e.g. a keyword on a new conversation). Backs the Templates → Auto-Triggers page.
 */
@Schema({ timestamps: true, collection: 'bsp_template_rules' })
export class ProviderTemplateRule extends WorkspaceScopedModel {
  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  // 'message_keyword' | 'new_conversation' | 'incoming_message' | 'status_update'
  @Prop({ default: 'message_keyword', index: true })
  triggerType!: string;

  @Prop({ type: [String], default: [] })
  keywords!: string[];

  // 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex'
  @Prop({ default: 'contains' })
  matchMode!: string;

  // Template id (ProviderTemplateMirror) or template name to send when the rule fires.
  @Prop()
  template?: string;

  @Prop({ type: Object, default: {} })
  conditions!: Record<string, unknown>;

  @Prop({ type: Object, default: { enabled: false, window: 24, maxTriggers: 1 } })
  rateLimit!: Record<string, unknown>;

  @Prop({ default: 0 })
  priority!: number;

  @Prop({ default: true, index: true })
  enabled!: boolean;

  @Prop({ type: Object, default: { success: 0, failed: 0, skipped: 0 } })
  stats!: { success: number; failed: number; skipped: number };

  @Prop()
  lastTriggeredAt?: Date;
}

export const ProviderTemplateRuleSchema = SchemaFactory.createForClass(ProviderTemplateRule);
ProviderTemplateRuleSchema.index({ workspaceId: 1, enabled: 1, priority: -1 });
