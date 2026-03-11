'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WORKSPACE CONTEXT HOOK — NOW POWERED BY AuthProvider
 * Consumes the centralized AuthProvider instead of fetching independently.
 * Same return interface — all existing consumers work without changes.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useAuth } from '@/lib/AuthProvider';

export function useWorkspace() {
  const auth = useAuth();

  return {
    user: auth.user ? {
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
      role: auth.user.role,
      plan: auth.user.plan,
      trialEndsAt: auth.user.trialEndsAt,
    } : null,
    stage1Complete: auth.stage1Complete,
    phoneStatus: auth.phoneStatus || 'NOT_CONNECTED',
    phoneNumber: auth.phoneNumber,
    workspace: auth.workspace,
    loading: auth.loading,
    error: null,
    canCreateTemplates: auth.canCreateTemplates,
    canCreateCampaigns: auth.canCreateCampaigns,
    canSendMessages: auth.canSendMessages,
    canManageTeam: auth.canManageTeam,
    canViewBilling: auth.canViewBilling,
    canAccessAdmin: auth.canAccessAdmin,
    isOnTrial: auth.isOnTrial,
    trialDaysLeft: auth.trialDaysLeft,
    refetch: auth.refetch,
  };
}

/**
 * Feature gate helper — same interface, now backed by AuthProvider
 */
export function useFeatureGate(feature) {
  const workspace = useWorkspace();

  const gates = {
    templates: {
      allowed: workspace.canCreateTemplates,
      reason: !workspace.stage1Complete
        ? 'Connect your WhatsApp number to create templates'
        : !['owner', 'manager', 'admin'].includes(workspace.user?.role || '')
          ? 'You need Manager or Owner access to create templates'
          : undefined
    },
    campaigns: {
      allowed: workspace.canCreateCampaigns,
      reason: !workspace.stage1Complete
        ? 'Connect your WhatsApp number to create campaigns'
        : !['owner', 'manager', 'admin'].includes(workspace.user?.role || '')
          ? 'You need Manager or Owner access to create campaigns'
          : undefined
    },
    messaging: {
      allowed: workspace.canSendMessages,
      reason: !workspace.stage1Complete
        ? 'Connect your WhatsApp number to send messages'
        : undefined
    },
    team: {
      allowed: workspace.canManageTeam,
      reason: !['owner', 'manager', 'admin'].includes(workspace.user?.role || '')
        ? 'You need Manager or Owner access to manage team'
        : undefined
    },
    billing: {
      allowed: workspace.canViewBilling,
      reason: !['owner', 'admin'].includes(workspace.user?.role || '')
        ? 'Only the workspace Owner or Admin can access billing'
        : undefined
    },
    admin: {
      allowed: workspace.canAccessAdmin,
      reason: !['owner', 'admin'].includes(workspace.user?.role || '')
        ? 'Only the workspace Owner or Admin can access admin settings'
        : undefined
    }
  };

  return {
    ...workspace,
    gate: gates[feature] || { allowed: true },
  };
}
