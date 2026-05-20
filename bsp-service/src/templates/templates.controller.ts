import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { BspTemplateMirror } from '../models/bsp-template-mirror.schema';

@Controller('/internal/v1/bsp/templates')
@UseGuards(InternalAuthGuard)
export class TemplatesController {
  constructor(@InjectModel(BspTemplateMirror.name) private readonly templateModel: Model<BspTemplateMirror>) {}

  @Post('sync')
  async sync(@Body() body: any) {
    const synced = await this.templateModel.countDocuments({
      workspaceId: body.workspaceId,
      provider: body.provider || 'gupshup',
      appId: body.appId,
    });

    return ok({ synced, created: 0, updated: 0, failed: 0 });
  }

  @Post(':id/submit')
  async submit(@Param('id') id: string, @Body() body: any) {
    const template = await this.templateModel.findByIdAndUpdate(
      id,
      { $set: { status: 'PENDING', providerData: body.providerData || {} } },
      { new: true },
    );
    return ok(template);
  }
}
