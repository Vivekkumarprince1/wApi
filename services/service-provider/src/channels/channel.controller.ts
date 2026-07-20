import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { ChannelService } from './channel.service';

@Controller('/internal/v1/bsp/channels')
@UseGuards(InternalAuthGuard)
export class ChannelController {
  constructor(private readonly channelService: ChannelService) { }

  @Get('facebook/pages')
  async facebookPages(@Query('accessToken') accessToken: string) {
    return ok(await this.channelService.getFacebookPages(accessToken));
  }

  @Post(':provider/send')
  async send(@Param('provider') provider: 'facebook' | 'meta', @Body() body: any) {
    return ok(await this.channelService.sendMessage(provider, body));
  }

  @Post(':provider/webhook')
  async webhook(@Param('provider') provider: 'facebook' | 'meta', @Body() body: any) {
    return ok(await this.channelService.normalizeInbound(provider, body));
  }
}
