import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { BspMediaAsset } from '../models/bsp-media-asset.schema';

@Controller('/internal/v1/bsp/media')
@UseGuards(InternalAuthGuard)
export class MediaController {
  constructor(@InjectModel(BspMediaAsset.name) private readonly mediaModel: Model<BspMediaAsset>) {}

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
