import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProviderApp } from '../models/provider-app.schema';
import { ProviderSubscription } from '../models/provider-subscription.schema';
import { ProviderEsbFlow } from '../models/provider-esb-flow.schema';
import { GupshupClientService } from '../channels/whatsapp/providers/gupshup/gupshup-client.service';
import { config } from '../config';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
    @InjectModel(ProviderSubscription.name) private readonly subscriptionModel: Model<ProviderSubscription>,
    @InjectModel(ProviderEsbFlow.name) private readonly esbFlowModel: Model<ProviderEsbFlow>,
    private readonly gupshup: GupshupClientService,
  ) {}

  async reconcile(workspaceId?: string) {
    const query = workspaceId ? { workspaceId } : {};
    const apps = await this.appModel
      .find(query)
      .select('workspaceId appId gupshupAppId status')
      .limit(200)
      .lean();

    const results = { total: apps.length, processed: 0, failed: 0, details: [] as any[] };

    for (const app of apps) {
      try {
        await this.gupshup.getApp(app.gupshupAppId || app.appId);
        results.processed++;
        results.details.push({ workspaceId: app.workspaceId, appId: app.appId, status: 'reconciled' });
      } catch (err: any) {
        results.failed++;
        results.details.push({ workspaceId: app.workspaceId, appId: app.appId, status: 'failed', error: err.message });
      }
    }

    return results;
  }

  async health() {
    const [totalApps, connectedApps, esbFlowCount, subscriptionCount] = await Promise.all([
      this.appModel.countDocuments({}),
      this.appModel.countDocuments({ status: { $in: ['connected', 'active'] } }),
      this.esbFlowModel.countDocuments({}),
      this.subscriptionModel.countDocuments({ status: 'active' }),
    ]);

    return {
      status: 'ok',
      provider: 'gupshup',
      totalApps,
      connectedApps,
      esbFlowCount,
      activeSubscriptions: subscriptionCount,
      checkedAt: new Date(),
    };
  }

  async getWebhookStatus(workspaceId?: string) {
    const query: any = { status: { $ne: 'deleted' } };
    if (workspaceId) query.workspaceId = workspaceId;

    const subs = await this.subscriptionModel.find(query).lean();

    if (workspaceId) {
      return {
        workspaceId,
        subscriptions: subs.map((sub: any) => ({
          id: String(sub._id),
          providerSubscriptionId: sub.providerData?.providerSubscriptionId,
          url: sub.callbackUrl,
          modes: sub.events || [],
          events: sub.events || [],
          status: sub.status || 'unknown',
          syncedAt: sub.providerData?.syncedAt || sub.updatedAt || null,
          providerData: sub.providerData || {},
        })),
        syncStatus: subs.length ? 'synced' : 'not_configured',
        lastSyncedAt: subs.reduce((latest: Date | null, sub: any) => {
          const candidate = sub.providerData?.syncedAt || sub.updatedAt;
          const date = candidate ? new Date(candidate) : null;
          if (!date || Number.isNaN(date.getTime())) return latest;
          return !latest || date > latest ? date : latest;
        }, null),
      };
    }

    // Group by workspaceId for multi-workspace view
    const grouped = subs.reduce((acc: any, sub: any) => {
      const id = sub.workspaceId;
      acc[id] = acc[id] || [];
      acc[id].push(sub);
      return acc;
    }, {});

    return grouped;
  }

  async syncSpecificAppSubscriptions(appId: string, body: any = {}) {
    const app = await this.appModel
      .findOne({
        $or: [
          { appId },
          { gupshupAppId: appId },
          { 'gupshupIdentity.partnerAppId': appId },
        ],
      })
      .select('workspaceId appId gupshupAppId gupshupIdentity')
      .lean();

    const workspaceId = app?.workspaceId || body.workspaceId;
    if (!workspaceId) {
      throw new Error(`No workspace mapping found for Gupshup app ${appId}`);
    }

    const providerAppId = app?.gupshupAppId || app?.gupshupIdentity?.partnerAppId || appId;
    const subscriptions = await this.gupshup.listSubscriptions(providerAppId);
    const syncedAt = new Date();
    const returnedProviderIds = new Set<string>();
    const returnedUrls = new Set<string>();

    const upserted = [];
    for (const sub of subscriptions) {
      const providerSubscriptionId = String(sub.id || sub.subscriptionId || '').trim();
      const callbackUrl = String(sub.url || sub.callbackUrl || '').trim();
      if (!callbackUrl) continue;

      if (providerSubscriptionId) returnedProviderIds.add(providerSubscriptionId);
      returnedUrls.add(callbackUrl);

      const events = Array.isArray(sub.modes)
        ? sub.modes
        : Array.isArray(sub.events)
          ? sub.events
          : [];

      const saved = await this.subscriptionModel.findOneAndUpdate(
        {
          workspaceId,
          provider: 'gupshup',
          appId: providerAppId,
          callbackUrl,
        },
        {
          $set: {
            workspaceId,
            provider: 'gupshup',
            appId: providerAppId,
            callbackUrl,
            events,
            status: sub.active === false ? 'disabled' : 'active',
            providerData: {
              gupshupResponse: sub,
              providerSubscriptionId: providerSubscriptionId || undefined,
              source: 'app_subscription_sync',
              syncedAt,
            },
          },
        },
        { upsert: true, new: true },
      );
      upserted.push(saved);
    }

    const staleQuery: any = {
      workspaceId,
      provider: 'gupshup',
      appId: providerAppId,
      status: { $ne: 'deleted' },
    };
    if (returnedUrls.size > 0) {
      staleQuery.callbackUrl = { $nin: Array.from(returnedUrls) };
    }

    const stale = await this.subscriptionModel.updateMany(staleQuery, {
      $set: {
        status: 'disabled',
        'providerData.source': 'app_subscription_sync',
        'providerData.syncedAt': syncedAt,
        'providerData.staleReason': 'missing_from_gupshup_subscription_list',
      },
    });

    return {
      appId: providerAppId,
      workspaceId,
      synced: upserted.length,
      disabled: stale.modifiedCount || 0,
      subscriptions,
      providerSubscriptionIds: Array.from(returnedProviderIds),
    };
  }

  async syncAllWebhooks(body: any) {
    const { url, modes, strategy } = body;
    const webhookUrl = url || this.defaultWebhookUrl();

    const apps = await this.appModel
      .find({ status: { $in: ['connected', 'active'] } })
      .select('workspaceId appId gupshupAppId gupshupIdentity')
      .lean();

    const results = { synced: 0, failed: 0, total: apps.length, details: [] as any[] };

    for (const app of apps) {
      const providerAppId = this.providerAppId(app);

      try {
        const response = await this.gupshup.setSubscription({
          appId: providerAppId,
          url: webhookUrl,
          events: modes || [],
          strategy: strategy || 'update',
        });

        const callbackUrl = response?.registeredUrl || webhookUrl;

        await this.subscriptionModel.findOneAndUpdate(
          { workspaceId: app.workspaceId, appId: providerAppId, callbackUrl },
          {
            $set: {
              workspaceId: app.workspaceId,
              provider: 'gupshup',
              appId: providerAppId,
              callbackUrl,
              events: modes || [],
              status: 'active',
              providerData: { gupshupResponse: response, source: 'admin_bulk_sync', syncedAt: new Date() },
            },
          },
          { upsert: true },
        );

        results.synced++;
        results.details.push({ workspaceId: app.workspaceId, appId: providerAppId, status: 'synced' });
      } catch (err: any) {
        results.failed++;
        results.details.push({ workspaceId: app.workspaceId, appId: providerAppId, status: 'failed', error: err.message });
      }
    }

    return results;
  }

  async syncSpecificWebhook(appId: string, body: any) {
    const { url, modes, strategy } = body;
    const webhookUrl = url || this.defaultWebhookUrl();

    const response = await this.gupshup.setSubscription({
      appId,
      url: webhookUrl,
      events: modes || [],
      strategy: strategy || 'update',
    });
    const callbackUrl = response?.registeredUrl || webhookUrl;

    const app = await this.appModel.findOne({
      $or: [
        { appId },
        { gupshupAppId: appId },
        { 'gupshupIdentity.partnerAppId': appId },
      ],
    });

    if (app) {
      await this.subscriptionModel.findOneAndUpdate(
        { workspaceId: app.workspaceId, appId, callbackUrl },
        {
          $set: {
            workspaceId: app.workspaceId,
            provider: 'gupshup',
            appId,
            callbackUrl,
            events: modes || [],
            status: 'active',
            providerData: { gupshupResponse: response, source: 'admin_specific_sync', syncedAt: new Date() },
          },
        },
        { upsert: true },
      );
    }

    return { synced: true, appId, callbackUrl, response };
  }

  private defaultWebhookUrl() {
    return (
      process.env.WHATSAPP_WEBHOOK_URL ||
      process.env.APP_URL ||
      `${config.mainServiceUrl.replace(/\/+$/, '')}/api/webhooks/whatsapp`
    );
  }

  private providerAppId(app: any) {
    return app?.gupshupAppId || app?.gupshupIdentity?.partnerAppId || app?.appId;
  }

  async deleteSubscription(appId: string, subscriptionId: string) {
    const updated = await this.subscriptionModel.findByIdAndUpdate(
      subscriptionId,
      { $set: { status: 'deleted' } },
      { new: true },
    );
    return { deleted: true, subscriptionId, appId };
  }

  async getDeveloperConfig() {
    return {
      provider: 'gupshup',
      partnerBaseUrl: config.gupshup.partnerBaseUrl,
      apiBaseUrl: config.gupshup.apiBaseUrl,
      partnerEmail: config.gupshup.partnerEmail,
      hasPartnerToken: !!config.gupshup.partnerToken,
      webhookSecret: config.gupshup.webhookSecret ? '***configured***' : 'NOT SET',
    };
  }

  async patchDeveloperConfig(body: any) {
    // Config is env-based; in production this would update a secure config store.
    // Returning confirmation that the request was received.
    return { updated: false, message: 'Developer config is managed via environment variables. Update .env and restart.' };
  }

  async listEsbFlows(status?: string) {
    const query: any = status ? { status } : {};
    return this.esbFlowModel
      .find(query)
      .select('-userAccessToken -userRefreshToken -systemUserToken -phoneOTPCode')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
  }
}
