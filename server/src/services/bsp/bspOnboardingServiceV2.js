/**
 * BSP Onboarding Service V2 - Gupshup Partner Model
 *
 * Flow:
 * 1) Resolve app from partner account
 * 2) Update onboarding contact for app
 * 3) Generate onboarding embed link
 * 4) Complete onboarding by appId and return normalized workspace payload
 */

const crypto = require('crypto');
const bspConfig = require('../../config/bspConfig');
const gupshupService = require('./gupshupService');
const { User, Workspace } = require('../../models');

function getBspConfig() {
  const { valid, errors } = bspConfig.validate();
  if (!valid) {
    throw new Error(`BSP configuration incomplete. Missing: ${errors.join(', ')}`);
  }

  return bspConfig;
}

function resolvePrimaryApp(partnerAppsResponse) {
  const apps = partnerAppsResponse?.partnerAppsList || partnerAppsResponse?.data || [];
  if (!Array.isArray(apps) || apps.length === 0) {
    throw new Error('No partner apps found. Link at least one app in Gupshup partner account.');
  }

  const preferred = apps.find((app) => app.id === bspConfig.gupshup.appId) || apps[0];
  return {
    appId: preferred.id,
    appName: preferred.name,
    liveStatus: preferred.live,
    phone: preferred.phone || null
  };
}

function resolveOnboardingApp(partnerAppsResponse) {
  const apps = partnerAppsResponse?.partnerAppsList || partnerAppsResponse?.data || [];
  if (!Array.isArray(apps) || apps.length === 0) {
    throw new Error('No partner apps found. Link at least one app in Gupshup partner account.');
  }

  const configured = apps.find((item) => item.id === bspConfig.gupshup.appId) || null;

  // Prefer an app that is not yet live or does not have a bound phone, since
  // embed onboarding is for onboarding pending apps.
  const onboardingCandidate =
    apps.find((item) => !item.live || !item.phone) ||
    configured ||
    apps[0];

  return {
    appId: onboardingCandidate.id,
    appName: onboardingCandidate.name,
    liveStatus: onboardingCandidate.live,
    phone: onboardingCandidate.phone || null
  };
}

function isUnassignedSandboxApp(app) {
  if (!app || !app.id) return false;

  const accountMode = String(app.accountMode || app.mode || '').toUpperCase();
  const customerId = app.customerId || app.customer_id || null;
  const hasPhone = Boolean(app.phone);
  const isSandboxMode = accountMode === 'SANDBOX' || !app.live;
  const isUnassigned = !customerId || String(customerId).trim() === '';

  return isSandboxMode && isUnassigned && !hasPhone;
}

function resolveReusableSandboxApp(partnerAppsResponse) {
  const apps = partnerAppsResponse?.partnerAppsList || partnerAppsResponse?.data || [];
  if (!Array.isArray(apps) || apps.length === 0) {
    return null;
  }

  const sandboxCandidates = apps.filter(isUnassignedSandboxApp);
  if (sandboxCandidates.length === 0) {
    return null;
  }

  const preferred =
    sandboxCandidates.find((app) => app.accountMode === 'SANDBOX') ||
    sandboxCandidates.find((app) => app.live === false) ||
    sandboxCandidates[0];

  return {
    appId: preferred.id,
    appName: preferred.name,
    liveStatus: !!preferred.live,
    phone: preferred.phone || null
  };
}

function resolvePublicWebhookUrl() {
  const direct = String(process.env.WHATSAPP_WEBHOOK_URL || '').trim();
  if (direct && /^https:\/\//i.test(direct)) {
    return direct.replace(/\/$/, '');
  }

  const candidates = [
    process.env.RENDER_EXTERNAL_URL,
    process.env.API_BASE_URL,
    process.env.APP_URL
  ];

  for (const base of candidates) {
    const normalizedBase = String(base || '').trim().replace(/\/$/, '');
    if (!normalizedBase) continue;

    if (/\/api\/v1$/i.test(normalizedBase)) {
      return `${normalizedBase}/webhook/gupshup`;
    }

    if (/\/api$/i.test(normalizedBase)) {
      return `${normalizedBase}/v1/webhook/gupshup`;
    }

    return `${normalizedBase}/api/v1/webhook/gupshup`;
  }

  return null;
}

