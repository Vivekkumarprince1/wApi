import crypto from 'crypto';
import { Business, BusinessAppMap, GupshupApp, Workspace } from '@/models';
import { config } from '@/config';
import { encryptSecretCBC } from '@/services/security/secret-box';
import { GupshupPartnerService, type PartnerApp } from './gupshup-partner-service';
import { syncOnboardingState } from '@/services/onboarding/onboarding-state-service';
import IORedis from 'ioredis';

type AssignmentSource = 'workspace_existing' | 'sandbox_reclaimed' | 'fresh_created' | 'mock_created';
type BspConnectionType = 'business_app' | 'new_number' | 'migrate';

let onboardingLockRedis: IORedis | null = null;

function getOnboardingLockRedis() {
  if (config.skipRedis) return null;
  if (!onboardingLockRedis) {
    onboardingLockRedis = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    onboardingLockRedis.on('error', (err) => {
      console.error('[GupshupOnboardingLockRedis] Redis Error:', err.message || err);
    });
  }
  return onboardingLockRedis;
}

async function withWorkspaceOnboardingLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  const redis = getOnboardingLockRedis();
  if (!redis) {
    return fn();
  }

  const lockKey = `lock:onboarding:gupshup:${workspaceId}`;
  const lockValue = crypto.randomBytes(12).toString('hex');
  let hasLock = false;

  try {
    if (redis.status !== 'ready') {
      await redis.connect();
    }

    const acquired = await redis.set(lockKey, lockValue, 'EX', 120, 'NX');
    if (!acquired) {
      throw Object.assign(new Error('Onboarding is already in progress for this workspace'), {
        status: 409,
        code: 'ONBOARDING_LOCKED'
      });
    }
    hasLock = true;

    return await fn();
  } catch (error: any) {
    if (hasLock || error?.code === 'ONBOARDING_LOCKED') {
      throw error;
    }
    throw Object.assign(new Error('Onboarding lock is unavailable'), {
      status: 503,
      code: 'ONBOARDING_LOCK_UNAVAILABLE'
    });
  } finally {
    try {
      if (redis && hasLock) {
        await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          lockKey,
          lockValue
        );
      }
    } catch {
      // ignore lock release errors
    }
  }
}

