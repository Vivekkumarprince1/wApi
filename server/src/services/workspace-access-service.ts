import { getNextOnboardingPath } from '@/services/onboarding/onboarding-state-service';

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

const VALID_BILLING_STATUSES = new Set(['trialing', 'active']);

export function getWorkspaceBillingStatus(workspace?: any) {
  return String(workspace?.billingStatus || workspace?.subscription?.status || '').toLowerCase() || null;
}

export function isWorkspaceBillingValid(workspace?: any) {
  const billingStatus = getWorkspaceBillingStatus(workspace);
  return !!billingStatus && VALID_BILLING_STATUSES.has(billingStatus);
}

export function shouldBypassWorkspaceAccessGuard(pathname: string) {
  // Routes are mounted under /api/v1/* in server/src/index.ts. Webhooks and
  // health are unversioned. Older /api/* prefixes are kept as a defensive
  // alias in case the gateway strips the version segment.
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
  const isBillingValid = !!billingStatus && VALID_BILLING_STATUSES.has(billingStatus);

  if (user?.role === 'super_admin') {
    return {
      accessRestriction: null,
      nextStep: null,
      billingStatus,
      isBillingValid: true
    };
  }

  const nextStep = await getNextOnboardingPath(user, workspace);
  if (nextStep) {
    return {
      accessRestriction: {
        kind: 'onboarding',
        title: 'Finish onboarding',
        description: 'Complete onboarding to unlock the dashboard and protected features.',
        targetPath: nextStep,
        actionLabel: 'Continue'
      },
      nextStep,
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