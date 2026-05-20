import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { WorkspaceAuthGuard } from '../common/workspace-auth.guard';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { WorkspaceService } from './workspace.service';

/**
 * Public workspace-scoped BSP endpoints.
 * All routes under /bsp/v1/workspace/* require a valid JWT (WorkspaceAuthGuard).
 * The guard extracts workspaceId from the token — no workspaceId in URL needed.
 */
@Controller('/bsp/v1/workspace')
@UseGuards(WorkspaceAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  // ── WABA / Connection Settings ─────────────────────────────────────────

  @Get('waba')
  async getWabaSettings(@Req() req: any) {
    return ok(await this.workspaceService.getWabaSettings(req.workspace._id));
  }

  @Patch('waba')
  async updateWabaSettings(@Req() req: any, @Body() body: any) {
    return ok(await this.workspaceService.updateWabaSettings(req.workspace._id, body));
  }

  @Get('waba/subscription-status')
  async getSubscriptionStatus(@Req() req: any) {
    return ok(await this.workspaceService.getSubscriptionStatus(req.workspace._id));
  }

  @Post('waba/test')
  async testWabaConnection(@Req() req: any) {
    return ok(await this.workspaceService.testConnection(req.workspace._id));
  }

  // ── WhatsApp Profile ───────────────────────────────────────────────────

  @Get('profile')
  async getProfile(@Req() req: any) {
    return ok(await this.workspaceService.getProfile(req.workspace._id));
  }

  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() body: any) {
    return ok(await this.workspaceService.updateProfile(req.workspace._id, body));
  }

  @Post('profile/sync')
  async syncProfile(@Req() req: any) {
    return ok(await this.workspaceService.syncProfile(req.workspace._id));
  }

  @Patch('profile/display-name')
  async updateDisplayName(@Req() req: any, @Body() body: any) {
    return ok(await this.workspaceService.updateDisplayName(req.workspace._id, body.name || body.displayName));
  }

  // ── WhatsApp Health ────────────────────────────────────────────────────

  @Get('whatsapp/health')
  async getWhatsappHealth(@Req() req: any) {
    return ok(await this.workspaceService.getWhatsappHealth(req.workspace._id));
  }

  // ── Phone Numbers ──────────────────────────────────────────────────────

  @Get('phone-numbers')
  async getPhoneNumbers(@Req() req: any) {
    return ok(await this.workspaceService.getPhoneNumbers(req.workspace._id));
  }

  // ── Webhook Subscriptions ──────────────────────────────────────────────

  @Get('webhooks')
  async listWebhooks(@Req() req: any) {
    return ok(await this.workspaceService.listWebhooks(req.workspace._id));
  }

  @Post('webhooks')
  async createWebhook(@Req() req: any, @Body() body: any) {
    return ok(await this.workspaceService.createWebhook(req.workspace._id, body));
  }

  @Patch('webhooks/:id')
  async updateWebhook(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return ok(await this.workspaceService.updateWebhook(req.workspace._id, id, body));
  }

  @Delete('webhooks/:id')
  async deleteWebhook(@Req() req: any, @Param('id') id: string) {
    return ok(await this.workspaceService.deleteWebhook(req.workspace._id, id));
  }

  // ── Connection Status (used by frontend onboarding check) ─────────────

  @Get('connection-status')
  async getConnectionStatus(@Req() req: any) {
    return ok(await this.workspaceService.getConnectionStatus(req.workspace._id));
  }
}

/**
 * Internal admin endpoint — service-secret only, no JWT.
 * Used by main server to push cache updates into BspApp.
 */
@Controller('/internal/v1/bsp/workspace')
@UseGuards(InternalAuthGuard)
export class WorkspaceInternalController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post(':workspaceId/sync-connection')
  async syncConnection(@Param('workspaceId') workspaceId: string, @Body() body: any) {
    return ok(await this.workspaceService.syncConnectionFromMain(workspaceId, body));
  }
}
