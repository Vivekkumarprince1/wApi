import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middlewares/auth';
import { syncOnboardingState, getOnboardingPath } from '@/lib/services/onboarding/onboarding-state-service';

export const POST = withAuth(async (_req: NextRequest, { user, workspace }) => {
  const state = await syncOnboardingState(user, workspace);
  return NextResponse.json({
    success: state.currentStep === 'COMPLETED',
    completed: state.currentStep === 'COMPLETED',
    currentStep: state.currentStep,
    nextStep: getOnboardingPath(state.currentStep)
  });
});
