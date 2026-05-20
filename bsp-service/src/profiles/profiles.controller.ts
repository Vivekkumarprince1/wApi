import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { BspProfile } from '../models/bsp-profile.schema';

@Controller('/internal/v1/bsp/profile')
@UseGuards(InternalAuthGuard)
export class ProfilesController {
  constructor(@InjectModel(BspProfile.name) private readonly profileModel: Model<BspProfile>) {}

  @Get(':appId')
  async get(@Param('appId') appId: string, @Query('workspaceId') workspaceId?: string) {
    return ok(await this.profileModel.findOne({ appId, ...(workspaceId ? { workspaceId } : {}) }));
  }

  @Patch(':appId')
  async update(@Param('appId') appId: string, @Body() body: any) {
    const profile = await this.profileModel.findOneAndUpdate(
      { workspaceId: body.workspaceId, provider: body.provider || 'gupshup', appId },
      {
        $set: {
          workspaceId: body.workspaceId,
          provider: body.provider || 'gupshup',
          appId,
          displayName: body.displayName,
          about: body.about,
          photoUrl: body.photoUrl,
          profile: body.profile || body,
        },
      },
      { upsert: true, new: true },
    );
    return ok(profile);
  }
}
