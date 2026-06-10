import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InternalAuthGuard } from '../../../common/internal-auth.guard';
import { ok } from '../../../common/api-response';
import { ProviderMediaAsset } from '../../../models/provider-media-asset.schema';

@Controller('/internal/v1/bsp/media')
@UseGuards(InternalAuthGuard)
export class MediaController {
  constructor(@InjectModel(ProviderMediaAsset.name) private readonly mediaModel: Model<ProviderMediaAsset>) {}

  @Post()
  async create(@Body() body: any) {
    const asset = await this.mediaModel.create({
      workspaceId: body.workspaceId,
      provider: body.provider || 'gupshup',
      appId: body.appId,
      sourceUrl: body.sourceUrl || body.url,
      mimeType: body.mimeType,
      status: 'created',
      providerData: body.providerData || {},
    });
    return ok(asset);
  }
}
