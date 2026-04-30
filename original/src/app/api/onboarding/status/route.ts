import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { Business, BusinessAppMap } from '@/lib/models';
import { getOnboardingPath, syncOnboardingState } from '@/lib/services/onboarding/onboarding-state-service';
import { isBusinessVerificationMandatory } from '@/lib/services/onboarding/business-verification-policy-service';

export const GET = withAuth(async (_req: NextRequest, { user, workspace }) => {
  const state = await syncOnboardingState(user, workspace);
  const business = workspace?._id ? await Business.findOne({ workspace: workspace._id }) : null;
  const appMap = business?._id ? await BusinessAppMap.findOne({ business: business._id, active: true }) : null;
  const businessVerificationRequired = await isBusinessVerificationMandatory();
  const businessVerificationSatisfied = !businessVerificationRequired || business?.verificationStatus === 'verified';

  return NextResponse.json({
    success: true,
    currentStep: state.currentStep,
    nextStep: getOnboardingPath(state.currentStep),
    completed: state.currentStep === 'COMPLETED',
    businessVerificationRequired,
    steps: {
      emailVerified: !!user.emailVerified || user.authProvider === 'google' || !user.email,
      phoneVerified: !!user.phoneVerified,
      businessInfo: !!business,
      businessVerification: businessVerificationSatisfied,
      businessConfirmation: !!business?.confirmed,
      appAssigned: !!appMap || !!workspace?.gupshupAppId,
      whatsappConnected: !!workspace?.whatsappConnected || workspace?.bspPhoneStatus === 'CONNECTED'
    },
    business,
    app: appMap ? { gupshupAppId: appMap.gupshupAppId } : null
  });
});
