import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Business, BusinessAppMap, GupshupApp, Workspace } from '@/lib/models';
import { syncOnboardingState } from '@/lib/services/onboarding/onboarding-state-service';
import { clearAppToken } from '@/lib/services/bsp/gupshup-token-service';

export const POST = withAuth(async (_req: NextRequest, { user, workspace }) => {
  const business = await Business.findOne({ workspace: workspace._id });
  if (business) {
    const map = await BusinessAppMap.findOneAndUpdate(
      { business: business._id, active: true },
      { $set: { active: false, disconnectedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (map) {
      await GupshupApp.findByIdAndUpdate(map.app, {
        $set: {
          assigned: false,
          assignedToBusiness: null,
          assignedToWorkspace: null,
          status: 'disconnected'
        },
        $unset: {
          encryptedApiKey: '',
          appApiKeyExpiresAt: '',
          appApiKeyRefreshedAt: ''
        }
      });
      await clearAppToken(String(map.gupshupAppId || workspace.gupshupAppId || ''));
    }
  }

  const updatedWorkspace = await Workspace.findByIdAndUpdate(workspace._id, {
    $set: {
      whatsappConnected: false,
      bspPhoneStatus: 'DISCONNECTED',
      onboardingStatus: 'disconnected',
      gupshupAppLive: false,
      'onboarding.wabaConnectionCompleted': false,
      'onboarding.whatsappSetupCompleted': false,
      'onboarding.step': 'whatsapp-setup',
      'esbFlow.status': 'disconnected'
    },
    $unset: {
      gupshupAppId: '',
      'gupshupIdentity.partnerAppId': '',
      'gupshupIdentity.appApiKey': '',
      'gupshupIdentity.appApiKeyExpiresAt': '',
      'gupshupIdentity.appApiKeyRefreshedAt': '',
      whatsappPhoneNumber: '',
      whatsappPhoneNumberId: '',
      bspPhoneNumberId: '',
      bspDisplayPhoneNumber: '',
      phoneNumberId: ''
    }
  }, { returnDocument: 'after' });

  if (updatedWorkspace) await syncOnboardingState(user, updatedWorkspace);
  return NextResponse.json({ success: true, message: 'WhatsApp app disconnected' });
});
