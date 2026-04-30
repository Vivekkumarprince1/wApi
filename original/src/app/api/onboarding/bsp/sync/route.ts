import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Business } from '@/lib/models';
import { syncAssignedGupshupApp } from '@/lib/services/bsp/gupshup-app-assignment-service';
import { PostOnboardingService } from '@/lib/services/onboarding/post-onboarding-service';

export const POST = withAuth(async (_req: NextRequest, { user, workspace }) => {
  try {
    const business = await Business.findOne({ workspace: workspace._id });
    const updatedWorkspace = await syncAssignedGupshupApp(user, workspace, business);

    // If the workspace is now connected but onboarding automations haven't run yet
    if (updatedWorkspace && updatedWorkspace.whatsappConnected && !updatedWorkspace.onboarding?.completed) {
      console.log(`[Sync] WhatsApp connected for ${workspace._id}. Triggering post-onboarding automations...`);
      // We run this without awaiting to return the response faster to the UI, 
      // as template sync and profile update can take time.
      PostOnboardingService.runAutomations(workspace._id.toString()).catch(err => {
        console.error('[Sync] Post-onboarding automations failed:', err.message);
      });
    }

    return NextResponse.json({ success: true, workspace: updatedWorkspace });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: error.status || 500 });
  }
});
