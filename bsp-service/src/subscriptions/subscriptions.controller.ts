import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { BspSubscription } from '../models/bsp-subscription.schema';

@Controller('/internal/v1/bsp/subscriptions')
@UseGuards(InternalAuthGuard)
export class SubscriptionsController {
  constructor(@InjectModel(BspSubscription.name) private readonly subscriptionModel: Model<BspSubscription>) {}

  @Post()
  async upsert(@Body() body: any) {
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
          providerData: body.providerData || {},
        },
      },
      { upsert: true, new: true },
    );
    return ok(subscription);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const subscription = await this.subscriptionModel.findByIdAndUpdate(id, { $set: { status: 'deleted' } }, { new: true });
    return ok(subscription);
  }
}