function sanitizeAppName(workspace: any, business: any, variant = '') {
  const workspacePart = String(workspace?._id || workspace?.id || workspace || '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(-10);
  const businessPart = String(business?.name || business?.legalName || business?._id || '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, 12);
  const variantPart = String(variant || '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, 4);
  const bodyLimit = Math.max(0, 32 - 4 - variantPart.length);
  const body = `${workspacePart}${businessPart}`.slice(0, bodyLimit);
  return `waba${body}${variantPart}`.substring(0, 32);
}

export function resolveWebhookUrl() {
  if (config.whatsappWebhookUrl && /^https:\/\//i.test(config.whatsappWebhookUrl)) {
    return config.whatsappWebhookUrl.replace(/\/$/, '');
  }

  const base = config.baseUrl.replace(/\/$/, '');
  if (!base) return null;
  return `${base}/api/webhooks/whatsapp`;
}

function isReusablePartnerApp(app: PartnerApp) {
  const mode = String(app.accountMode || app.mode || '').toUpperCase();
  const hasPhone = Boolean(app.phone);
  const hasCustomer = Boolean(app.customerId);
  const isLive = app.live === true || String(app.status || '').toUpperCase() === 'LIVE';
  return !hasPhone && !hasCustomer && !isLive && mode === 'SANDBOX';
}

async function createMockApp(business: any, workspace: any) {
  const appId = `mock_${workspace._id.toString().slice(-8)}_${Date.now().toString(36)}`;
  const encryptedApiKey = encryptSecretCBC(`mock_key_${appId}`) || undefined;
  return GupshupApp.create({
    gupshupAppId: appId,
    appName: sanitizeAppName(workspace, business),
    status: 'live',
    assigned: true,
    assignedToBusiness: business._id,
    assignedToWorkspace: workspace._id,
    encryptedApiKey,
    providerPayload: { mock: true },
    assignedAt: new Date(),
    lastSyncedAt: new Date()
  });
}

async function markAppAssigned(app: any, business: any, workspace: any, assignmentSource: AssignmentSource) {
  app.assigned = true;
  app.assignedToBusiness = business._id;
  app.assignedToWorkspace = workspace._id;
  app.status = app.status === 'live' ? 'live' : 'assigned';
  app.assignedAt = app.assignedAt || new Date();
  await app.save();

  await BusinessAppMap.findOneAndUpdate(
    { business: business._id, active: true },
    {
      $set: {
        business: business._id,
        workspace: workspace._id,
        app: app._id,
        gupshupAppId: app.gupshupAppId,
        assignmentSource,
        active: true,
        assignedAt: new Date()
      }
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  return app;
}

async function findExistingAssignedApp(business: any) {
  const map = await BusinessAppMap.findOne({ business: business._id, active: true }).populate('app');
  return { app: map?.app || null, map };
}

async function assignWorkspaceExistingApp(business: any, workspace: any) {
  const existingWorkspaceAppId = workspace.gupshupAppId || workspace.gupshupIdentity?.partnerAppId;
  if (!existingWorkspaceAppId) return null;

  const app = await GupshupApp.findOneAndUpdate(
    { gupshupAppId: existingWorkspaceAppId },
    {
      $set: {
        gupshupAppId: existingWorkspaceAppId,
        appName: workspace.gupshupAppName,
        status: workspace.whatsappConnected ? 'live' : 'assigned',
        lastSyncedAt: new Date()
      },
      $setOnInsert: { assigned: false }
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

  return markAppAssigned(app, business, workspace, 'workspace_existing');
}

async function assignDbReusableApp(business: any, workspace: any) {
  const app = await GupshupApp.findOneAndUpdate(
    {
      assigned: false,
      status: { $in: ['sandbox', 'inactive', 'disconnected'] }
    },
    {
      $set: {
        assigned: true,
        assignedToBusiness: business._id,
        assignedToWorkspace: workspace._id,
        status: 'assigned',
        assignedAt: new Date()
      }
    },
    { returnDocument: 'after', sort: { updatedAt: 1 } }
  );
  if (!app) return null;
  await markAppAssigned(app, business, workspace, 'sandbox_reclaimed');
  return app;
}

async function assignPartnerReusableApp(business: any, workspace: any) {
  const partnerApps = await GupshupPartnerService.getPartnerApps();
  const reusable = partnerApps.find(isReusablePartnerApp);
  if (!reusable?.id) return null;

  const app = await GupshupApp.findOneAndUpdate(
    { gupshupAppId: reusable.id },
    {
      $set: {
        gupshupAppId: reusable.id,
        appName: reusable.name,
        status: reusable.live ? 'live' : 'sandbox',
        providerPayload: reusable,
        lastSyncedAt: new Date()
      },
      $setOnInsert: { assigned: false }
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

  if (app.assigned && String(app.assignedToBusiness || '') !== String(business._id)) {
    return null;
  }

  return markAppAssigned(app, business, workspace, 'sandbox_reclaimed');
}

async function createPartnerApp(business: any, workspace: any) {
  const baseName = sanitizeAppName(workspace, business);
  let created: any;
  try {
    created = await GupshupPartnerService.createPartnerApp(baseName);
  } catch (error: any) {
    if (error?.response?.status === 400) {
      const retryName = sanitizeAppName(workspace, business, 'retry');
      try {
        created = await GupshupPartnerService.createPartnerApp(retryName);
      } catch (retryError) {
        throw retryError;
      }
    } else {
      throw error;
    }
  }

  if (!created?.appId) throw new Error('Gupshup app creation did not return an app id');

  const app = await GupshupApp.create({
    gupshupAppId: created.appId,
    appName: created.appName,
    status: 'assigned',
    assigned: false,
    providerPayload: created.raw,
    lastSyncedAt: new Date()
  });

  return markAppAssigned(app, business, workspace, 'fresh_created');
}

export async function assignGupshupAppForBusiness(user: any, workspace: any, business: any) {
  return withWorkspaceOnboardingLock(String(workspace._id), async () => {
    const existing = await findExistingAssignedApp(business);
    let app: any = existing.app;

    if (app && !existing.map?.assignmentSource) {
      await BusinessAppMap.findByIdAndUpdate(existing.map?._id, { $set: { assignmentSource: 'workspace_existing' } });
    }

    if (!app) app = await assignWorkspaceExistingApp(business, workspace);
    if (!app) app = await assignDbReusableApp(business, workspace);
    if (!app) {
      try {
        app = await assignPartnerReusableApp(business, workspace);
        if (!app) app = await createPartnerApp(business, workspace);
      } catch (error: any) {
        if (config.env !== 'production') {
          console.warn('[BSP] Gupshup partner assignment failed, falling back to mock app:', error.response?.data || error.message);
          app = await createMockApp(business, workspace);
          await markAppAssigned(app, business, workspace, 'mock_created');
        } else {
          throw error;
        }
      }
    }

    // ID-level assignment is valid even before token resolution.
    // Autonomous factory will handle refresh during first use.

    await Workspace.findByIdAndUpdate(workspace._id, {
      $set: {
        gupshupAppId: app.gupshupAppId,
        gupshupAppName: app.appName,
        onboardingStatus: String(app.gupshupAppId).startsWith('mock_') ? 'completed' : 'APP_ASSIGNED',
        'gupshupIdentity.partnerAppId': app.gupshupAppId,
        ...(app.encryptedApiKey ? { 'gupshupIdentity.appApiKey': app.encryptedApiKey } : {}),
        'gupshupIdentity.appStatus': app.status === 'live' ? 'active' : 'created',
        'onboarding.wabaConnectionInitiated': true,
        'onboarding.wabaConnectionInitiatedAt': new Date()
      }
    });

    const updatedWorkspace = await Workspace.findById(workspace._id);
    if (updatedWorkspace) await syncOnboardingState(user, updatedWorkspace);

    return app;
  });
}

export async function startGupshupOnboarding(
  user: any,
  workspace: any,
  business: any,
  options: { connectionType?: BspConnectionType; region?: string; phoneNumber?: string } = {}
) {
  const connectionType = options.connectionType || 'business_app';
  const app = await assignGupshupAppForBusiness(user, workspace, business);

  if (String(app.gupshupAppId).startsWith('mock_')) {
    return {
      app,
      url: `/dashboard?mockConnected=1&appId=${encodeURIComponent(app.gupshupAppId)}`,
      state: `mock_${crypto.randomBytes(8).toString('hex')}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      connectionType
    };
  }

  // NOTE: Contact updates, Token resolution, and Webhook setup are now handled 
  // by the background OnboardingOrchestrator to ensure reliability and resumability.

  if (connectionType === 'migrate') {
    try {
      await GupshupPartnerService.markAppForMigration(
        app.gupshupAppId,
        app.status === 'live' ? 'MIGRATED_IN' : 'META_EMBED_MIGRATION'
      );
      
      await Workspace.findByIdAndUpdate(workspace._id, {
        $set: { onboardingStatus: 'MIGRATION_STARTED' }
      });
    } catch (error: any) {
      console.warn('[Gupshup] Migration marker failed:', error.message);
    }
  }

  const state = crypto.randomBytes(24).toString('hex');
  let embed;
  try {
    embed = await GupshupPartnerService.getOnboardingEmbedLink({
      appId: app.gupshupAppId,
      user: user.name || user.email || config.gupshupPartnerEmail || 'system',
      lang: user.language || 'en'
    });
  } catch (error: any) {
    if (error.response?.data?.message?.includes('regenerate')) {
      embed = await GupshupPartnerService.getOnboardingEmbedLink({
        appId: app.gupshupAppId,
        user: user.name || user.email || config.gupshupPartnerEmail || 'system',
        lang: user.language || 'en',
        regenerate: true
      });
    } else {
      throw error;
    }
  }

  return {
    app,
    url: embed.link || embed.url || embed.embedLink || embed.data?.url,
    state,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    connectionType
  };
}

export async function syncAssignedGupshupApp(user: any, workspace: any, business?: any) {
  const appId = workspace.gupshupAppId || workspace.gupshupIdentity?.partnerAppId;
  if (!appId) throw Object.assign(new Error('No Gupshup app is assigned'), { status: 400 });

  const isMock = String(appId).startsWith('mock_');
  let updates: Record<string, unknown> = {
    bspLastSyncedAt: new Date()
  };

  if (isMock) {
    updates = {
      ...updates,
      whatsappConnected: true,
      gupshupAppLive: true,
      onboardingStatus: 'completed',
      bspPhoneStatus: 'CONNECTED',
      connectedAt: workspace.connectedAt || new Date(),
      bspDisplayPhoneNumber: user.phone || 'mock-phone',
      whatsappPhoneNumber: user.phone || 'mock-phone',
      'onboarding.wabaConnectionCompleted': true,
      'onboarding.wabaConnectionCompletedAt': new Date(),
      'esbFlow.status': 'completed',
      'esbFlow.completedAt': new Date()
    };
  } else {
    const apps = await GupshupPartnerService.getPartnerApps();
    const app = apps.find((item) => item.id === appId);
    const wabaInfo = await GupshupPartnerService.getWabaInfo(appId).catch(() => null);
    const info = wabaInfo?.wabaInfo || wabaInfo?.data || {};

    // 1. New WABA ID Detection & Whitelisting (OBO flow)
    const currentWabaId = info.wabaId || workspace.wabaId;
    if (currentWabaId && !workspace.wabaId && !isMock) {
        console.log(`[BSP] New WABA ID detected: ${currentWabaId}. Triggering OBO Whitelisting and Credit Line Verification...`);
        await GupshupPartnerService.whitelistWaba(appId, currentWabaId).catch(err => console.error('[BSP] Whitelist failed:', err.message));
        await GupshupPartnerService.verifyCreditLine(appId).catch(err => console.error('[BSP] Credit verify failed:', err.message));
    }

    // 2. Fetch Metrics (Health, Balance, Ratings)
    const [health, balance, ratings] = await Promise.all([
        GupshupPartnerService.getHealth(appId).catch(() => null),
        GupshupPartnerService.getWalletBalance(appId).catch(() => null),
        GupshupPartnerService.getRatings(appId).catch(() => null)
    ]);

    // 3. Subscription Status (Read Only) - Autonomous
    try {
        const subscriptions = await GupshupPartnerService.listSubscriptions(appId);
        updates.gupshupSubscriptionCount = Array.isArray(subscriptions) ? subscriptions.length : 0;
    } catch (subErr: any) {
        console.warn(`[BSP] Subscription query failed for ${appId}:`, subErr.message);
    }

    const live = Boolean(app?.live || info.accountStatus === 'ACTIVE');
    const phone = info.phone || app?.phone || workspace.whatsappPhoneNumber || workspace.bspDisplayPhoneNumber;

    updates = {
      ...updates,
      whatsappConnected: live || Boolean(phone),
      gupshupAppLive: live,
      gupshupAppHealth: health?.healthy ?? health?.status === 'ALIVE',
      gupshupWalletBalance: balance?.balance || balance?.data?.balance,
      gupshupRatings: ratings?.ratings || ratings?.data || ratings,
      onboardingStatus: live ? 'completed' : 'pending_activation',
      bspPhoneStatus: live || phone ? 'CONNECTED' : 'PENDING',
      connectedAt: live || phone ? (workspace.connectedAt || new Date()) : workspace.connectedAt,
      bspDisplayPhoneNumber: phone,
      whatsappPhoneNumber: phone,
      wabaId: currentWabaId || appId,
      bspWabaId: currentWabaId || appId,
      phoneNumberId: info.phoneNumberId || info.phone_number_id || workspace.phoneNumberId,
      whatsappPhoneNumberId: info.phoneNumberId || info.phone_number_id || workspace.whatsappPhoneNumberId,
      bspPhoneNumberId: info.phoneNumberId || info.phone_number_id || workspace.bspPhoneNumberId,
      verifiedName: info.verifiedName || app?.name || workspace.verifiedName,
      bspVerifiedName: info.verifiedName || app?.name || workspace.bspVerifiedName,
      qualityRating: info.phoneQuality || workspace.qualityRating || 'UNKNOWN',
      bspQualityRating: info.phoneQuality || workspace.bspQualityRating || 'UNKNOWN',
      messagingLimitTier: info.messagingLimit || workspace.messagingLimitTier,
      bspMessagingTier: info.messagingLimit || workspace.bspMessagingTier,
      'onboarding.wabaConnectionCompleted': live || Boolean(phone),
      'onboarding.wabaConnectionCompletedAt': live || phone ? new Date() : workspace.onboarding?.wabaConnectionCompletedAt,
      'esbFlow.status': live || phone ? 'completed' : 'phone_pending',
      'esbFlow.completedAt': live || phone ? new Date() : workspace.esbFlow?.completedAt
    };

    await GupshupApp.findOneAndUpdate(
      { gupshupAppId: appId },
      {
        $set: {
          status: live ? 'live' : 'assigned',
          phoneNumber: phone,
          phoneNumberId: info.phoneNumberId || info.phone_number_id,
          wabaId: currentWabaId,
          providerPayload: { app, wabaInfo, health, balance, ratings },
          lastSyncedAt: new Date()
        }
      }
    );
  }

  const updatedWorkspace = await Workspace.findByIdAndUpdate(workspace._id, { $set: updates }, { returnDocument: 'after' });
  if (updatedWorkspace) await syncOnboardingState(user, updatedWorkspace);

  if (business?._id && updates.whatsappConnected) {
    await Business.findByIdAndUpdate(business._id, { $set: { confirmed: true } });
  }

  return updatedWorkspace;
}
