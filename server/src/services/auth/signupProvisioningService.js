const mongoose = require('mongoose');
const { Workspace, User } = require('../../models');
const gupshupService = require('../bsp/gupshupService');
const bspOnboardingServiceV2 = require('../bsp/bspOnboardingServiceV2');

/**
 * Handles the background provisioning of a Gupshup app and Meta embedded signup
 * immediately after a user registers.
 * 
 * @param {string} userId - ID of the newly created User
 * @param {string} workspaceId - ID of the corresponding Workspace
 * @param {Object} contactInfo - { name, email, phone }
 */
async function processSignupProvisioning(userId, workspaceId, contactInfo) {
    try {
        console.log(`[Provisioning] Starting background setup for Workspace: ${workspaceId}, User: ${userId}`);

        // 1. Fetch fresh workspace
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

        const user = await User.findById(userId);
        if (!user) throw new Error(`User not found: ${userId}`);

        // Update status to indicate we started
        workspace.esbFlow = {
            ...workspace.esbFlow,
            status: 'signup_initiated',
            startedAt: new Date()
        };
        await workspace.save();

        // 2. Create Gupshup App
        console.log(`[Provisioning] Step 1: Creating App for Workspace ${workspaceId}`);
        // Extract a sanitized business name or use a default.
        // Gupshup app names usually need to be lowercase, alphanumeric, max 30 chars, no spaces.
        const rawAppName = workspace.name ? workspace.name.toLowerCase().replace(/[^a-z0-9]/g, '') : `app${Date.now()}`;

        // Ensure it doesn't start with a number if possible, and append 'waba' to guarantee uniqueness/validity
        const prefix = /^[0-9]/.test(rawAppName) ? 'ws' : '';
        const cleanAppName = `${prefix}${rawAppName.substring(0, 20)}waba`;

        // Attempt creation. Gupshup might return existing apps if names clash, 
        // but the `createPartnerApp` checks for existing or creates new.
        const appResult = await gupshupService.createPartnerApp(cleanAppName);
        const appId = appResult?.app?.id;

        if (!appId) throw new Error('Failed to create or retrieve Gupshup App ID');
        console.log(`[Provisioning] App Created: ${appId}`);

        // Update Workspace with App ID
        workspace.gupshupAppId = appId;

        // 3. Set Contact Info
        console.log(`[Provisioning] Step 2: Setting Contact Info for App ${appId}`);
        // Provide defaults if missing, phone needs to be valid E164 if possible
        await gupshupService.updateOnboardingContact({
            appId,
            contactEmail: contactInfo.email || user.email,
            contactName: contactInfo.name || user.name || cleanAppName,
            contactNumber: contactInfo.phone || '919999999999' // Needs a fallback if phone wasn't provided (social logs)
        });

        // 4. Get App Token
        console.log(`[Provisioning] Step 3: Resolving App Access Token for config`);
        const appToken = await gupshupService.resolveAppScopedToken(appId);
        if (appToken) {
            workspace.gupshupIdentity = {
                ...workspace.gupshupIdentity,
                partnerAppId: appId,
                appApiKey: appToken,
                appStatus: 'created'
            };
        }

        // 5. Create Webhook Subscriptions
        console.log(`[Provisioning] Step 4: Setting up Webhook Subscriptions`);
        try {
            await bspOnboardingServiceV2.setupWebhookSubscriptions(appId);
        } catch (subErr) {
            console.warn(`[Provisioning/Warning] Failed to setup subscriptions for ${appId}, continuing...`, subErr.message);
        }

        // 6. Generate Embed Link
        console.log(`[Provisioning] Step 5: Generating Embed Link for Meta Onboarding`);
        // Note: In strict BSP mode, use BSP's ID, otherwise use Workspace ID mapping
        const trackingId = workspace._id.toString();

        // Need to handle missing parameter cases that might break `generateEmbedLink`
        // Usually relies on the frontend passing origin, but we are in background. 
        // We can fetch from env or fallback
        const callbackUrl = process.env.GUPSHUP_EMBED_CALLBACK_URL || `${process.env.APP_URL}/api/v1/webhooks/gupshup/esb`;

        const embedResult = await gupshupService.generateEmbedLink({ appId, trackingId });
        const embedUrl = embedResult?.embedUrl || embedResult?.url;

        if (embedUrl) {
            // Temporarily store the embedUrl in esbFlow authState or notes so frontend can fetch it easily later
            // Or in a dedicated field if model is updated
            workspace.esbFlow = {
                ...workspace.esbFlow,
                callbackState: trackingId, // Usually our own ID as tracking ID
                notes: embedUrl // storing here for easy retrieval
            };

            console.log(`[Provisioning] ✅ Embed Link Generated successfully.`);
        } else {
            console.warn(`[Provisioning/Warning] Could not parse embed URL from response.`);
        }

        // 7. Save Final State
        workspace.esbFlow.status = 'token_exchanged'; // Or a custom 'provisioned' state
        await workspace.save();

        console.log(`[Provisioning] ✅ Background provisioning completed successfully for Workspace ${workspaceId}`);
        return { success: true, appId, embedUrl };

    } catch (error) {
        // More detailed error logging for Gupshup API failures (like 400s)
        const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        console.error(`[ProvisioningError] Failed during background setup for User ${userId}, Workspace ${workspaceId}:`, errorDetails);

        try {
            // Attempt to record failure in DB
            await Workspace.updateOne(
                { _id: workspaceId },
                {
                    $set: {
                        'esbFlow.status': 'failed',
                        'esbFlow.failureReason': error.message,
                        'esbFlow.failedAt': new Date()
                    }
                }
            );
        } catch (dbErr) {
            console.error(`[ProvisioningError] Failed to save failure state to DB:`, dbErr.message);
        }

        throw error;
    }
}

module.exports = {
    processSignupProvisioning
};
