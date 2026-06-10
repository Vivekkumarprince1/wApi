import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProviderEsbFlow, EsbFlowStatus } from '../../../models/provider-esb-flow.schema';

@Injectable()
export class EsbFlowService {
  constructor(
    @InjectModel(ProviderEsbFlow.name) private readonly esbFlowModel: Model<ProviderEsbFlow>,
  ) {}

  async upsertEsbFlow(workspaceId: string, data: Partial<ProviderEsbFlow>) {
    return this.esbFlowModel.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          workspace: workspaceId,
          ...data,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  }

  async getEsbFlow(workspaceId: string) {
    return this.esbFlowModel.findOne({ workspace: workspaceId });
  }

  async getEsbFlowPublic(workspaceId: string) {
    return this.esbFlowModel.findOne({ workspace: workspaceId }).select('-userAccessToken -userRefreshToken -systemUserToken -phoneOTPCode');
  }

  async updateEsbFlowStatus(workspaceId: string, status: EsbFlowStatus) {
    return this.esbFlowModel.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  async setEsbTokens(workspaceId: string, tokens: {
    userAccessToken: string;
    userRefreshToken: string;
    tokenExpiry: Date;
    systemUserId?: string;
    systemUserToken?: string;
    systemUserTokenExpiry?: Date;
  }) {
    return this.esbFlowModel.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          ...tokens,
          status: 'token_exchanged' as EsbFlowStatus,
          updatedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  async recordEsbCallback(workspaceId: string, callbackData: {
    callbackState: string;
    callbackReceived: boolean;
    callbackReceivedAt: Date;
    callbackData: Record<string, unknown>;
  }) {
    return this.esbFlowModel.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          ...callbackData,
          updatedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  async updateTokenRefresh(workspaceId: string, refreshStatus: {
    lastTokenRefreshAttempt: Date;
    lastTokenRefreshError?: string;
  }) {
    return this.esbFlowModel.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          ...refreshStatus,
          updatedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  async getEsbFlowStatus(workspaceId: string) {
    const flow = await this.esbFlowModel.findOne({ workspace: workspaceId }).select('status accountBlocked capabilityBlocked');
    return {
      status: flow?.status || 'not_started',
      accountBlocked: flow?.accountBlocked || false,
      capabilityBlocked: flow?.capabilityBlocked || false,
    };
  }

  async completeEsbFlow(workspaceId: string) {
    return this.esbFlowModel.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          status: 'completed' as EsbFlowStatus,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  async failEsbFlow(workspaceId: string, reason: string) {
    return this.esbFlowModel.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          status: 'failed' as EsbFlowStatus,
          failedAt: new Date(),
          failureReason: reason,
          updatedAt: new Date(),
        },
      },
      { new: true },
    );
  }
}
