import { Workspace, Business } from '@/models';
import { WabaService } from '../messaging/waba-service';
import { GupshupPartnerService } from '../bsp/gupshup-partner-service';
import { TemplateSeedingService } from './template-seeding-service';

export class PostOnboardingService {
  /**
   * Runs Step 8: Post-onboarding automations.
   * Triggered when a phone number is successfully connected.
   */
  static async runAutomations(workspaceId: string) {
    console.log(`[PostOnboarding] Running automations for workspace ${workspaceId}...`);
    
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return;

    try {
      // 1. Seed Library Templates (According to Business)
      // We seed first so the subsequent sync picks up the new templates
      console.log(`[PostOnboarding] Seeding best-practice templates...`);
      await TemplateSeedingService.seedBestPracticeTemplates(workspaceId).catch(err => {
        console.warn(`[PostOnboarding] Template seeding failed: ${err.message}`);
      });

      // 2. Sync Templates
      console.log(`[PostOnboarding] Syncing templates...`);
      await WabaService.syncTemplates(workspaceId).catch(err => {
        console.warn(`[PostOnboarding] Template sync failed: ${err.message}`);
      });

      // 3. Set Default Business Profile
      // Use data collected during Step 1 (Business Info) to populate WhatsApp profile
      const business = await Business.findOne({ workspace: workspaceId });
      if (business && workspace.gupshupAppId && !workspace.gupshupAppId.startsWith('mock_')) {
        console.log(`[PostOnboarding] Setting default business profile...`);
        const profilePayload = {
          description: workspace.description || 'WhatsApp Business Account',
          address: business.address?.line1 || workspace.address || 'India',
          email: business.email || (workspace as any).owner?.email,
          websites: workspace.website ? [workspace.website] : []
        };
        
        await GupshupPartnerService.updateBusinessProfile(workspace.gupshupAppId, profilePayload).catch(err => {
          console.warn(`[PostOnboarding] Profile update failed: ${err.message}`);
        });
      }

      // 3. Mark as fully setup
      workspace.onboarding = {
        ...workspace.onboarding,
        templateSetupCompleted: true,
        completed: true,
        completedAt: new Date()
      };
      await workspace.save();

      console.log(`[PostOnboarding] Automations completed for ${workspaceId}`);
    } catch (error: any) {
      console.error(`[PostOnboarding] Critical failure in automations:`, error.message);
    }
  }
}
