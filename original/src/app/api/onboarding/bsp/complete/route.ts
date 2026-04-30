import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Business, OnboardingState } from '@/lib/models';
import { syncAssignedGupshupApp } from '@/lib/services/bsp/gupshup-app-assignment-service';
import { GupshupPartnerService } from '@/lib/services/bsp/gupshup-partner-service';
import { getNextOnboardingPath } from '@/lib/services/onboarding/onboarding-state-service';

export const POST = withAuth(async (_req: NextRequest, { user, workspace }) => {
  try {
    const onboardingState = await OnboardingState.findOne({ user: user._id });
    const bspSession = onboardingState?.metadata?.bspSession as any;
    const business = await Business.findOne({ workspace: workspace._id });
    if (bspSession?.connectionType === 'new_number' && workspace.gupshupAppId) {
      const phoneNumber = String(bspSession.phoneNumber || user.phone || workspace.whatsappPhoneNumber || workspace.bspDisplayPhoneNumber || '').replace(/\D/g, '');
      if (phoneNumber) {
        try {
          await GupshupPartnerService.registerPhoneForApp({
            appId: workspace.gupshupAppId,
            region: bspSession.region,
            phoneNumber
          });
        } catch (error: any) {
          console.warn('[BSP/COMPLETE] Phone registration warning:', error.response?.data || error.message);
        }
      }
    }

    const updatedWorkspace = await syncAssignedGupshupApp(user, workspace, business);
    const nextStep = await getNextOnboardingPath(user, updatedWorkspace || workspace);

    return NextResponse.json({
      success: true,
      message: updatedWorkspace?.whatsappConnected ? 'WhatsApp connected successfully' : 'WhatsApp setup is pending activation',
      connected: !!updatedWorkspace?.whatsappConnected,
      workspace: updatedWorkspace,
      nextStep
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: error.status || 500 });
  }
});
