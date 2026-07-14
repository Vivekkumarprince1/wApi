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
    const internalMessageId = String(input.internalMessageId || input.idempotencyKey || '');
    if (!internalMessageId) throw new Error('internalMessageId is required');
    const existing = await this.dispatchModel.findOne({ workspaceId: input.workspaceId, internalMessageId });
    if (existing && existing.providerMessageId) {
      return { dispatchId: existing._id.toString(), success: true, duplicate: true, providerMessageId: existing.providerMessageId, status: existing.status };
    }
    if (existing && ['dispatching', 'unknown', 'reconciliation_required'].includes(existing.status)) {
      return { dispatchId: existing._id.toString(), success: false, duplicate: true, status: 'reconciliation_required', error: 'Provider outcome is uncertain' };
    }

    const dispatch = existing || await this.dispatchModel.create({
      workspaceId: input.workspaceId, provider: input.provider || 'gupshup', appId: input.appId,
      to: input.to, type: input.type, conversationId: input.conversationId, contactId: input.contactId,
      campaignId: input.campaignId, idempotencyKey: input.idempotencyKey || internalMessageId,
      internalMessageId, attempt: 1, status: 'dispatching', payload: input.payload,
    });

    let providerResponse: any;
    try {
      providerResponse = await this.gupshup.sendMessage({ appId: input.appId, payload: input.payload });
      dispatch.providerMessageId = providerResponse.messageId;
      dispatch.providerEnvelopeId = providerResponse.id;
      dispatch.status = 'accepted';
      dispatch.providerResponse = providerResponse;
      await dispatch.save();
    } catch (error: any) {
      dispatch.status = error?.response ? 'failed' : 'reconciliation_required';
      dispatch.errorCode = error.code || 'PROVIDER_DISPATCH_FAILED';
      dispatch.errorMessage = error.message;
      await dispatch.save();
      throw error;
    }

    return {
      dispatchId: (dispatch as any)._id.toString(),
      success: true,
      providerMessageId: dispatch.providerMessageId,
      providerEnvelopeId: dispatch.providerEnvelopeId,
      status: 'accepted',
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
