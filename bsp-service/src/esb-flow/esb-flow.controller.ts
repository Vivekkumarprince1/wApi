import { Body, Controller, Post, Get, UseGuards, Param } from '@nestjs/common';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ok } from '../common/api-response';
import { EsbFlowService } from './esb-flow.service';

@Controller('/internal/v1/bsp/esb-flow')
@UseGuards(InternalAuthGuard)
export class EsbFlowController {
  constructor(private readonly esbFlowService: EsbFlowService) {}

  @Get(':workspaceId')
  async getEsbFlow(@Param('workspaceId') workspaceId: string) {
    const flow = await this.esbFlowService.getEsbFlow(workspaceId);
    return ok(flow || { status: 'not_started' });
  }

  @Post(':workspaceId/upsert')
  async upsertEsbFlow(@Param('workspaceId') workspaceId: string, @Body() data: any) {
    const flow = await this.esbFlowService.upsertEsbFlow(workspaceId, data);
    return ok(flow);
  }

  @Post(':workspaceId/status')
  async updateStatus(@Param('workspaceId') workspaceId: string, @Body() body: any) {
    const flow = await this.esbFlowService.updateEsbFlowStatus(workspaceId, body.status);
    return ok(flow);
  }

  @Post(':workspaceId/tokens')
  async setTokens(@Param('workspaceId') workspaceId: string, @Body() body: any) {
    const flow = await this.esbFlowService.setEsbTokens(workspaceId, body);
    return ok(flow);
  }

  @Post(':workspaceId/callback')
  async recordCallback(@Param('workspaceId') workspaceId: string, @Body() body: any) {
    const flow = await this.esbFlowService.recordEsbCallback(workspaceId, body);
    return ok(flow);
  }

  @Post(':workspaceId/complete')
  async completeFlow(@Param('workspaceId') workspaceId: string) {
    const flow = await this.esbFlowService.completeEsbFlow(workspaceId);
    return ok(flow);
  }

  @Post(':workspaceId/fail')
  async failFlow(@Param('workspaceId') workspaceId: string, @Body() body: any) {
    const flow = await this.esbFlowService.failEsbFlow(workspaceId, body.reason);
    return ok(flow);
  }
}
