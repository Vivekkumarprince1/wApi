import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { ProviderOnboardingSession } from '../../../models/provider-onboarding-session.schema';
import { ProviderApp } from '../../../models/provider-app.schema';
import { ProviderOnboardingState, OnboardingStep } from '../../../models/provider-onboarding-state.schema';
import { ProviderSubscription } from '../../../models/provider-subscription.schema';
import { GupshupClientService } from '../providers/gupshup/gupshup-client.service';
import { TemplateSeedingService } from './template-seeding.service';
import { config } from '../../../config';

const DEFAULT_WEBHOOK_EVENTS = [
  'MESSAGE',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'TEMPLATE',
  'ACCOUNT',
  'BILLING',
  'PAYMENTS',
  'FLOWS_MESSAGE',
];

@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(ProviderOnboardingSession.name) private readonly sessionModel: Model<ProviderOnboardingSession>,
    @InjectModel(ProviderApp.name) private readonly appModel: Model<ProviderApp>,
    @InjectModel(ProviderOnboardingState.name) private readonly stateModel: Model<ProviderOnboardingState>,
    @InjectModel(ProviderSubscription.name) private readonly subscriptionModel: Model<ProviderSubscription>,
    private readonly gupshup: GupshupClientService,
    private readonly templateSeeding: TemplateSeedingService,
  ) {}

  async start(input: any) {
    const state = randomUUID();
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const providerResult = await this.gupshup.createEmbeddedOnboardingLink({
      workspaceId: input.workspaceId,
      businessId: input.businessId,
      callbackUrl: input.callbackUrl,
      state,
      metadata: input.metadata,
    });

    await this.sessionModel.create({
      sessionId,
      workspaceId: input.workspaceId,
      businessId: input.businessId,
      userId: input.userId,
      provider: input.provider || 'gupshup',
      appId: providerResult.appId,
      state,
      callbackUrl: input.callbackUrl,
      status: 'started',
      expiresAt,
      metadata: input.metadata || {},
    });

    await this.appModel.findOneAndUpdate(
      { workspaceId: input.workspaceId, provider: input.provider || 'gupshup', appId: providerResult.appId },
      {
        $set: {
          workspaceId: input.workspaceId,
          businessId: input.businessId,
          provider: input.provider || 'gupshup',
          appId: providerResult.appId,
          status: 'onboarding',
          providerData: providerResult.providerResponse,
        },
      },
      { upsert: true },
    );

    return {
      onboardingSessionId: sessionId,
      provider: input.provider || 'gupshup',
      appId: providerResult.appId,
      url: providerResult.url,
      state,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async complete(input: any) {
    const query = input.onboardingSessionId
      ? { sessionId: input.onboardingSessionId }
      : { workspaceId: input.workspaceId, state: input.state };

    const session = await this.sessionModel.findOneAndUpdate(
      query,
      { $set: { status: 'completed' } },
      { new: true },
    );

    const fallbackPayload = session?.metadata?.fallbackPayload as any;
    const appId = input.appId || input.code || fallbackPayload?.appId || fallbackPayload?.code || session?.appId;
    if (!appId) {
      throw new Error('Missing BSP appId for onboarding completion');
    }

    const bspSession = (session?.metadata || {}) as any;
    const connectionType = bspSession.connectionType || bspSession.fallbackPayload?.connectionType;

    if (connectionType === 'new_number' && appId && !String(appId).startsWith('mock_')) {
      const phone = String(bspSession.phoneNumber || bspSession.userEmail || '').replace(/\D/g, '');
      if (phone) {
        await this.gupshup.registerPhoneForApp({
          appId,
          region: bspSession.region || 'IN',
          phoneNumber: phone,
        }).catch((e: any) => console.warn('[Complete] Phone reg fail:', e.message));
      }
    }

    // Profile Contact details sync with base64 fingerprint checking
    if (appId && !String(appId).startsWith('mock_')) {
      const businessName = bspSession.businessName || 'Business Owner';
      const email = bspSession.userEmail || `${input.workspaceId}@placeholder.com`;
      const phone = String(bspSession.phoneNumber || '').replace(/\D/g, '') || undefined;

      const contactFingerprint = Buffer.from(`${businessName}:${email}:${phone || ''}`).toString('base64');
      
      const appRecord = await this.appModel.findOne({ workspaceId: input.workspaceId, appId });
      const oldFingerprint = (appRecord?.providerData as any)?.contactSyncFingerprint;

      if (oldFingerprint !== contactFingerprint) {
        console.log(`[OnboardingService:complete] Syncing profile contact details for ${appId}...`);
        await this.gupshup.updateOnboardingContact({
          appId,
          contactName: businessName,
          contactEmail: email,
          contactNumber: phone,
        }).then(async () => {
          await this.appModel.findOneAndUpdate(
            { workspaceId: input.workspaceId, appId },
            {
              $set: {
                'providerData.contactSyncFingerprint': contactFingerprint,
                'providerData.contactSyncedAt': new Date(),
              },
            }
          );
        }).catch((e: any) => console.warn('[Complete] Profile contact sync failed:', e.message));
      }
    }

    const app = await this.appModel.findOneAndUpdate(
      { workspaceId: input.workspaceId, provider: input.provider || 'gupshup', appId },
      {
        $set: {
          status: 'connected',
          connectedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    // Trigger auto sync after connection
    await this.bspSync({ workspaceId: input.workspaceId, appId }).catch((e: any) =>
      console.warn('[Complete] Auto sync failed:', e.message)
    );

    await this.ensureDefaultWebhookSubscription(input.workspaceId, appId).catch((e: any) =>
      console.warn('[Complete] Default webhook subscription failed:', e.message)
    );

    await this.templateSeeding.seedBestPracticeTemplates(input.workspaceId).catch((e: any) =>
      console.warn('[Complete] Template seeding failed:', e.message)
    );

    return { app, connectedAt: new Date().toISOString() };
  }

  async recordFallback(input: any) {
    const state = input.state ? String(input.state) : undefined;
    const fallbackPayload = {
      code: input.code,
      appId: input.appId || input.code,
      error: input.error,
      message: input.message,
      rawQuery: input.rawQuery || {},
      receivedAt: input.receivedAt || new Date().toISOString(),
    };

    const session = state
      ? await this.sessionModel.findOneAndUpdate(
          { state },
          {
            $set: {
              status: input.error ? 'failed' : 'started',
              'metadata.fallbackPayload': fallbackPayload,
              'metadata.fallbackReceivedAt': new Date(),
            },
          },
          { new: true },
        )
      : null;

    return {
      stored: !!session,
      state,
      onboardingSessionId: session?.sessionId,
      appId: fallbackPayload.appId,
      error: fallbackPayload.error,
    };
  }

  // Public API methods (called by client via JWT auth)

  async syncOnboardingState(input: any) {
    const { workspaceId, step } = input;
    if (!workspaceId) throw new Error('workspaceId required');

    const stepOrder: OnboardingStep[] = [
      'EMAIL_VERIFICATION',
      'PHONE_VERIFICATION',
      'BUSINESS_INFO',
      'BUSINESS_VERIFICATION',
      'BUSINESS_CONFIRMATION',
      'APP_ASSIGNMENT',
      'COMPLETED',
    ];

    const state = await this.stateModel.findOneAndUpdate(
      { workspace: workspaceId },
      {
        $set: {
          workspace: workspaceId,
          currentStep: step || 'BUSINESS_VERIFICATION',
          status: 'in_progress',
          updatedAt: new Date(),
        },
        $addToSet: { completedSteps: step || 'BUSINESS_VERIFICATION' },
      },
      { upsert: true, new: true },
    );

    return state;
  }

  async getStatus(workspaceId: string) {
    const app = await this.appModel.findOne({
      workspaceId,
      status: { $in: ['connected', 'active'] },
    });

    const state = await this.stateModel.findOne({ workspace: workspaceId });

    return {
      success: true,
      connected: !!app && app.status === 'connected',
      status: app?.status || 'not_started',
      app: app ? {
        appId: app.appId,
        provider: app.provider,
        status: app.status,
        connectedAt: app.connectedAt,
      } : null,
      onboarding: state ? {
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        status: state.status,
      } : null,
    };
  }

  async bspStart(input: any) {
    const { workspaceId, userId, provider = 'gupshup' } = input;
    const businessId = input.businessId || input.business_id || workspaceId;
    const callbackUrl =
      input.callbackUrl ||
      input.callback_url ||
      process.env.ESB_CALLBACK_URL ||
      'http://localhost:5001/api/v1/onboarding/bsp/callback';
    const state = randomUUID();
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    let businessName = input.businessName || input.business_id || businessId;
    let userEmail = input.userEmail || input.email;

    try {
      const db = this.appModel.db.useDb('wapi');
      if (businessId && Types.ObjectId.isValid(businessId)) {
        const businessDoc = await db.collection('businesses').findOne({ _id: new Types.ObjectId(businessId) });
        if (businessDoc) {
          businessName = businessDoc.name || businessDoc.legalName || businessName;
        }
      }
    } catch (err: any) {
      console.warn('[OnboardingService] Failed to fetch business details:', err.message);
    }

    try {
      const db = this.appModel.db.useDb('wapi');
      if (userId && Types.ObjectId.isValid(userId)) {
        const userDoc = await db.collection('users').findOne({ _id: new Types.ObjectId(userId) });
        if (userDoc) {
          userEmail = userDoc.email || userDoc.username || userDoc.emailAddress || userEmail;
        }
      }
    } catch (err: any) {
      console.warn('[OnboardingService] Failed to fetch user details:', err.message);
    }

    // Cost-saving database sandbox app reclaim waterfall step
    let existingApp = await this.appModel.findOne({
      workspaceId,
      provider,
      status: { $in: ['sandbox', 'inactive', 'disconnected'] },
    });

    if (!existingApp) {
      existingApp = await this.appModel.findOne({
        provider,
        workspaceId: { $exists: false },
        status: { $in: ['sandbox', 'inactive', 'disconnected'] },
      });
    }

    let providerResult: any;
    if (existingApp?.appId) {
      console.log(`[OnboardingService:bspStart] Reclaiming existing local sandbox app: ${existingApp.appId}`);
      
      const pToken = await this.gupshup.getPartnerToken();
      const embed = await this.gupshup.partnerClient.get(
        `/partner/app/${existingApp.appId}/onboarding/embed/link?user=${encodeURIComponent(userEmail || 'system')}&lang=en`,
        {
          headers: {
            token: pToken,
            Accept: 'application/json',
          },
        }
      ).catch(() => null);

      if (embed?.data?.status === 'success' && embed?.data?.link) {
        providerResult = {
          appId: existingApp.appId,
          url: embed.data.link,
          providerResponse: {
            mode: 'live',
            provider: 'gupshup',
            reclaimed: true,
            embedLinkResponse: embed.data,
          },
        };
      }
    }

    if (!providerResult) {
      providerResult = await this.gupshup.createEmbeddedOnboardingLink({
        workspaceId,
        businessId,
        callbackUrl,
        state,
        metadata: {
          ...input.metadata,
          businessName,
        },
        user: userEmail,
      });
    }

    await this.sessionModel.create({
      sessionId,
      workspaceId,
      businessId,
      userId,
      provider,
      appId: providerResult.appId,
      state,
      callbackUrl,
      status: 'started',
      expiresAt,
      metadata: {
        ...(input.metadata || {}),
        businessName,
        userEmail,
      },
    });

    await this.appModel.findOneAndUpdate(
      { workspaceId, provider, appId: providerResult.appId },
      {
        $set: {
          workspaceId,
          businessId,
          provider,
          appId: providerResult.appId,
          status: 'onboarding',
          providerData: providerResult.providerResponse,
        },
      },
      { upsert: true },
    );

    return {
      success: true,
      onboardingSessionId: sessionId,
      provider,
      appId: providerResult.appId,
      url: providerResult.url,
      state,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async bspSync(input: any) {
    const { workspaceId, appId } = input;
    let targetAppId = appId;

    if (!targetAppId) {
      const activeApp = await this.appModel.findOne({ workspaceId }).sort({ updatedAt: -1 });
      targetAppId = activeApp?.appId;
    }

    let app = targetAppId ? await this.appModel.findOne({ workspaceId, appId: targetAppId }) : null;

    if (!app) {
      // Self-healing: optimistically auto-heal/reclaim if recorded on the workspace document
      try {
        const db = this.appModel.db.useDb('wapi');
        const workspaceDoc = await db.collection('workspaces').findOne({ _id: new Types.ObjectId(workspaceId) });
        const workspaceAppId = workspaceDoc?.gupshupAppId || workspaceDoc?.gupshupIdentity?.partnerAppId;
        if (workspaceAppId) {
          const appName = workspaceDoc?.gupshupAppName || `waba_${workspaceId}`;
          app = await this.appModel.create({
            workspaceId: new Types.ObjectId(workspaceId),
            provider: 'gupshup',
            appId: workspaceAppId,
            appName,
            status: workspaceDoc?.whatsappConnected ? 'connected' : 'onboarding',
            whatsappConnected: !!workspaceDoc?.whatsappConnected,
          });
          targetAppId = workspaceAppId;
        }
      } catch (err: any) {
        console.warn('[OnboardingService:bspSync] Failed workspace recovery:', err.message);
      }
    }

    if (!app || !targetAppId) {
      throw new Error('No BSP app found to sync');
    }

    const isMock = String(targetAppId).startsWith('mock_');
    let updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (isMock) {
      updates = {
        ...updates,
        status: 'connected',
        connectedAt: app.connectedAt || new Date(),
        displayPhoneNumber: 'mock-phone',
        whatsappPhoneNumber: 'mock-phone',
        bspDisplayPhoneNumber: 'mock-phone',
        whatsappConnected: true,
        bspPhoneStatus: 'CONNECTED',
      };
    } else {
      // Query WABA Info
      const wabaInfo = await this.gupshup.getWabaInfo(targetAppId).catch(() => null);
      const info = wabaInfo?.wabaInfo || wabaInfo?.data || {};

      // OBO Whitelisting Flow: new WABA ID detection & Whitelisting
      const currentWabaId = info.wabaId || app.wabaId;
      const oldWabaId = app.wabaId;
      if (currentWabaId && currentWabaId !== oldWabaId) {
        console.log(`[BSP Sync] New WABA ID detected: ${currentWabaId}. Triggering OBO Whitelisting...`);
        await this.gupshup.whitelistWaba(targetAppId, currentWabaId).catch((err: any) => console.error('[BSP Sync] Whitelist failed:', err.message));
        await this.gupshup.verifyCreditLine(targetAppId).catch((err: any) => console.error('[BSP Sync] Credit line verify failed:', err.message));
      }

      // Fetch metrics
      const [health, balance, ratings] = await Promise.all([
        this.gupshup.getHealth(targetAppId).catch(() => null),
        this.gupshup.getWalletBalance(targetAppId).catch(() => null),
        this.gupshup.getRatings(targetAppId).catch(() => null),
      ]);

      let subscriptionCount = 0;
      try {
        const subscriptions = await this.gupshup.listSubscriptions(targetAppId);
        subscriptionCount = Array.isArray(subscriptions) ? subscriptions.length : 0;
      } catch (subErr: any) {
        console.warn(`[BSP Sync] Subscription query failed for ${targetAppId}:`, subErr.message);
      }

      const live = Boolean(info.accountStatus === 'ACTIVE' || wabaInfo?.status === 'success');
      const phone = info.phone || app.displayPhoneNumber;

      updates = {
        ...updates,
        status: live || phone ? 'connected' : 'onboarding',
        connectedAt: live || phone ? (app.connectedAt || new Date()) : app.connectedAt,
        displayPhoneNumber: phone,
        whatsappPhoneNumber: phone,
        bspDisplayPhoneNumber: phone,
        wabaId: currentWabaId || targetAppId,
        bspWabaId: currentWabaId || targetAppId,
        phoneNumberId: info.phoneNumberId || info.phone_number_id,
        whatsappPhoneNumberId: info.phoneNumberId || info.phone_number_id,
        bspPhoneNumberId: info.phoneNumberId || info.phone_number_id,
        verifiedName: info.verifiedName || app.verifiedName,
        bspVerifiedName: info.verifiedName || app.verifiedName,
        qualityRating: info.phoneQuality || 'UNKNOWN',
        bspQualityRating: info.phoneQuality || 'UNKNOWN',
        messagingLimitTier: info.messagingLimit || 'UNKNOWN',
        bspMessagingTier: info.messagingLimit || 'UNKNOWN',
        whatsappConnected: live || Boolean(phone),
        bspPhoneStatus: live || phone ? 'CONNECTED' : 'PENDING',
        gupshupAppLive: live,
        gupshupAppHealth: health?.healthy ?? health?.status === 'ALIVE',
        gupshupWalletBalance: balance?.balance || balance?.data?.balance,
        gupshupRatings: ratings?.ratings || ratings?.data || ratings,
        bspLastSyncedAt: new Date(),
        providerData: {
          ...app.providerData,
          wabaInfo,
          health,
          balance,
          ratings,
          subscriptionCount,
        },
      };
    }

    const updatedApp = await this.appModel.findOneAndUpdate(
      { workspaceId, appId: targetAppId },
      { $set: updates },
      { new: true }
    );

    if (!updatedApp) {
      throw new Error('No BSP app found to sync');
    }

    // Sync connection states back to main 'workspaces' collection in 'wapi' database
    try {
      const mainDb = this.appModel.db.useDb('wapi');
      const isMockApp = String(targetAppId).startsWith('mock_');
      const workspaceUpdates: Record<string, any> = {
        whatsappConnected: updates.whatsappConnected ?? false,
        gupshupAppLive: updates.gupshupAppLive ?? false,
        gupshupAppHealth: updates.gupshupAppHealth ?? false,
        gupshupWalletBalance: updates.gupshupWalletBalance,
        gupshupRatings: updates.gupshupRatings,
        onboardingStatus: updates.whatsappConnected ? 'completed' : 'pending_activation',
        bspPhoneStatus: updates.bspPhoneStatus || 'PENDING',
        connectedAt: updates.connectedAt,
        bspDisplayPhoneNumber: updates.displayPhoneNumber,
        whatsappPhoneNumber: updates.displayPhoneNumber,
        wabaId: updates.wabaId,
        bspWabaId: updates.wabaId,
        phoneNumberId: updates.phoneNumberId,
        whatsappPhoneNumberId: updates.phoneNumberId,
        bspPhoneNumberId: updates.phoneNumberId,
        verifiedName: updates.verifiedName,
        bspVerifiedName: updates.verifiedName,
        qualityRating: updates.qualityRating || 'UNKNOWN',
        bspQualityRating: updates.qualityRating || 'UNKNOWN',
        messagingLimitTier: updates.messagingLimitTier || 'UNKNOWN',
        bspMessagingTier: updates.messagingLimitTier || 'UNKNOWN',
        'onboarding.wabaConnectionCompleted': updates.whatsappConnected ?? false,
        'onboarding.wabaConnectionCompletedAt': updates.whatsappConnected ? new Date() : undefined,
        'esbFlow.status': updates.whatsappConnected ? 'completed' : (isMockApp ? 'completed' : 'phone_pending'),
        'esbFlow.completedAt': updates.whatsappConnected ? new Date() : undefined,
        gupshupAppId: targetAppId,
        gupshupAppName: updatedApp.appName,
      };

      await mainDb.collection('workspaces').updateOne(
        { _id: new Types.ObjectId(workspaceId) },
        { $set: workspaceUpdates }
      );
      
      console.log(`[BSP Sync] Successfully synced workspace connection states to wapi db for workspace ${workspaceId}`);
    } catch (err: any) {
      console.error('[BSP Sync] Failed to sync connection state back to main workspace collection:', err.message);
    }

    return {
      success: true,
      app: {
        appId: updatedApp.appId,
        provider: updatedApp.provider,
        status: updatedApp.status,
        connectedAt: updatedApp.connectedAt,
      },
    };
  }

  async bspRegisterPhone(input: any) {
    const { workspaceId, appId, region, phoneNumber } = input;

    // Call active Gupshup API registration
    const targetAppId = appId;
    if (targetAppId && !String(targetAppId).startsWith('mock_')) {
      await this.gupshup.registerPhoneForApp({
        appId: targetAppId,
        region,
        phoneNumber,
      });
    }

    const app = await this.appModel.findOneAndUpdate(
      { workspaceId, appId },
      {
        $set: {
          displayPhoneNumber: phoneNumber,
          whatsappPhoneNumber: phoneNumber,
          bspDisplayPhoneNumber: phoneNumber,
          'gupshupIdentity.source': region,
          updatedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!app) {
      throw new Error('BSP app not found');
    }

    return {
      success: true,
      app: {
        appId: app.appId,
        phoneNumber,
        region,
      },
    };
  }

  async bspComplete(input: any) {
    const { workspaceId, userId, appId } = input;

    // Retrieve onboarding session to check if new_number connection needs registration
    const session = await this.sessionModel.findOne({ workspaceId, appId, status: 'started' });
    const bspSession = (session?.metadata || {}) as any;
    const connectionType = bspSession.connectionType || bspSession.fallbackPayload?.connectionType;

    if (connectionType === 'new_number' && appId && !String(appId).startsWith('mock_')) {
      const phone = String(bspSession.phoneNumber || bspSession.userEmail || '').replace(/\D/g, '');
      if (phone) {
        await this.gupshup.registerPhoneForApp({
          appId,
          region: bspSession.region || 'IN',
          phoneNumber: phone,
        }).catch((e: any) => console.warn('[BSP Complete] Phone reg fail:', e.message));
      }
    }

    // Profile Contact details sync with base64 fingerprint checking
    if (appId && !String(appId).startsWith('mock_')) {
      const businessName = bspSession.businessName || 'Business Owner';
      const email = bspSession.userEmail || `${userId}@placeholder.com`;
      const phone = String(bspSession.phoneNumber || '').replace(/\D/g, '') || undefined;

      const contactFingerprint = Buffer.from(`${businessName}:${email}:${phone || ''}`).toString('base64');
      
      const appRecord = await this.appModel.findOne({ workspaceId, appId });
      const oldFingerprint = (appRecord?.providerData as any)?.contactSyncFingerprint;

      if (oldFingerprint !== contactFingerprint) {
        console.log(`[OnboardingService:bspComplete] Syncing profile contact details for ${appId}...`);
        await this.gupshup.updateOnboardingContact({
          appId,
          contactName: businessName,
          contactEmail: email,
          contactNumber: phone,
        }).then(async () => {
          await this.appModel.findOneAndUpdate(
            { workspaceId, appId },
            {
              $set: {
                'providerData.contactSyncFingerprint': contactFingerprint,
                'providerData.contactSyncedAt': new Date(),
              },
            }
          );
        }).catch((e: any) => console.warn('[BSP Complete] Profile contact sync failed:', e.message));
      } else {
        console.log(`[OnboardingService:bspComplete] Contact info unchanged, skipping sync for ${appId}`);
      }
    }

    const app = await this.appModel.findOneAndUpdate(
      { workspaceId, appId },
      {
        $set: {
          status: 'connected',
          connectedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!app) {
      throw new Error('BSP app not found');
    }

    // Trigger auto-sync of metrics and configuration
    await this.bspSync({ workspaceId, appId }).catch((e: any) =>
      console.warn('[BSP Complete] Auto sync metrics failed:', e.message)
    );

    await this.ensureDefaultWebhookSubscription(workspaceId, appId).catch((e: any) =>
      console.warn('[BSP Complete] Default webhook subscription failed:', e.message)
    );

    await this.templateSeeding.seedBestPracticeTemplates(workspaceId).catch((e: any) =>
      console.warn('[BSP Complete] Template seeding failed:', e.message)
    );

    return {
      success: true,
      connected: true,
      app: {
        appId: app.appId,
        provider: app.provider,
        status: app.status,
        connectedAt: app.connectedAt,
      },
    };
  }

  private async ensureDefaultWebhookSubscription(workspaceId: string, appId: string) {
    if (!workspaceId || !appId || String(appId).startsWith('mock_')) {
      return null;
    }

    const callbackBase = process.env.WHATSAPP_WEBHOOK_URL || process.env.APP_URL || config.mainServiceUrl;
    if (!callbackBase) {
      throw new Error('WHATSAPP_WEBHOOK_URL, APP_URL, or MAIN_SERVICE_URL must be set for default webhook subscription');
    }

    const response = await this.gupshup.setSubscription({
      appId,
      url: callbackBase,
      events: DEFAULT_WEBHOOK_EVENTS,
      strategy: 'update',
    });

    const callbackUrl = response?.registeredUrl || (
      callbackBase.includes('/api/webhooks/')
        ? callbackBase
        : `${callbackBase.replace(/\/$/, '')}/api/webhooks/whatsapp`
    );

    await this.subscriptionModel.findOneAndUpdate(
      { workspaceId, provider: 'gupshup', appId, callbackUrl },
      {
        $set: {
          workspaceId,
          provider: 'gupshup',
          appId,
          callbackUrl,
          events: DEFAULT_WEBHOOK_EVENTS,
          status: 'active',
          providerData: {
            gupshupResponse: response,
            source: 'onboarding_default',
          },
        },
      },
      { upsert: true, new: true },
    );

    return { callbackUrl, events: DEFAULT_WEBHOOK_EVENTS };
  }

  async bspDisconnect(input: any) {
    const { workspaceId, appId } = input;

    await this.appModel.deleteOne({ workspaceId, appId });

    try {
      const mainDb = this.appModel.db.useDb('wapi');
      await mainDb.collection('workspaces').updateOne(
        { _id: new Types.ObjectId(workspaceId) },
        {
          $set: {
            whatsappConnected: false,
            gupshupAppId: undefined,
            gupshupAppName: undefined,
            'onboarding.wabaConnectionCompleted': false,
            'onboarding.wabaConnectionInitiated': false,
            bspPhoneStatus: 'DISCONNECTED',
            'esbFlow.status': 'onboarding',
          }
        }
      );
      console.log(`[BSP Disconnect] Successfully cleared workspace connection states in wapi db for workspace ${workspaceId}`);
    } catch (err: any) {
      console.error('[BSP Disconnect] Failed to clear connection state in main workspace collection:', err.message);
    }

    return {
      success: true,
      message: 'Disconnected successfully',
    };
  }

  async bspRuntimeProfile(input: any) {
    const { workspaceId, appId } = input;

    if (!appId) {
      return {
        success: true,
        connected: false,
        profile: null,
      };
    }

    const app = await this.appModel.findOne({ workspaceId, appId });

    return {
      success: true,
      connected: !!app && app.status === 'connected',
      profile: app ? {
        appId: app.appId,
        provider: app.provider,
        status: app.status,
        connectedAt: app.connectedAt,
      } : null,
    };
  }

  async bspCallback(payload: any, req: any) {
    try {
      // This is called via GET /bsp/v1/onboarding/callback from Gupshup redirect
      // We could store this or process it, but typically the frontend handles it via postMessage
    } catch (error) {
      console.error('[BSP Callback Error]', error);
    }

    const appOrigin = `${req.protocol}://${req.get('host')}`;
    const target = `${appOrigin}/dashboard`;

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Finishing WhatsApp setup</title></head>
<body>
<p>Finishing WhatsApp setup...</p>
<script>
  (function () {
    var payload = ${JSON.stringify(payload)};
    var appOrigin = ${JSON.stringify(appOrigin)};
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'GUPSHUP_ONBOARDING_CALLBACK', payload: payload }, appOrigin);
        window.close();
        return;
      }
    } catch (error) {}
    var url = new URL(${JSON.stringify(target)});
    Object.keys(payload).forEach(function (key) { if (payload[key]) url.searchParams.set(key, payload[key]); });
    window.location.replace(url.toString());
  })();
</script>
</body></html>`;

    return html;
  }
}
