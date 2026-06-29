import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProviderMessageDispatch } from '../../../models/provider-message-dispatch.schema';
import { GupshupClientService } from '../providers/gupshup/gupshup-client.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(ProviderMessageDispatch.name) private readonly dispatchModel: Model<ProviderMessageDispatch>,
    private readonly gupshup: GupshupClientService,
  ) {}

  async send(input: any) {
    const providerResponse = await this.gupshup.sendMessage({
      appId: input.appId,
      payload: input.payload,
    });

    const dispatch = await this.dispatchModel.create({
      workspaceId: input.workspaceId,
      provider: input.provider || 'gupshup',
      appId: input.appId,
      to: input.to,
      type: input.type,
      conversationId: input.conversationId,
      contactId: input.contactId,
      campaignId: input.campaignId,
      idempotencyKey: input.idempotencyKey,
      providerMessageId: providerResponse.messageId,
      providerEnvelopeId: providerResponse.id,
      status: 'sent',
      payload: input.payload,
      providerResponse,
    });

    return {
      dispatchId: (dispatch as any)._id.toString(),
      success: true,
      providerMessageId: dispatch.providerMessageId,
      providerEnvelopeId: dispatch.providerEnvelopeId,
      status: 'sent',
      providerResponse,
    };
  }

  async markRead(input: any) {
    if (!input?.appId || !input?.messageId) {
      throw new Error('appId and messageId are required');
    }

    const providerResponse = await this.gupshup.markMessageRead({
      appId: String(input.appId),
      messageId: String(input.messageId),
    });

    return {
      success: true,
      appId: input.appId,
      messageId: input.messageId,
      providerResponse,
    };
  }
}
