import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { BspApp } from '../models/bsp-app.schema';
import { GupshupClientService } from '../gupshup/gupshup-client.service';
import { config } from '../config';

@Injectable()
export class AppsService {
  constructor(
    @InjectModel(BspApp.name) private readonly appModel: Model<BspApp>,
    private readonly gupshup: GupshupClientService,
  ) {}

  async create(input: any) {
    const provider = input.provider || 'gupshup';
    const appId = input.appId || `pending_${input.workspaceId}_${Date.now()}`;
    const app = await this.appModel.findOneAndUpdate(
      { workspaceId: input.workspaceId, provider, appId },
      {
        $set: {
          workspaceId: input.workspaceId,
          businessId: input.businessId,
          provider,
          appId,
          appName: input.appName,
          status: input.status || 'onboarding',
          providerData: input.providerData || {},
        },
      },
      { upsert: true, new: true },
    );
    return app;
  }

  async get(appId: string) {
    const app = await this.appModel.findOne({ appId });
    if (!app) throw new NotFoundException('BSP app not found');
    return app;
  }

  async remove(appId: string) {
    const app = await this.appModel.findOneAndUpdate(
      { appId },
      { $set: { status: 'disconnected' } },
      { new: true },
    );
    if (!app) throw new NotFoundException('BSP app not found');
    return app;
  }

  async syncProviderState(appId: string) {
    const providerState = await this.gupshup.getApp(appId);
    return this.appModel.findOneAndUpdate(
      { appId },
      { $set: { providerData: providerState } },
      { new: true },
    );
  }

  async syncWhatsappData(appId: string, data: any) {
    const update = {
      wabaId: data.wabaId,
      childWabaId: data.childWabaId,
      metaBusinessId: data.metaBusinessId,
      businessAccountId: data.businessAccountId,
      whatsappConnected: data.whatsappConnected ?? false,
      whatsappAccessToken: data.whatsappAccessToken,
      whatsappVerifyToken: data.whatsappVerifyToken,
      connectedAt: data.connectedAt,
      wabaStatus: data.wabaStatus,
      verifiedName: data.verifiedName,
      qualityRating: data.qualityRating,
      messagingLimitTier: data.messagingLimitTier,
      codeVerificationStatus: data.codeVerificationStatus,
      nameStatus: data.nameStatus,
      isOfficialAccount: data.isOfficialAccount ?? false,
      accessToken: data.accessToken,
      tokenExpiresAt: data.tokenExpiresAt,
    };

    return this.appModel.findOneAndUpdate(
      { appId },
      { $set: Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)) },
      { new: true },
    );
  }

  async syncGupshupData(appId: string, data: any) {
    const update = {
      gupshupAppId: data.gupshupAppId,
      gupshupAppName: data.gupshupAppName,
      onboardingStatus: data.onboardingStatus,
      gupshupAppLive: data.gupshupAppLive ?? false,
      gupshupAppHealth: data.gupshupAppHealth,
      gupshupWalletBalance: data.gupshupWalletBalance,
      gupshupRatings: data.gupshupRatings,
      gupshupIdentity: data.gupshupIdentity,
    };

    return this.appModel.findOneAndUpdate(
      { appId },
      { $set: Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)) },
      { new: true },
    );
  }

  async syncPhoneData(appId: string, data: any) {
    const update = {
      bspPhoneNumberId: data.bspPhoneNumberId,
      bspDisplayPhoneNumber: data.bspDisplayPhoneNumber,
      bspVerifiedName: data.bspVerifiedName,
      whatsappPhoneNumberId: data.whatsappPhoneNumberId,
      whatsappPhoneNumber: data.whatsappPhoneNumber,
      bspPhoneStatus: data.bspPhoneStatus,
      bspQualityRating: data.bspQualityRating,
      bspMessagingTier: data.bspMessagingTier,
      bspOnboardedAt: data.bspOnboardedAt,
      bspLastSyncedAt: data.bspLastSyncedAt,
      bspSyncStatus: data.bspSyncStatus,
      bspAudit: data.bspAudit,
      phoneNumbers: data.phoneNumbers,
    };

    return this.appModel.findOneAndUpdate(
      { appId },
      { $set: Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)) },
      { new: true },
    );
  }

  async getForWorkspace(workspaceId: string, provider: string = 'gupshup') {
    return this.appModel.findOne({ workspaceId, provider });
  }

  async getPublicData(appId: string) {
    return this.appModel.findOne({ appId }).select('-whatsappAccessToken -whatsappVerifyToken -accessToken -gupshupIdentity.appApiKey');
  }

  async syncCacheToMainServer(bspApp: any) {
    if (!bspApp.workspaceId) return;

    try {
      const cacheData = {
        workspaceId: bspApp.workspaceId,
        bspAppId: bspApp._id?.toString(),
        whatsappConnected: bspApp.whatsappConnected,
        bspPhoneNumberId: bspApp.bspPhoneNumberId,
        bspPhoneStatus: bspApp.bspPhoneStatus,
        gupshupAppId: bspApp.gupshupAppId,
      };

      await axios.post(
        `${config.mainServiceUrl}/api/internal/bsp/sync-app-cache`,
        cacheData,
        {
          headers: {
            'x-internal-service-secret': config.internalServiceSecret,
            'x-workspace-id': bspApp.workspaceId,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
    } catch (error: any) {
      console.warn('[BspAppService] Failed to sync cache to main server:', error.message);
    }
  }

  async updateWithFlexibleSync(appId: string, data: Record<string, unknown>) {
    const updated = await this.appModel.findOneAndUpdate(
      { appId },
      { $set: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) },
      { new: true }
    );

    if (updated) {
      await this.syncCacheToMainServer(updated);
    }

    return updated;
  }
}
