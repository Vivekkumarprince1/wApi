const gupshupService = require('./gupshupService');

const STORAGE_BOUNDARY = {
  persist: [
    'workspace identity and tenant routing',
    'encrypted app token and provider app identifiers',
    'phone routing fields needed for webhook lookup',
    'local inbox entities: contacts, conversations, messages',
    'template drafts, approval lifecycle, edit history, send history',
    'billing ledgers, audit trails, webhook logs with TTL'
  ],
  liveFetch: [
    'partner app details',
    'WABA health, quality, tier, ownership and MM Lite status',
    'provider subscription configuration',
    'approved template catalog from Gupshup',
    'wallet, ratings, and business profile endpoints'
  ],
  avoidDuplicating: [
    'full provider phone arrays when a single routed phone is already stored',
    'raw provider app snapshots in Workspace',
    'redundant provider business-profile mirrors from sync jobs',
    'provider template metadata that is already available live'
  ]
};

function normalizeConnectedFlag(status, fallback) {
  if (typeof fallback === 'boolean') return fallback;
  return ['CONNECTED', 'ACTIVE', 'LIVE', 'VERIFIED'].includes(String(status || '').toUpperCase());
}

function normalizePhoneStatus(source = {}) {
  return (
    source.phoneStatus ||
    source.bspPhoneStatus ||
    source.accountStatus ||
    source.status ||
    (source.live ? 'CONNECTED' : null) ||
    'PENDING'
  );
}

function buildLeanWorkspaceProjection(source = {}, options = {}) {
  const existingIdentity = options.currentWorkspace?.gupshupIdentity || {};
  const incomingIdentity = source.gupshupIdentity || {};

  const partnerAppId =
    incomingIdentity.partnerAppId ||
    source.gupshupAppId ||
    source.appId ||
    existingIdentity.partnerAppId ||
    null;

  const appApiKey =
    incomingIdentity.appApiKey ||
    source.appApiKey ||
    existingIdentity.appApiKey ||
    null;

  const phoneStatus = normalizePhoneStatus(source);
  const displayPhoneNumber =
    source.displayPhoneNumber ||
    source.whatsappPhoneNumber ||
    source.bspDisplayPhoneNumber ||
    source.phone ||
    options.currentWorkspace?.whatsappPhoneNumber ||
    options.currentWorkspace?.bspDisplayPhoneNumber ||
    null;

  const phoneNumberId =
    source.phoneNumberId ||
    source.bspPhoneNumberId ||
    source.whatsappPhoneNumberId ||
    null;

  const wabaId = source.wabaId || source.bspWabaId || options.currentWorkspace?.wabaId || null;
  const qualityRating = source.qualityRating || source.bspQualityRating || source.phoneQuality || options.currentWorkspace?.qualityRating || 'UNKNOWN';
  const messagingTier = source.messagingLimitTier || source.bspMessagingTier || source.messagingLimit || options.currentWorkspace?.messagingLimitTier || null;
  const verifiedName = source.verifiedName || source.bspVerifiedName || options.currentWorkspace?.verifiedName || null;
  const sourceNumber = incomingIdentity.source || source.source || displayPhoneNumber || existingIdentity.source || null;

  return {
    businessId: source.businessId || source.customerId || options.currentWorkspace?.businessId || null,
    wabaId,
    bspWabaId: wabaId,
    gupshupAppId: partnerAppId,
    bspManaged: true,
    whatsappConnected: normalizeConnectedFlag(phoneStatus, source.whatsappConnected),
    connectedAt: source.connectedAt || options.currentWorkspace?.connectedAt || null,
    onboardingStatus: source.onboardingStatus || options.currentWorkspace?.onboardingStatus || null,
    phoneStatus,
    bspPhoneStatus: phoneStatus,
    phoneNumberId,
    bspPhoneNumberId: phoneNumberId,
    whatsappPhoneNumberId: phoneNumberId,
    whatsappPhoneNumber: displayPhoneNumber,
    bspDisplayPhoneNumber: displayPhoneNumber,
    verifiedName,
    bspVerifiedName: verifiedName,
    qualityRating,
    bspQualityRating: qualityRating,
    messagingLimitTier: messagingTier,
    bspMessagingTier: messagingTier,
    codeVerificationStatus: source.codeVerificationStatus || options.currentWorkspace?.codeVerificationStatus || null,
    nameStatus: source.nameStatus || options.currentWorkspace?.nameStatus || null,
    isOfficialAccount: source.isOfficialAccount ?? options.currentWorkspace?.isOfficialAccount ?? false,
    gupshupAppName: source.gupshupAppName || source.appName || options.currentWorkspace?.gupshupAppName || null,
    gupshupIdentity: {
      partnerAppId,
      appApiKey,
      appStatus: incomingIdentity.appStatus || source.appStatus || existingIdentity.appStatus || null,
      source: sourceNumber
    }
  };
}

function summarizeTemplatesResponse(responseData) {
  const templates = responseData?.templates || responseData?.data || responseData?.templateList || [];
  const statusCounts = {};

  for (const template of templates) {
    const status = String(template.status || 'UNKNOWN').toUpperCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  return {
    total: templates.length,
    statusCounts,
    templates
  };
}

function unwrapSettled(result) {
  if (result.status === 'fulfilled') {
    return { ok: true, data: result.value };
  }

  return {
    ok: false,
    error: result.reason?.message || 'UNKNOWN_ERROR'
  };
}

async function getWorkspaceRuntimeProfile(workspace) {
  if (!workspace) {
    throw new Error('WORKSPACE_REQUIRED');
  }

  const appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;
  if (!appId) {
    return {
      connected: false,
      storageBoundary: STORAGE_BOUNDARY,
      persisted: buildLeanWorkspaceProjection(workspace.toObject ? workspace.toObject() : workspace),
      live: null
    };
  }

  const appToken = await gupshupService.getPartnerAppAccessToken(appId);

  const [appDetails, wabaInfo, subscriptions, templates] = await Promise.allSettled([
    gupshupService.getPartnerApp(appId),
    gupshupService.getWabaInfo(appId),
    gupshupService.listSubscriptions({ appId, appApiKey: appToken }),
    gupshupService.listTemplates({ appId, appApiKey: appToken, pageNo: 1, pageSize: 100 })
  ]);

  return {
    connected: true,
    storageBoundary: STORAGE_BOUNDARY,
    persisted: buildLeanWorkspaceProjection(workspace.toObject ? workspace.toObject() : workspace),
    live: {
      app: unwrapSettled(appDetails),
      waba: unwrapSettled(wabaInfo),
      subscriptions: unwrapSettled(subscriptions),
      templates: templates.status === 'fulfilled'
        ? { ok: true, data: summarizeTemplatesResponse(templates.value) }
        : { ok: false, error: templates.reason?.message || 'UNKNOWN_ERROR' }
    }
  };
}

module.exports = {
  STORAGE_BOUNDARY,
  buildLeanWorkspaceProjection,
  getWorkspaceRuntimeProfile
};