function buildContactSyncFingerprint({ appId, contactName, contactEmail, contactNumber }) {
  return [
    String(appId || '').trim(),
    String(contactName || '').trim().toLowerCase(),
    String(contactEmail || '').trim().toLowerCase(),
    String(contactNumber || '').trim()
  ].join('|');
}

async function resolveOrCreateWorkspaceApp(userId) {
  const user = await User.findById(userId).populate('workspace');
  if (!user) {
    throw new Error('User not found');
  }

  let appId;
  let appName;

  const partnerApps = await gupshupService.getPartnerApps();

  // Check both fields for existing app (one-time creation policy)
  const existingAppId = user.workspace?.gupshupAppId || user.workspace?.gupshupIdentity?.partnerAppId;

  if (existingAppId) {
    // Returning user — reuse existing app
    appId = existingAppId;
    appName = user.workspace.name || `workspace-${userId}`;
    console.log(`[BSP-V2] Reusing existing app: ${appId}`);
  } else {
    const reusableSandbox = resolveReusableSandboxApp(partnerApps);
    if (reusableSandbox) {
      appId = reusableSandbox.appId;
      appName = reusableSandbox.appName || `workspace-${userId}`;
      console.log(`[BSP-V2] Reusing unassigned sandbox app: ${appId}`);

      if (user.workspace) {
        user.workspace.gupshupAppId = appId;
        if (!user.workspace.gupshupIdentity) user.workspace.gupshupIdentity = {};
        user.workspace.gupshupIdentity.partnerAppId = appId;
        user.workspace.markModified('gupshupIdentity');
        await user.workspace.save();
      }
    } else {
      // New user — create a fresh app
      const uniqueSuffix = Date.now().toString(36).substring(4);
      appName = `waba${userId.toString().substring(0, 10)}${uniqueSuffix}`;
      try {
        const newApp = await gupshupService.createPartnerApp(appName);
        if (!newApp || !newApp.appId) {
          throw new Error('Failed to create Gupshup app');
        }
        appId = newApp.appId;

        if (user.workspace) {
          user.workspace.gupshupAppId = appId;
          if (!user.workspace.gupshupIdentity) user.workspace.gupshupIdentity = {};
          user.workspace.gupshupIdentity.partnerAppId = appId;
          user.workspace.markModified('gupshupIdentity');
          await user.workspace.save();
        } else {
          const newWorkspace = await Workspace.create({
            name: `workspace-${userId}`,
            owner: userId,
            gupshupAppId: appId,
            gupshupIdentity: { partnerAppId: appId },
            onboardingStatus: 'pending_activation'
          });
          await User.findByIdAndUpdate(userId, { workspace: newWorkspace._id });
          user.workspace = newWorkspace;
        }
      } catch (error) {
        console.error('[BSP] Error creating new Gupshup app:', error.response?.data || error.message);
        throw new Error('Failed to provision a new WhatsApp Business account. Please try again later.');
      }
    }
  }

  return {
    user,
    workspace: user.workspace,
    appId,
    appName,
    workspaceId: user.workspace?._id?.toString() || null
  };
}

async function generateBspSignupUrl(userId, options = {}) {
  getBspConfig();

  const { user, workspace, appId, appName, workspaceId } = await resolveOrCreateWorkspaceApp(userId);

  const contactPayload = {
    appId,
    contactName: options.businessName || appName,
    contactEmail: options.contactEmail || user.email,
    contactNumber: options.phone || user.phone
  };
  const contactFingerprint = buildContactSyncFingerprint(contactPayload);

  const alreadySynced = workspace?.esbFlow?.contactSyncFingerprint === contactFingerprint;

  if (!alreadySynced) {
    try {
      await gupshupService.updateOnboardingContact(contactPayload);

      if (workspace?._id) {
        await Workspace.findByIdAndUpdate(workspace._id, {
          $set: {
            'esbFlow.contactSyncFingerprint': contactFingerprint,
            'esbFlow.contactSyncedAt': new Date()
          }
        });
      }
    } catch (_error) {
    }
  }

  try {
    const webhookUrl = resolvePublicWebhookUrl();
    if (webhookUrl) {
      const appApiKey = await gupshupService.resolveAppScopedToken(appId);
      if (appApiKey) {
        await gupshupService.ensureRequiredSubscriptions({
          appId,
          appApiKey,
          webhookUrl
        });
      }
    }
  } catch (error) {
    console.warn(`[BSP-V2] Subscription setup skipped for ${appId}:`, error.message);
  }

  const embed = await gupshupService.getOnboardingEmbedLink({
    appId: appId,
    user: `user_${userId.toString().substring(0, 10)}` // Gupshup might have length limits on user
  });

  if (!embed || (!embed.url && !embed.link && !embed.embedLink && !embed.data?.url)) {
    throw new Error('Failed to generate embed link from Gupshup');
  }

  const state = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  return {
    url: embed.link || embed.url || embed.data?.url || embed.embedLink,
    state,
    expiresAt,
    appId: appId,
    appName: appName,
    liveStatus: false,
    workspaceId
  };
}

