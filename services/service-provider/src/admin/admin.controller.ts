import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { AdminService } from './admin.service';
import { ProviderApp } from '../models/provider-app.schema';
import { ProviderSubscription } from '../models/provider-subscription.schema';

/**
 * Admin endpoints for BSP management — protected by internal service secret.
 * Replaces all /super-admin/gupshup/* routes from the main server.
 * Called via API gateway or directly from super-admin UI with x-internal-service-secret.
 */
@Controller('/internal/v1/bsp/admin')
@UseGuards(InternalAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
    @InjectModel(ProviderSubscription.name) private readonly subscriptionModel: Model<ProviderSubscription>,
  ) {}

  // ── Reconciliation ────────────────────────────────────────────────────

  @Post('reconcile')
  async reconcile(@Body() body: any) {
    return ok(await this.adminService.reconcile(body.workspaceId));
  }

  // ── System Health ─────────────────────────────────────────────────────

  @Get('health')
  async health() {
    return ok(await this.adminService.health());
  }

  // ── Webhook Management ────────────────────────────────────────────────

  @Get('webhook-status')
  async getWebhookStatus(@Query('workspaceId') workspaceId?: string) {
    return ok(await this.adminService.getWebhookStatus(workspaceId));
  }

  @Post('sync-webhooks')
  async syncAllWebhooks(@Body() body: any) {
    return ok(await this.adminService.syncAllWebhooks(body));
  }

  @Post('sync-webhook/:appId')
  async syncSpecificWebhook(@Param('appId') appId: string, @Body() body: any) {
    return ok(await this.adminService.syncSpecificWebhook(appId, body));
  }

  @Delete('subscription/:appId/:subscriptionId')
  async deleteSubscription(@Param('appId') appId: string, @Param('subscriptionId') subscriptionId: string) {
    return ok(await this.adminService.deleteSubscription(appId, subscriptionId));
  }

  // ── Developer Config ──────────────────────────────────────────────────

  @Get('developer-config')
  async getDeveloperConfig() {
    return ok(await this.adminService.getDeveloperConfig());
  }

  @Patch('developer-config')
  async patchDeveloperConfig(@Body() body: any) {
    return ok(await this.adminService.patchDeveloperConfig(body));
  }

  // ── ESB Flow Admin ────────────────────────────────────────────────────

  @Get('esb-flow-list')
  async listEsbFlows(@Query('status') status?: string) {
    return ok(await this.adminService.listEsbFlows(status));
  }

  // ── App List ─────────────────────────────────────────────────────────

  @Get('apps')
  async listApps(@Query('workspaceId') workspaceId?: string) {
    const query = workspaceId ? { workspaceId } : {};
    const apps = await this.appModel
      .find(query)
      .select('-whatsappAccessToken -whatsappVerifyToken -accessToken -gupshupIdentity')
      .sort({ updatedAt: -1 })
      .lean();
    return ok(apps);
  }
}
