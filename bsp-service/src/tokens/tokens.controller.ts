import { Controller, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { TokensService } from './tokens.service';

@Controller('/internal/v1/bsp/apps/:appId/token')
@UseGuards(InternalAuthGuard)
export class TokensController {
  constructor(private readonly tokens: TokensService) {}

  @Post('refresh')
  async refresh(@Param('appId') appId: string, @Headers('x-workspace-id') workspaceId?: string) {
    return ok(await this.tokens.refreshAppToken(appId, workspaceId));
  }
}
