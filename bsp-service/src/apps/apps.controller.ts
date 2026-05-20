import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { AppsService } from './apps.service';

@Controller('/internal/v1/bsp/apps')
@UseGuards(InternalAuthGuard)
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  @Post()
  async create(@Body() body: any) {
    return ok(await this.apps.create(body));
  }

  @Get(':appId')
  async get(@Param('appId') appId: string) {
    return ok(await this.apps.get(appId));
  }

  @Delete(':appId')
  async remove(@Param('appId') appId: string) {
    return ok(await this.apps.remove(appId));
  }

  @Post(':appId/sync-whatsapp')
  async syncWhatsapp(@Param('appId') appId: string, @Body() body: any) {
    return ok(await this.apps.syncWhatsappData(appId, body));
  }

  @Post(':appId/sync-gupshup')
  async syncGupshup(@Param('appId') appId: string, @Body() body: any) {
    return ok(await this.apps.syncGupshupData(appId, body));
  }

  @Post(':appId/sync-phone')
  async syncPhone(@Param('appId') appId: string, @Body() body: any) {
    return ok(await this.apps.syncPhoneData(appId, body));
  }

  @Post(':appId/sync-cache')
  async syncCache(@Param('appId') appId: string, @Body() body: any) {
    const updated = await this.apps.updateWithFlexibleSync(appId, body);
    return ok(updated);
  }

  @Get(':workspaceId/workspace')
  async getForWorkspace(@Param('workspaceId') workspaceId: string) {
    const app = await this.apps.getForWorkspace(workspaceId);
    return ok(app || null);
  }
}
