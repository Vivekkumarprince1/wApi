import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { BspSubscription } from '../models/bsp-subscription.schema';
import { GupshupClientService } from '../gupshup/gupshup-client.service';

@Controller('/internal/v1/bsp/subscriptions')
@UseGuards(InternalAuthGuard)
export class SubscriptionsController {
  constructor(
    @InjectModel(BspSubscription.name) private readonly subscriptionModel: Model<BspSubscription>,
    private readonly gupshup: GupshupClientService,
  ) {}

  @Post()
  async upsert(@Body() body: any) {
    const appId = body.appId;
    let providerData = body.providerData || {};

    if (appId && !String(appId).startsWith('mock_')) {
      const response = await this.gupshup.setSubscription({
        appId,
        url: body.callbackUrl,
        events: body.events,
        strategy: 'update',
      });
      providerData = {
        ...providerData,
        gupshupResponse: response,
      };
    }

    const subscription = await this.subscriptionModel.findOneAndUpdate(
      { workspaceId: body.workspaceId, provider: body.provider || 'gupshup', appId: body.appId, callbackUrl: body.callbackUrl },
      {
        $set: {
          workspaceId: body.workspaceId,
          provider: body.provider || 'gupshup',
          appId: body.appId,
          callbackUrl: body.callbackUrl,
          events: body.events || [],
          status: 'active',
          providerData,
        },
      },
      { upsert: true, new: true },
    );
    return ok(subscription);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const existing = await this.subscriptionModel.findById(id);
    if (existing && existing.appId && !String(existing.appId).startsWith('mock_')) {
      const activeSubs = await this.gupshup.listSubscriptions(existing.appId).catch(() => []);
      const targetUrl = existing.callbackUrl;
      const targetSub = activeSubs.find((s: any) => s.url === targetUrl);
      if (targetSub?.id) {
        await this.gupshup.deleteSubscription(existing.appId, targetSub.id).catch(e =>
          console.warn('[SubscriptionsController] Failed to delete partner sub:', e.message)
        );
      }
    }

    const subscription = await this.subscriptionModel.findByIdAndUpdate(id, { $set: { status: 'deleted' } }, { new: true });
    return ok(subscription);
  }
}

