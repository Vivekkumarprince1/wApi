import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProviderApp } from '../../../models/provider-app.schema';
import { ProviderSubscription } from '../../../models/provider-subscription.schema';
import { GupshupClientService } from '../providers/gupshup/gupshup-client.service';

@Injectable()
export class WebhookSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WebhookSyncService.name);

  constructor(
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
    @InjectModel(ProviderSubscription.name) private readonly subscriptionModel: Model<ProviderSubscription>,
    private readonly gupshup: GupshupClientService,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.AUTO_SYNC_WEBHOOKS_ON_BOOT !== 'true') {
      this.logger.log('Automatic webhook subscription sync is disabled. Set AUTO_SYNC_WEBHOOKS_ON_BOOT=true to enable it.');
      return;
    }

    this.logger.log('Starting automatic webhook subscription registration & sync...');
    const publicBase = process.env.APP_URL || process.env.WHATSAPP_WEBHOOK_URL;
    if (!publicBase) {
      this.logger.warn('APP_URL or WHATSAPP_WEBHOOK_URL is not set. Skipping webhook sync.');
      return;
    }

    try {
      const apps = await this.appModel.find({ appId: { $ne: null } }).exec();
      this.logger.log(`Found ${apps.length} WABA apps to verify webhook registration.`);

      for (const app of apps) {
        if (app.appId.startsWith('mock_')) {
          continue;
        }

        try {
          this.logger.log(`Verifying webhook subscription for app ${app.appId} (${app.appName || app.gupshupAppName || ''})...`);
          
          const callbackUrl = publicBase;
          
          const response = await this.gupshup.setSubscription({
            appId: app.appId,
            url: callbackUrl,
            events: ['MESSAGE', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'TEMPLATE', 'ACCOUNT', 'BILLING', 'PAYMENTS', 'FLOWS_MESSAGE'],
            strategy: 'update',
          });

          this.logger.log(`✓ Webhook registered successfully for app ${app.appId}. URL: ${response.registeredUrl}`);

          await this.subscriptionModel.findOneAndUpdate(
            { workspaceId: app.workspaceId, provider: 'gupshup', appId: app.appId, callbackUrl: response.registeredUrl },
            {
              $set: {
                workspaceId: app.workspaceId,
                provider: 'gupshup',
                appId: app.appId,
                callbackUrl: response.registeredUrl,
                events: ['MESSAGE', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'TEMPLATE', 'ACCOUNT', 'BILLING', 'PAYMENTS', 'FLOWS_MESSAGE'],
                status: 'active',
                providerData: { gupshupResponse: response },
              },
            },
            { upsert: true, new: true },
          );
        } catch (appErr: any) {
          this.logger.error(`✗ Failed to sync webhook for app ${app.appId}: ${appErr.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to complete webhook automatic sync: ${err.message}`);
    }
  }
}
