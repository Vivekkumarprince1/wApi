import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';

@Controller('/internal/v1/bsp/phones')
@UseGuards(InternalAuthGuard)
export class PhonesController {
  @Post('register')
  async register(@Body() body: any) {
    return ok({
      provider: body.provider || 'gupshup',
      appId: body.appId,
      phoneNumber: body.phoneNumber,
      region: body.region,
      status: 'pending_provider_integration',
    });
  }
}
