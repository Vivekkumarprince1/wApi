import { Business, BusinessAppMap, OnboardingState, type OnboardingStep, Workspace } from '@/models';
import { isBusinessVerificationMandatory } from '../business/business-verification-policy-service';

export const ONBOARDING_STEP_PATHS: Record<Exclude<OnboardingStep, 'COMPLETED'>, string> = {
  EMAIL_VERIFICATION: '/onboarding/verify-email',
  PHONE_VERIFICATION: '/onboarding/verify-mobile',
  BUSINESS_INFO: '/onboarding/business-info',
  BUSINESS_VERIFICATION: '/onboarding/business-verification',
  BUSINESS_CONFIRMATION: '/onboarding/confirm-business',
  APP_ASSIGNMENT: '/onboarding/app-assignment'
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'EMAIL_VERIFICATION',
  'PHONE_VERIFICATION',
  'BUSINESS_INFO',
  'BUSINESS_VERIFICATION',
  'COMPLETED'
];

export function getOnboardingPath(step: OnboardingStep | null) {
  if (!step || step === 'COMPLETED') return null;
  return ONBOARDING_STEP_PATHS[step];
}

function requiresEmailVerification(user: any) {
  if (!user) return true;
  if (user.authProvider === 'google') return false;
  if (!user.email) return false;
  return !user.emailVerified;
}

function getEffectiveOnboardingSteps(requireBusinessVerification: boolean) {
  return requireBusinessVerification
    ? ONBOARDING_STEPS
    : ONBOARDING_STEPS.filter((item) => item !== 'BUSINESS_VERIFICATION');
}

function completedUntil(step: OnboardingStep, steps: OnboardingStep[]) {
  const index = steps.indexOf(step);
  if (index <= 0) return [];
  return steps.slice(0, index).filter((item) => item !== 'COMPLETED');
}

export async function resolveOnboardingStep(user: any, workspace?: any, requireBusinessVerification?: boolean): Promise<OnboardingStep> {
  const requiresBusinessVerification =
    typeof requireBusinessVerification === 'boolean'
      ? requireBusinessVerification
      : await isBusinessVerificationMandatory();

  if (requiresEmailVerification(user)) return 'EMAIL_VERIFICATION';
  if (!user?.phoneVerified) return 'PHONE_VERIFICATION';
  if (!workspace?._id) return 'BUSINESS_INFO';

  const business = await Business.findOne({ workspace: workspace._id });
  if (!business || !workspace.onboarding?.businessInfoCompleted) return 'BUSINESS_INFO';

  if (!requiresBusinessVerification) return 'COMPLETED';

  if (business.verificationStatus === 'verified') return 'COMPLETED';

  return 'BUSINESS_VERIFICATION';
}

export async function syncOnboardingState(user: any, workspace?: any) {
  const requiresBusinessVerification = await isBusinessVerificationMandatory();
  const currentStep = await resolveOnboardingStep(user, workspace, requiresBusinessVerification);
  const effectiveSteps = getEffectiveOnboardingSteps(requiresBusinessVerification);
  const completedSteps = currentStep === 'COMPLETED'
    ? effectiveSteps
    : completedUntil(currentStep, effectiveSteps);

  const state = await OnboardingState.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        user: user._id,
        workspace: workspace?._id || user.workspace,
        currentStep,
        completedSteps,
        status: currentStep === 'COMPLETED' ? 'completed' : 'in_progress'
      }
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

  if (workspace?._id) {
    const legacyStep =
      currentStep === 'BUSINESS_INFO' ? 'business-info' :
      currentStep === 'COMPLETED' ? 'completed' :
      String(currentStep).toLowerCase().replace(/_/g, '-');

    await Workspace.findByIdAndUpdate(workspace._id, {
      $set: {
        'onboarding.step': legacyStep,
        'onboarding.status': currentStep === 'COMPLETED' ? 'completed' : 'in-progress',
        'onboarding.completed': currentStep === 'COMPLETED',
        ...(currentStep === 'COMPLETED' ? { 'onboarding.completedAt': new Date() } : {})
      }
    });
  }

  return state;
}

export async function getNextOnboardingPath(user: any, workspace?: any) {
  const state = await syncOnboardingState(user, workspace);
  return getOnboardingPath(state.currentStep);
}
