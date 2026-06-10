import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '../../../common/internal-auth.guard';
import { ok } from '../../../common/api-response';
import { ProviderActionsService } from './provider-actions.service';

@Controller('/internal/v1/bsp/provider')
@UseGuards(InternalAuthGuard)
export class ProviderActionsController {
  constructor(private readonly providerActions: ProviderActionsService) {}

  @Get()
  async list() {
    return ok(await this.providerActions.list());
  }

  @Get(':code')
  async get(@Param('code') code: string) {
    return ok(await this.providerActions.get(code));
  }

  @Put(':code')
  async upsert(@Param('code') code: string, @Body() body: any) {
    return ok(await this.providerActions.upsert({ ...body, code }));
  }

  // Preserves the original route: POST /internal/v1/bsp/provider/actions
  @Post('actions')
  async execute(@Body() body: any) {
    return ok(await this.providerActions.execute({
      appId: body.appId,
      action: body.action,
      payload: body.payload || {},
    }));
  }
}
