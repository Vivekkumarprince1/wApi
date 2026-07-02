import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { ChannelService } from './channel.service';

@Controller('/internal/v1/bsp/channels')
@UseGuards(InternalAuthGuard)
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  @Get('facebook/pages')
  async facebookPages(@Query('accessToken') accessToken: string) {
    return ok(await this.channelService.getFacebookPages(accessToken));
  }

  @Get('instagram/accounts')
  async instagramAccounts(@Query('accessToken') accessToken: string) {
    return ok(await this.channelService.getInstagramAccounts(accessToken));
  }

  @Post('instagram/oauth-url')
  async instagramOAuthUrl(@Body() body: {
    workspaceId: string;
    userId?: string;
    redirectUri: string;
    returnTo?: string;
    forceReauth?: boolean;
  }) {
    return ok(this.channelService.generateInstagramAuthUrl(body));
  }

  @Post('instagram/complete-oauth')
  async completeInstagramOAuth(@Body() body: {
    code: string;
    redirectUri: string;
    workspaceId?: string;
    userId?: string;
  }) {
    return ok(await this.channelService.completeInstagramOAuth(body.code, body.redirectUri, {
      workspaceId: body.workspaceId,
      userId: body.userId,
    }));
  }

  @Post('instagram/refresh-token')
  async refreshInstagramToken(@Body() body: { accessToken: string }) {
    return ok(await this.channelService.refreshInstagramToken(body.accessToken));
  }

  @Post('instagram/graph')
  async instagramGraph(@Body() body: {
    accessToken: string;
    method?: 'GET' | 'POST' | 'DELETE';
    path: string;
    query?: Record<string, any>;
    body?: Record<string, any>;
    graphHost?: 'instagram' | 'facebook';
    apiVersion?: string;
  }) {
    return ok(await this.channelService.instagramGraph(body));
  }

  @Post(':provider/send')
  async send(@Param('provider') provider: 'facebook' | 'instagram' | 'sms' | 'meta', @Body() body: any) {
    return ok(await this.channelService.sendMessage(provider, body));
  }

  @Post(':provider/webhook')
  async webhook(@Param('provider') provider: 'facebook' | 'instagram' | 'sms' | 'meta', @Body() body: any) {
    return ok(await this.channelService.normalizeInbound(provider, body));
  }
}
