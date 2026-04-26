import { Business, User, Workspace } from '@/lib/models';
import { assignGupshupAppForBusiness } from '../bsp/gupshup-app-assignment-service';
import { GupshupPartnerService } from '../bsp/gupshup-partner-service';
import { encryptSecretCBC } from '../security/secret-box';
import { syncOnboardingState } from './onboarding-state-service';

export type OnboardingPipelineStatus = 
  | 'NOT_STARTED'
  | 'PROVISIONING_STARTED'
  | 'APP_ASSIGNED'
  | 'TOKEN_RESOLVED'
  | 'CONTACTS_SET'
  | 'WEBHOOKS_CONFIGURED'
  | 'FAILED'
  | 'COMPLETED';

export class OnboardingOrchestrator {
  /**
   * Runs the unified provisioning pipeline (Steps 2-5).
   * This is idempotent and can be resumed from any failure point.
   */
  static async runProvisioningPipeline(workspaceId: string) {
    const workspace = await Workspace.findById(workspaceId).populate('owner');
    if (!workspace) throw new Error('Workspace not found');

    const user = await User.findById(workspace.owner);
    if (!user) throw new Error('Owner not found');

    const business = await Business.findOne({ workspace: workspaceId });
    if (!business) throw new Error('Business info not found');

    // Initialize status if needed
    if (!workspace.onboardingStatus || workspace.onboardingStatus === 'not-started') {
      workspace.onboardingStatus = 'PROVISIONING_STARTED';
      await workspace.save();
    }

    try {
      // Step 2: Create or Reuse Gupshup App
      if (workspace.onboardingStatus === 'PROVISIONING_STARTED') {
        console.log(`[Orchestrator] Step 2: Assigning Gupshup App for ${workspaceId}`);
        await assignGupshupAppForBusiness(user, workspace, business);
        // assignGupshupAppForBusiness updates workspace.onboardingStatus to 'APP_ASSIGNED' internally
      }

      // Step 3: Get App Token (Encrypt and Store)
      // We re-query workspace to get the new gupshupAppId
      const ws = await Workspace.findById(workspaceId);
      if (!ws) throw new Error('Workspace lost during pipeline');

      if (ws.onboardingStatus === 'APP_ASSIGNED') {
        console.log(`[Orchestrator] Step 3: Resolving Token for ${ws.gupshupAppId}`);
        const appId = ws.gupshupAppId;
        if (appId && !appId.startsWith('mock_')) {
          const token = await GupshupPartnerService.getPartnerAppAccessToken(appId);
          if (token) {
            ws.gupshupIdentity = {
              ...ws.gupshupIdentity,
              appApiKey: encryptSecretCBC(token) || undefined,
              appApiKeyRefreshedAt: new Date()
            };
          }
        }
        ws.onboardingStatus = 'TOKEN_RESOLVED';
        await ws.save();
      }

      const wsAfterToken = await Workspace.findById(workspaceId);
      if (!wsAfterToken) throw new Error('Workspace lost during pipeline');

      // Step 4: Set Contact Details (Fingerprint-based skip)
      if (wsAfterToken.onboardingStatus === 'TOKEN_RESOLVED') {
        console.log(`[Orchestrator] Step 4: Setting Contact Details for ${wsAfterToken.gupshupAppId}`);
        const appId = wsAfterToken.gupshupAppId;
        
        if (appId && !appId.startsWith('mock_')) {
          // Fingerprint check: avoid redundant updates if business data hasn't changed
          const contactFingerprint = Buffer.from(`${business.name}:${user.email}:${user.phone}`).toString('base64');
          
          if (wsAfterToken.esbFlow?.contactSyncFingerprint !== contactFingerprint) {
            await GupshupPartnerService.updateOnboardingContact({
              appId,
              contactName: business.name,
              contactEmail: user.email || `${user._id}@placeholder.com`,
              contactNumber: String(user.phone || '').replace(/\D/g, '') || undefined
            });
            wsAfterToken.esbFlow = {
              ...wsAfterToken.esbFlow,
              contactSyncFingerprint: contactFingerprint,
              contactSyncedAt: new Date()
            };
          }
        }
        wsAfterToken.onboardingStatus = 'CONTACTS_SET';
        await wsAfterToken.save();
      }

      const wsAfterContacts = await Workspace.findById(workspaceId);
      if (!wsAfterContacts) throw new Error('Workspace lost during pipeline');

      // Step 5: Set Webhook Subscriptions (V3)
      if (wsAfterContacts.onboardingStatus === 'CONTACTS_SET') {
        console.log(`[Orchestrator] Step 5: Configuring Webhooks for ${wsAfterContacts.gupshupAppId}`);
        const appId = wsAfterContacts.gupshupAppId;
        
        if (appId && !appId.startsWith('mock_')) {
          const webhookUrl = this.resolveWebhookUrl();
          if (webhookUrl) {
            await GupshupPartnerService.setSubscription({
              appId,
              url: webhookUrl
            });
            wsAfterContacts.esbFlow = {
              ...wsAfterContacts.esbFlow,
              subscriptionSyncedAt: new Date()
            };
          }
        }
        wsAfterContacts.onboardingStatus = 'COMPLETED'; // Ready for Dashboard
        wsAfterContacts.onboarding = {
          ...wsAfterContacts.onboarding,
          whatsappSetupCompleted: true
        };
        await wsAfterContacts.save();
        await syncOnboardingState(user, wsAfterContacts);
      }

      return { success: true, status: 'COMPLETED' };
    } catch (error: any) {
      console.error(`[Orchestrator] Pipeline failed at step ${workspace.onboardingStatus}:`, error.message);
      // We don't change onboardingStatus on failure, allowing for resumption on next retry.
      return { success: false, status: workspace.onboardingStatus, error: error.message };
    }
  }

  private static resolveWebhookUrl() {
    const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    if (!base) return null;
    return `${base}/api/webhooks/whatsapp`;
  }
}
