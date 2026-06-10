import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProviderApp } from '../models/provider-app.schema';
import { ProviderProfile } from '../models/provider-profile.schema';
import { ProviderSubscription } from '../models/provider-subscription.schema';
import { GupshupClientService } from '../channels/whatsapp/providers/gupshup/gupshup-client.service';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
    @InjectModel(ProviderProfile.name) private readonly profileModel: Model<ProviderProfile>,
    @InjectModel(ProviderSubscription.name) private readonly subscriptionModel: Model<ProviderSubscription>,
    private readonly gupshup: GupshupClientService,
  ) {}

  private async getApp(workspaceId: string) {
    return this.appModel
      .findOne({ workspaceId, status: { $in: ['connected', 'active', 'onboarding'] } })
      .sort({ updatedAt: -1 });
  }

  // ── WABA / Connection Settings ─────────────────────────────────────────

  async getWabaSettings(workspaceId: string) {
    const app = await this.appModel
      .findOne({ workspaceId })
      .select('+whatsappAccessToken +whatsappVerifyToken')
      .lean();

    if (!app) {
      return {
        connected: false,
        whatsappPhoneNumberId: null,
        wabaId: null,
        businessAccountId: null,
        hasToken: false,
        connectedAt: null,
        phoneStatus: 'NOT_CONNECTED',
      };
    }

    return {
      connected: app.whatsappConnected,
      whatsappPhoneNumberId: app.bspPhoneNumberId,
      wabaId: app.wabaId,
      businessAccountId: app.businessAccountId,
      hasToken: !!(app.whatsappAccessToken || app.accessToken),
      connectedAt: app.connectedAt,
      phoneStatus: app.bspPhoneStatus,
      gupshupAppId: app.gupshupAppId,
      verifiedName: app.verifiedName || app.bspVerifiedName,
      qualityRating: app.qualityRating || app.bspQualityRating,
      messagingTier: app.bspMessagingTier,
    };
  }

  async updateWabaSettings(workspaceId: string, data: any) {
    const { whatsappAccessToken, whatsappPhoneNumberId, whatsappVerifyToken, wabaId, businessAccountId } = data;

    const update: Record<string, any> = {};
    if (whatsappAccessToken) update.whatsappAccessToken = whatsappAccessToken;
    if (whatsappPhoneNumberId) update.bspPhoneNumberId = whatsappPhoneNumberId;
    if (whatsappVerifyToken) update.whatsappVerifyToken = whatsappVerifyToken;
    if (wabaId) update.wabaId = wabaId;
    if (businessAccountId) update.businessAccountId = businessAccountId;
    if (Object.keys(update).length === 0) return { updated: false };

    const app = await this.appModel.findOneAndUpdate(
      { workspaceId },
      { $set: update },
      { new: true, sort: { updatedAt: -1 } },
    );

    if (!app) throw new NotFoundException('No BSP app found for this workspace');
    return { updated: true, appId: app.appId };
  }

  async getSubscriptionStatus(workspaceId: string) {
    const app = await this.getApp(workspaceId);
    if (!app?.gupshupAppId) {
      return { status: 'UNLINKED', message: 'No Gupshup app linked to this workspace' };
    }

    try {
      const result = await this.gupshup.providerAction({ appId: app.gupshupAppId, action: 'get_subscription_status', payload: {} });
      return { status: 'OK', data: result };
    } catch (err: any) {
      return { status: 'UNKNOWN', error: err.message };
    }
  }

  async testConnection(workspaceId: string) {
    const app = await this.appModel
      .findOne({ workspaceId })
      .select('+whatsappAccessToken +accessToken')
      .lean();

    if (!app) return { connected: false, reason: 'No BSP app found' };

    const hasToken = !!(app.whatsappAccessToken || app.accessToken);
    const phoneOk = app.bspPhoneStatus === 'CONNECTED';

    return {
      connected: app.whatsappConnected && phoneOk && hasToken,
      phoneStatus: app.bspPhoneStatus,
      hasToken,
      appId: app.gupshupAppId,
    };
  }

  // ── WhatsApp Profile ───────────────────────────────────────────────────

  async getProfile(workspaceId: string) {
    const app = await this.getApp(workspaceId);
    const profile = app?.gupshupAppId
      ? await this.profileModel.findOne({ workspaceId, appId: app.gupshupAppId }).lean()
      : null;

    const p = (profile?.profile || {}) as any;
    const statusOk = app?.bspPhoneStatus === 'CONNECTED' || app?.whatsappConnected;

    return {
      displayName: p.displayName || app?.bspVerifiedName || '',
      description: p.description || '',
      address: p.address || '',
      email: p.email || '',
      vertical: p.vertical || 'PROFESSIONAL_SERVICES',
      websites: p.websites || [],
      profilePicUrl: p.profilePicUrl || null,
      status: statusOk ? 'CONNECTED' : (app?.bspPhoneStatus || 'DISCONNECTED'),
      quality: app?.bspQualityRating || 'UNKNOWN',
      limit: app?.bspMessagingTier || 'UNKNOWN',
      lastSyncedAt: app?.bspLastSyncedAt || null,
    };
  }

  async updateProfile(workspaceId: string, data: any) {
    const { displayName, description, address, email, vertical, websites } = data;
    const app = await this.getApp(workspaceId);

    if (!app?.gupshupAppId) throw new NotFoundException('No Gupshup app assigned to this workspace');

    const profileUpdate = { displayName, description, address, email, vertical, websites };

    await this.profileModel.findOneAndUpdate(
      { workspaceId, appId: app.gupshupAppId },
      { $set: { workspaceId, provider: 'gupshup', appId: app.gupshupAppId, profile: profileUpdate, ...profileUpdate } },
      { upsert: true, new: true },
    );

    // Push to Gupshup
    await this.gupshup.providerAction({ appId: app.gupshupAppId, action: 'update_business_profile', payload: { description, address, email, vertical, websites } })
      .catch((e: any) => console.error('[WorkspaceService] Profile push to Gupshup failed:', e.message));

    return profileUpdate;
  }

  async syncProfile(workspaceId: string) {
    const app = await this.getApp(workspaceId);
    if (!app?.gupshupAppId) throw new NotFoundException('No Gupshup app assigned');

    const remote = await this.gupshup.providerAction({ appId: app.gupshupAppId, action: 'get_profile', payload: {} });

    await this.profileModel.findOneAndUpdate(
      { workspaceId, appId: app.gupshupAppId },
      { $set: { workspaceId, provider: 'gupshup', appId: app.gupshupAppId, profile: remote } },
      { upsert: true, new: true },
    );

    await this.appModel.findByIdAndUpdate(app._id, { $set: { bspLastSyncedAt: new Date() } });

    return remote;
  }

  async updateDisplayName(workspaceId: string, name: string) {
    const app = await this.getApp(workspaceId);
    if (!app?.gupshupAppId) throw new NotFoundException('No Gupshup app assigned');

    await this.gupshup.providerAction({ appId: app.gupshupAppId, action: 'update_profile_display_name', payload: { name } });
    await this.profileModel.findOneAndUpdate(
      { workspaceId, appId: app.gupshupAppId },
      { $set: { displayName: name } },
    );

    return { updated: true };
  }

  // ── WhatsApp Health ────────────────────────────────────────────────────

  async getWhatsappHealth(workspaceId: string) {
    const app = await this.getApp(workspaceId);
    return {
      qualityRating: app?.bspQualityRating || 'UNKNOWN',
      messagingLimit: app?.bspMessagingTier || 'UNKNOWN',
      phoneStatus: app?.bspPhoneStatus || (app?.whatsappConnected ? 'CONNECTED' : 'DISCONNECTED'),
      webhookPulse: 'OPERATIONAL',
      lastChecked: new Date(),
    };
  }

  // ── Phone Numbers ──────────────────────────────────────────────────────

  async getPhoneNumbers(workspaceId: string) {
    const app = await this.getApp(workspaceId);
    if (!app?.gupshupAppId) return { phoneNumbers: [] };

    try {
      const numbers = await this.gupshup.providerAction({ appId: app.gupshupAppId, action: 'list_phone_numbers', payload: {} });
      return { phoneNumbers: numbers };
    } catch {
      // Fall back to cached value
      return { phoneNumbers: app.phoneNumbers || [] };
    }
  }

  // ── Webhook Subscriptions ──────────────────────────────────────────────

  async listWebhooks(workspaceId: string) {
    const subs = await this.subscriptionModel
      .find({ workspaceId, status: { $ne: 'deleted' } })
      .lean();
    return { webhooks: subs };
  }

  async createWebhook(workspaceId: string, data: any) {
    const app = await this.getApp(workspaceId);
    if (!app?.gupshupAppId) throw new NotFoundException('No Gupshup app assigned');

    const sub = await this.subscriptionModel.findOneAndUpdate(
      { workspaceId, callbackUrl: data.url, appId: app.gupshupAppId },
      {
        $set: {
          workspaceId,
          provider: 'gupshup',
          appId: app.gupshupAppId,
          callbackUrl: data.url,
          events: data.events || [],
          status: 'active',
        },
      },
      { upsert: true, new: true },
    );

    // Register with Gupshup
    await this.gupshup.providerAction({ appId: app.gupshupAppId, action: 'subscribe_webhook', payload: { callbackUrl: data.url, events: data.events } })
      .catch((e: any) => console.error('[WorkspaceService] Webhook creation failed:', e.message));

    return sub;
  }

  async updateWebhook(workspaceId: string, id: string, data: any) {
    const sub = await this.subscriptionModel.findOneAndUpdate(
      { _id: id, workspaceId },
      { $set: { events: data.events, callbackUrl: data.url, isActive: data.isActive } },
      { new: true },
    );
    if (!sub) throw new NotFoundException('Webhook not found');
    return sub;
  }

  async deleteWebhook(workspaceId: string, id: string) {
    await this.subscriptionModel.findOneAndUpdate(
      { _id: id, workspaceId },
      { $set: { status: 'deleted' } },
    );
    return { deleted: true, id };
  }

  // ── Connection Status ──────────────────────────────────────────────────

  async getConnectionStatus(workspaceId: string) {
    const app = await this.getApp(workspaceId);
    return {
      connected: !!(app && (app.whatsappConnected || app.bspPhoneStatus === 'CONNECTED')),
      appId: app?.gupshupAppId || null,
      phoneStatus: app?.bspPhoneStatus || 'NOT_CONNECTED',
      verifiedName: app?.bspVerifiedName || null,
      qualityRating: app?.bspQualityRating || 'UNKNOWN',
    };
  }

  // ── Internal: cache sync from main server ──────────────────────────────

  async syncConnectionFromMain(workspaceId: string, data: any) {
    return this.appModel.findOneAndUpdate(
      { workspaceId },
      {
        $set: {
          whatsappConnected: data.whatsappConnected ?? false,
          bspPhoneNumberId: data.bspPhoneNumberId,
          bspPhoneStatus: data.bspPhoneStatus || 'PENDING',
          gupshupAppId: data.gupshupAppId,
          bspLastSyncedAt: new Date(),
        },
      },
      { sort: { updatedAt: -1 }, new: true },
    );
  }
}
