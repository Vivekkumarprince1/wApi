import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { BspOnboardingSession } from '../models/bsp-onboarding-session.schema';
import { BspApp } from '../models/bsp-app.schema';
import { BspOnboardingState, OnboardingStep } from '../models/bsp-onboarding-state.schema';
import { GupshupClientService } from '../gupshup/gupshup-client.service';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(BspOnboardingSession.name) private readonly sessionModel: Model<BspOnboardingSession>,
    @InjectModel(BspApp.name) private readonly appModel: Model<BspApp>,
    @InjectModel(BspOnboardingState.name) private readonly stateModel: Model<BspOnboardingState>,
    private readonly gupshup: GupshupClientService,
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
    const { workspaceId, userId, businessId, callbackUrl, provider = 'gupshup' } = input;
    const state = randomUUID();
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const providerResult = await this.gupshup.createEmbeddedOnboardingLink({
      workspaceId,
      businessId,
      callbackUrl,
      state,
      metadata: input.metadata,
    });

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
      metadata: input.metadata || {},
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
    const app = await this.appModel.findOne({ workspaceId, appId });

    if (!app) {
      throw new Error('No BSP app found to sync');
    }

    return {
      success: true,
      app: {
        appId: app.appId,
        provider: app.provider,
        status: app.status,
        connectedAt: app.connectedAt,
      },
    };
  }

  async bspRegisterPhone(input: any) {
    const { workspaceId, appId, region, phoneNumber } = input;

    const app = await this.appModel.findOneAndUpdate(
      { workspaceId, appId },
      {
        $set: {
          'metadata.phoneNumber': phoneNumber,
          'metadata.region': region,
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

  async bspDisconnect(input: any) {
    const { workspaceId, appId } = input;

    await this.appModel.deleteOne({ workspaceId, appId });

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
