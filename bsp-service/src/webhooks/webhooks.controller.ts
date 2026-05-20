import { Body, Controller, Get, Headers, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ok } from '../common/api-response';
import { config } from '../config';
import { WebhooksService } from './webhooks.service';

@Controller('/webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get('gupshup')
  verify(@Query('hub.mode') mode: string, @Query('hub.challenge') challenge: string, @Query('hub.verify_token') token: string, @Res() res: Response) {
    if (mode === 'subscribe' && challenge) {
      if (!config.gupshup.verifyToken || token !== config.gupshup.verifyToken) {
        return res.status(403).send('Forbidden');
      }
      return res.status(200).send(challenge);
    }
    return res.status(200).send('OK');
  }

  @Post('gupshup')
  async receive(@Req() req: Request, @Headers() headers: Record<string, string | string[] | undefined>, @Body() body: any) {
    const rawBody = (req as any).rawBody || JSON.stringify(body);
    return ok(await this.webhooks.receiveGupshup(rawBody, headers, body));
  }
}
