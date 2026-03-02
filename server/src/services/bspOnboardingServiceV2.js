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
const bspConfig = require('../config/bspConfig');
const gupshupService = require('./gupshupService');
const User = require('../models/User');
const Workspace = require('../models/Workspace');

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

async function resolveOrCreateWorkspaceApp(userId) {
  const user = await User.findById(userId).populate('workspace');
  if (!user) {
    throw new Error('User not found');
  }

  let appId;
  let appName;

  // Check both fields for existing app (one-time creation policy)
  const existingAppId = user.workspace?.gupshupAppId || user.workspace?.gupshupIdentity?.partnerAppId;

  if (existingAppId) {
    // Returning user — reuse existing app
    appId = existingAppId;
    appName = user.workspace.name || `workspace-${userId}`;
    console.log(`[BSP-V2] Reusing existing app: ${appId}`);
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

  return {
    user,
    appId,
    appName,
    workspaceId: user.workspace?._id?.toString() || null
  };
}

async function generateBspSignupUrl(userId, options = {}) {
  getBspConfig();

  const { user, appId, appName, workspaceId } = await resolveOrCreateWorkspaceApp(userId);

  try {
    await gupshupService.updateOnboardingContact({
      appId: appId,
      contactName: options.businessName || appName,
      contactEmail: options.contactEmail || user.email,
      contactNumber: options.phone || user.phone
    });
  } catch (_error) {
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
    phoneNumberId: finalApp.phone || null,
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
