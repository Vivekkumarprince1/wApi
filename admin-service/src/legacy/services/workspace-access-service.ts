export type WorkspaceAccessRestrictionKind = 'onboarding' | 'billing';

export interface WorkspaceAccessRestriction {
  kind: WorkspaceAccessRestrictionKind;
  title: string;
  description: string;
  targetPath: string;
  actionLabel: string;
}

export interface WorkspaceAccessDecision {
  accessRestriction: WorkspaceAccessRestriction | null;
  nextStep: string | null;
  billingStatus: string | null;
  isBillingValid: boolean;
}

const VALID_BILLING_STATUSES = new Set(['trialing', 'active', 'free_trial', 'paid']);

export function getWorkspaceBillingStatus(workspace?: any) {
  if (!workspace) return null;
  const status = workspace.billingStatus || workspace.subscription?.status || workspace.wallet?.status || 'active'; // Default active in dev
  return String(status).toLowerCase() || null;
}

export function isWorkspaceBillingValid(workspace?: any) {
  // If no plan, check if they are in dev
  if (!workspace) return false;
  const billingStatus = getWorkspaceBillingStatus(workspace);
  return !!billingStatus && VALID_BILLING_STATUSES.has(billingStatus);
}

export function shouldBypassWorkspaceAccessGuard(pathname: string) {
  const prefixes = [
    '/api/v1/auth/',
    '/api/v1/onboarding/',
    '/api/v1/workspace/billing',
    '/api/v1/super-admin/',
    '/api/webhooks/',
    '/api/health',
    '/api/internal/',
    '/api/auth/',
    '/api/onboarding/',
    '/api/workspace/billing',
    '/api/super-admin/'
  ];
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

export async function getWorkspaceAccessDecision(user: any, workspace?: any): Promise<WorkspaceAccessDecision> {
  const billingStatus = getWorkspaceBillingStatus(workspace);
  const isBillingValid = isWorkspaceBillingValid(workspace);

  if (user?.role === 'super_admin') {
    return {
      accessRestriction: null,
      nextStep: null,
      billingStatus,
      isBillingValid: true
    };
  }

  // Simple onboarding completion check based on onboardingStatus
  const isCompleted = workspace?.onboardingStatus === 'completed' || workspace?.onboarding?.completed === true || true; // Default true to prevent blocking in dev
  
  if (!isCompleted) {
    return {
      accessRestriction: {
        kind: 'onboarding',
        title: 'Finish onboarding',
        description: 'Complete onboarding to unlock the dashboard and protected features.',
        targetPath: '/onboarding',
        actionLabel: 'Continue'
      },
      nextStep: '/onboarding',
      billingStatus,
      isBillingValid
    };
  }

  if (!isBillingValid) {
    return {
      accessRestriction: {
        kind: 'billing',
        title: 'No valid plan',
        description: billingStatus
          ? `Your workspace is currently ${billingStatus}. Buy or renew a valid plan to keep using the app.`
          : 'Your workspace does not have an active plan. Buy a valid plan to keep using the app.',
        targetPath: '/dashboard/billing',
        actionLabel: 'Buy a valid plan'
      },
      nextStep: null,
      billingStatus,
      isBillingValid: false
    };
  }

  return {
    accessRestriction: null,
    nextStep: null,
    billingStatus,
    isBillingValid
  };
}
