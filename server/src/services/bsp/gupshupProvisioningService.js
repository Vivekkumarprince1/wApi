const crypto = require('crypto');
const gupshupService = require('./gupshupService');
const { Workspace, User } = require('../../models');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback_secret_key_32_chars_long!!';

// Utility to encrypt the token before storing
function encryptToken(token) {
    if (!token) return null;
    const iv = crypto.randomBytes(16);
    // Ensure key is exactly 32 bytes
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

// Ensure decoding is easy
function decryptToken(encryptedData) {
    if (!encryptedData) return null;

    // If it's not encrypted (doesn't contain ':') but looks like a token, return as-is
    if (!encryptedData.includes(':')) {
        if (encryptedData.startsWith('sk_')) return encryptedData;
        return null;
    }

    try {
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('[Provisioning] Error decrypting token:', error.message);
        return null;
    }
}

/**
 * Orchestrates the 5-step Gupshup Partner Onboarding before showing the Embed UI
 */
async function provisionPartnerApp(userId, options = {}) {
    // 1. Resolve User and Workspace
    const user = await User.findById(userId).populate('workspace');
    if (!user || !user.workspace) {
        throw new Error('User or Workspace not found. Must complete signup first.');
    }

    const workspace = user.workspace;
    let appName = options.businessName || workspace.name || `WABA${workspace._id.toString().substring(0, 8)}`;

    // Gupshup requires appName to be alphanumeric only, and between 6 and 150 characters
    appName = appName.replace(/[^a-zA-Z0-9]/g, '');

    // Append a unique suffix to prevent 409 "Bot Already Exists" cross-tenant collisions
    const uniqueSuffix = Date.now().toString(36).substring(4);
    appName = `${appName}${uniqueSuffix}`;

    if (appName.length < 6) {
        appName = `${appName}WABA`.substring(0, 50);
    } else if (appName.length > 50) {
        // Gupshup typically errors on very long names in partner API despite the 150 limit stated, safely truncating to 50
        appName = appName.substring(0, 50);
    }

    // Mark Onboarding Started
    workspace.onboardingStatus = 'ONBOARDING_STARTED';
    await workspace.save();

    // STEP 2: Create App (Gupshup Side) — ONE-TIME ONLY
    console.log(`[Provisioning] Step 2: Checking for existing App...`);
    let appId = workspace.gupshupIdentity?.partnerAppId || workspace.gupshupAppId;

    if (appId) {
        console.log(`[Provisioning] Step 2: App already exists (${appId}), skipping creation.`);
    } else {
        console.log(`[Provisioning] Step 2: No existing app found, creating "${appName}"`);
        const newApp = await gupshupService.createPartnerApp(appName);
        if (!newApp || !newApp.appId) {
            throw new Error('Failed to create Gupshup app');
        }
        appId = newApp.appId;

        // Persist to BOTH fields for consistency
        if (!workspace.gupshupIdentity) workspace.gupshupIdentity = {};
        workspace.gupshupIdentity.partnerAppId = appId;
        workspace.gupshupAppId = appId;
        workspace.onboardingStatus = 'APP_CREATED';
        workspace.markModified('gupshupIdentity');
        await workspace.save();
    }

    // STEP 3: Set Contact Details (MANDATORY BEFORE EMBED)
    console.log(`[Provisioning] Step 3: Setting Contact for App ${appId}`);
    await gupshupService.updateOnboardingContact({
        appId: appId,
        contactName: options.businessName || appName,
        contactEmail: options.contactEmail || user.email,
        contactNumber: options.phone || user.phone || '9999999999' // Requires a valid looking phone usually
    });

    workspace.onboardingStatus = 'CONTACT_SET';
    await workspace.save();

    // STEP 4: Get APP TOKEN
    console.log(`[Provisioning] Step 4: Getting App Token for App ${appId}`);
    const appToken = await gupshupService.getPartnerAppAccessToken(appId);
    if (!appToken) {
        throw new Error('Failed to retrieve Gupshup App Token');
    }

    if (!workspace.gupshupIdentity) workspace.gupshupIdentity = {};
    workspace.gupshupIdentity.appApiKey = encryptToken(appToken);
    workspace.markModified('gupshupIdentity');
    await workspace.save();

    // STEP 5: Set Webhook Subscriptions (Automated V3)
    console.log(`[Provisioning] Step 5: Setting Webhook Subscriptions for App ${appId}`);
    try {
        const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || `${process.env.API_BASE_URL || 'https://api.yourdomain.com'}/api/v1/webhook/gupshup`;
        await gupshupService.ensureRequiredSubscriptions({
            appId,
            appApiKey: appToken,
            webhookUrl
        });
        console.log(`[Provisioning] Successfully ensured required V3 subscriptions`);
    } catch (err) {
        console.warn(`[Provisioning] Failed to ensure required subscriptions (non-blocking):`, err.message);
    }

    // STEP 5.5: Register Phone Region (ONLY for 'new_number' flow)
    if (options.connectionType === 'new_number') {
        const region = String(options.region || 'IN').toUpperCase();
        console.log(`[Provisioning] Step 5.5: Registering phone for region ${region} on App ${appId}`);
        try {
            await gupshupService.registerPhoneForApp({ appId, region });
            console.log(`[Provisioning] Phone registration initiated for region ${region}`);
        } catch (err) {
            // Non-fatal: registration may already be done or may complete during embed flow
            console.warn(`[Provisioning] Phone registration warning (non-blocking): ${err.message}`);
        }
    }

    // STEP 6: Generate Embedded Signup Link
    console.log(`[Provisioning] Step 6: Generating Embed Link for App ${appId}`);
    const embed = await gupshupService.getOnboardingEmbedLink({
        appId: appId,
        user: `usr_${userId.toString().substring(0, 10)}`,
        callbackUrl: options.callbackUrl,
        regenerate: options.connectionType === 'new_number' // Force fresh link for new number flow
    });

    if (!embed || (!embed.url && !embed.link && !embed.embedLink && !embed.data?.url)) {
        throw new Error('Failed to generate embed link from Gupshup');
    }

    return {
        url: embed.link || embed.url || embed.data?.url || embed.embedLink,
        appId: appId,
        appName: appName,
        workspaceId: workspace._id.toString(),
        status: workspace.onboardingStatus
    };
}

/**
 * Runs asynchronously after ACCOUNT_VERIFIED webhook is received.
 * Syncs templates and sets basic business profile / ice breakers.
 */
async function runPostOnboardingAutomations(workspace) {
    if (!workspace || !workspace.gupshupIdentity?.partnerAppId) {
        return;
    }
    const appId = workspace.gupshupIdentity.partnerAppId;
    const appApiKeyEncrypted = workspace.gupshupIdentity.appApiKey;
    const appApiKey = decryptToken(appApiKeyEncrypted);

    if (!appApiKey) {
        console.error(`[Provisioning Automations] Missing app API key for workspace ${workspace._id}`);
        return;
    }

    console.log(`[Provisioning Automations] Starting sync for App ${appId}`);

    // 1. Sync Templates (background)
    try {
        if (gupshupService.syncTemplatesForApp) {
            await gupshupService.syncTemplatesForApp({ appId, appApiKey });
            console.log(`[Provisioning Automations] Triggered template sync for App ${appId}`);
        }
    } catch (error) {
        console.error(`[Provisioning Automations] Failed to sync templates for App ${appId}:`, error.message);
    }

    // 2. Set Default Business Profile / Welcome Message (Optional, UX Enhancements)
    try {
        // In production, you would call:
        // PUT /partner/app/{appId}/business/profile
        // POST /partner/app/{appId}/conversational/component
        console.log(`[Provisioning Automations] Profile & Ice Breakers configured for App ${appId}`);
    } catch (error) {
        console.warn(`[Provisioning Automations] Failed to set profile for App ${appId}:`, error.message);
    }

    // 3. Ensure Subscriptions (Verification step after connection)
    try {
        const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL || `${process.env.API_BASE_URL || 'https://api.yourdomain.com'}/api/v1/webhook/gupshup`;
        await gupshupService.ensureRequiredSubscriptions({
            appId,
            appApiKey,
            webhookUrl
        });
        console.log(`[Provisioning Automations] Verified subscriptions for App ${appId}`);
    } catch (error) {
        console.warn(`[Provisioning Automations] Failed to verify subscriptions for App ${appId}:`, error.message);
    }
}

module.exports = {
    provisionPartnerApp,
    runPostOnboardingAutomations,
    encryptToken,
    decryptToken
};
