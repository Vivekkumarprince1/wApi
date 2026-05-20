import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BspApp } from '../models/bsp-app.schema';
import { BspSubscription } from '../models/bsp-subscription.schema';
import { BspEsbFlow } from '../models/bsp-esb-flow.schema';
import { GupshupClientService } from '../gupshup/gupshup-client.service';
import { config } from '../config';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(BspApp.name) private readonly appModel: Model<BspApp>,
    @InjectModel(BspSubscription.name) private readonly subscriptionModel: Model<BspSubscription>,
    @InjectModel(BspEsbFlow.name) private readonly esbFlowModel: Model<BspEsbFlow>,
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

    if (workspaceId) return subs[0] || null;

    // Group by workspaceId for multi-workspace view
    const grouped = subs.reduce((acc: any, sub: any) => {
      const id = sub.workspaceId;
      acc[id] = acc[id] || [];
      acc[id].push(sub);
      return acc;
    }, {});

    return grouped;
  }

  async syncAllWebhooks(body: any) {
    const { url, modes, strategy } = body;
    const webhookUrl = url || config.mainServiceUrl + '/api/webhooks/gupshup';

    const apps = await this.appModel
      .find({ status: { $in: ['connected', 'active'] } })
      .select('workspaceId appId gupshupAppId')
      .lean();

    const results = { synced: 0, failed: 0, total: apps.length, details: [] as any[] };

    for (const app of apps) {
      try {
        await this.gupshup.providerAction({
          appId: app.gupshupAppId || app.appId,
          action: 'subscribe_webhook',
          payload: { callbackUrl: webhookUrl, events: modes || [], strategy: strategy || 'update' },
        });

        await this.subscriptionModel.findOneAndUpdate(
          { workspaceId: app.workspaceId, appId: app.gupshupAppId || app.appId, callbackUrl: webhookUrl },
          { $set: { workspaceId: app.workspaceId, provider: 'gupshup', appId: app.gupshupAppId || app.appId, callbackUrl: webhookUrl, events: modes || [], status: 'active' } },
          { upsert: true },
        );

        results.synced++;
        results.details.push({ workspaceId: app.workspaceId, appId: app.appId, status: 'synced' });
      } catch (err: any) {
        results.failed++;
        results.details.push({ workspaceId: app.workspaceId, appId: app.appId, status: 'failed', error: err.message });
      }
    }

    return results;
  }

  async syncSpecificWebhook(appId: string, body: any) {
    const { url, modes, strategy } = body;
    const webhookUrl = url || config.mainServiceUrl + '/api/webhooks/gupshup';

    await this.gupshup.providerAction({
      appId,
      action: 'subscribe_webhook',
      payload: { callbackUrl: webhookUrl, events: modes || [], strategy: strategy || 'update' },
    });

    const app = await this.appModel.findOne({ $or: [{ appId }, { gupshupAppId: appId }] });

    if (app) {
      await this.subscriptionModel.findOneAndUpdate(
        { workspaceId: app.workspaceId, appId, callbackUrl: webhookUrl },
        { $set: { workspaceId: app.workspaceId, provider: 'gupshup', appId, callbackUrl: webhookUrl, events: modes || [], status: 'active' } },
        { upsert: true },
      );
    }

    return { synced: true, appId };
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
