import { Body, Controller, Post, Get, Delete, UseGuards, Req, Param, Query } from '@nestjs/common';
import { Request } from 'express';
import { InternalAuthGuard } from '../../../common/internal-auth.guard';
import { WorkspaceAuthGuard } from '../../../common/workspace-auth.guard';
import { ok } from '../../../common/api-response';
import { OnboardingService } from './onboarding.service';

@Controller()
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  // Internal routes (guarded by service secret)
  @Post('/internal/v1/bsp/onboarding/start')
  @UseGuards(InternalAuthGuard)
  async start(@Body() body: any) {
    return ok(await this.onboarding.start(body));
  }

  @Post('/internal/v1/bsp/onboarding/complete')
  @UseGuards(InternalAuthGuard)
  async complete(@Body() body: any) {
    return ok(await this.onboarding.complete(body));
  }

  @Post('/internal/v1/bsp/onboarding/fallback')
  @UseGuards(InternalAuthGuard)
  async fallback(@Body() body: any) {
    return ok(await this.onboarding.recordFallback(body));
  }

  @Post('/internal/v1/bsp/onboarding/sync-state')
  @UseGuards(InternalAuthGuard)
  async syncState(@Body() body: any) {
    return ok(await this.onboarding.syncOnboardingState(body));
  }

  // Public routes (guarded by JWT from client auth)
  @Get('/bsp/v1/onboarding/status')
  @UseGuards(WorkspaceAuthGuard)
  async getStatus(@Req() req: any) {
    const { workspace } = req;
    return ok(await this.onboarding.getStatus(workspace._id));
  }

  @Post('/bsp/v1/onboarding/start')
  @UseGuards(WorkspaceAuthGuard)
  async bspStart(@Body() body: any, @Req() req: any) {
    const { workspace, user } = req;
    return ok(await this.onboarding.bspStart({
      ...body,
      workspaceId: workspace._id,
      userId: user._id,
      userEmail: user?.email || user?.username || body.userEmail || body.email,
    }));
  }

  @Post('/bsp/v1/onboarding/sync')
  @UseGuards(WorkspaceAuthGuard)
  async bspSync(@Body() body: any, @Req() req: any) {
    const { workspace } = req;
    return ok(await this.onboarding.bspSync({
      ...body,
      workspaceId: workspace._id,
    }));
  }

  @Post('/bsp/v1/onboarding/register-phone')
  @UseGuards(WorkspaceAuthGuard)
  async bspRegisterPhone(@Body() body: any, @Req() req: any) {
    const { workspace } = req;
    return ok(await this.onboarding.bspRegisterPhone({
      ...body,
      workspaceId: workspace._id,
    }));
  }

  @Post('/bsp/v1/onboarding/complete')
  @UseGuards(WorkspaceAuthGuard)
  async bspComplete(@Body() body: any, @Req() req: any) {
    const { workspace, user } = req;
    return ok(await this.onboarding.bspComplete({
      ...body,
      workspaceId: workspace._id,
      userId: user._id,
    }));
  }

  @Post('/bsp/v1/onboarding/disconnect')
  @UseGuards(WorkspaceAuthGuard)
  async bspDisconnect(@Body() body: any, @Req() req: any) {
    const { workspace } = req;
    return ok(await this.onboarding.bspDisconnect({
      ...body,
      workspaceId: workspace._id,
    }));
  }

  @Get('/bsp/v1/onboarding/runtime-profile')
  @UseGuards(WorkspaceAuthGuard)
  async bspRuntimeProfile(@Query() query: any, @Req() req: any) {
    const { workspace } = req;
    return ok(await this.onboarding.bspRuntimeProfile({
      ...query,
      workspaceId: workspace._id,
    }));
  }

  @Get('/bsp/v1/onboarding/callback')
  async bspCallback(@Query() qs: any, @Req() req: any) {
    return await this.onboarding.bspCallback({
      code: qs.code || qs.appId,
      state: qs.state,
      error: qs.error,
      message: qs.error_description || qs.message,
      rawQuery: qs,
    }, req);
  }
}