async function registerPhoneForWorkspace(userId, options = {}) {
  getBspConfig();

  const region = String(options.region || 'IN').toUpperCase();
  const explicitAppId = options.appId ? String(options.appId).trim() : null;

  const { appId: resolvedAppId, workspaceId } = await resolveOrCreateWorkspaceApp(userId);
  const appId = explicitAppId || resolvedAppId;

  const registerResponse = await gupshupService.registerPhoneForApp({
    appId,
    region
  });

  return {
    appId,
    region,
    workspaceId,
    providerResponse: registerResponse,
    success: registerResponse?.success === true || registerResponse?.status === 'success'
  };
}

async function completeBspOnboarding(codeOrAppId, workspaceId) {
  getBspConfig();

  const partnerApps = await gupshupService.getPartnerApps();
  const app = resolvePrimaryApp(partnerApps);
  const selectedAppId = codeOrAppId && codeOrAppId.length > 20 ? codeOrAppId : app.appId;

  let finalApp = (partnerApps?.partnerAppsList || []).find((item) => item.id === selectedAppId);

  if (!finalApp) {
    // If the app is not in the list yet (e.g. newly created), construct a pending app object
    finalApp = {
      id: selectedAppId,
      name: 'Pending Gupshup App',
      live: false,
      phone: null,
      customerId: null
    };
  }

  if (finalApp.phone && !finalApp.live) {
    console.log(`[BSP] App ${finalApp.id} has phone but is not live. Triggering Go-Live...`);
    try {
      await gupshupService.goLive({ appId: finalApp.id });
      finalApp.live = true;
    } catch (err) {
      console.error(`[BSP] Auto Go-Live failed for ${finalApp.id}:`, err.message);
    }
  }

  // Finalization Steps for Embedded Onboarding (OBOTOEMBED)
  // Required for message delivery even if Meta accepts the request.
  if (finalApp.live) {
    console.log(`[BSP] Finalizing onboarding for ${finalApp.id} (Whitelist + Credit Line)...`);
    try {
      // Pass null for appApiKey to let resolveAppToken handle it via Partner Token
      await gupshupService.whitelistWaba(finalApp.id);
      await gupshupService.verifyAndAttachCreditLine(finalApp.id);
      console.log(`[BSP] Finalization successful for ${finalApp.id}`);
    } catch (err) {
      console.warn(`[BSP] Finalization failed for ${finalApp.id} (may already be complete):`, err.message);
    }
  }

  return {
    onboardingComplete: true,
    onboardingStatus: finalApp.live ? 'completed' : 'pending_activation',
    onboardingProgress: {
      appResolved: true,
      contactUpdated: true,
      embedIssued: true
    },
    gupshupAppId: finalApp.id || selectedAppId,
    businessId: finalApp.customerId || null,
    wabaId: finalApp.id || selectedAppId,
    bspWabaId: finalApp.id || selectedAppId,
    phoneNumber: finalApp.phone || null,
    displayPhoneNumber: finalApp.phone || null,
    verifiedName: finalApp.name || 'Gupshup Workspace',
    phoneStatus: finalApp.live ? 'CONNECTED' : 'PENDING',
    connectedAt: finalApp.live ? new Date() : null,
    qualityRating: 'UNKNOWN',
    messagingLimit: null,
    codeVerificationStatus: null,
    nameStatus: null,
    isOfficialAccount: false,
    tokenExpiresAt: null,
    businessProfile: {
      appId: finalApp.id || selectedAppId,
      appName: finalApp.name,
      partnerUsage: finalApp.partnerUsage,
      healthy: finalApp.healthy
    },
    allPhones: finalApp.phone ? [{ phone: finalApp.phone }] : [],
    workspaceId
  };
}

module.exports = {
  getBspConfig,
  generateBspSignupUrl,
  completeBspOnboarding,
  registerPhoneForWorkspace
};
