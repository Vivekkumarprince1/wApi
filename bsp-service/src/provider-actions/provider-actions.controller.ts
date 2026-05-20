import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { GupshupClientService } from '../gupshup/gupshup-client.service';

@Controller('/internal/v1/bsp/provider/actions')
@UseGuards(InternalAuthGuard)
export class ProviderActionsController {
  constructor(private readonly gupshup: GupshupClientService) {}

  @Post()
  async execute(@Body() body: any) {
    return ok(await this.gupshup.providerAction({
      appId: body.appId,
      action: body.action,
      payload: body.payload || {},
    }));
  }
}
