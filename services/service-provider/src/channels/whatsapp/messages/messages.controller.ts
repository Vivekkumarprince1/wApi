import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '../../../common/internal-auth.guard';
import { ok } from '../../../common/api-response';
import { MessagesService } from './messages.service';

@Controller('/internal/v1/bsp/messages')
@UseGuards(InternalAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post('send')
  async send(@Body() body: any) {
    return ok(await this.messages.send(body));
  }

  @Post('read')
  async markRead(@Body() body: any) {
    return ok(await this.messages.markRead(body));
  }
}
