'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WORKSPACE CONTEXT HOOK
 * Centralized workspace state management for Interakt-style feature gating
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { get, getCurrentUser } from '@/lib/api';

export interface WorkspaceStatus {
  // User info
  user: {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'manager' | 'agent' | 'viewer';
    plan: string;
    trialEndsAt?: string;
  } | null;
  
  // Stage 1 completion (phone connected)
  stage1Complete: boolean;
  phoneStatus: 'NOT_CONNECTED' | 'pending' | 'verified' | 'display_name_approved' | 'active' | 'restricted' | 'disabled';
  phoneNumber?: string;
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  messagingTier?: string;
  degradation?: {
    level: string;
    degraded: boolean;
    canSend: boolean;
    canRead: boolean;
    message?: string | null;
  };
  
  // Workspace info
  workspace: {
    id: string;
    name: string;
    wabaId?: string;
    businessVerified: boolean;
  } | null;
  
  // Loading states
  loading: boolean;
  error: string | null;
}

export interface UseWorkspaceReturn extends WorkspaceStatus {
  // Permission helpers
  canCreateTemplates: boolean;
  canCreateCampaigns: boolean;
  canSendMessages: boolean;
  canManageTeam: boolean;
  canViewBilling: boolean;
  canAccessAdmin: boolean;
  
  // Trial helpers
  isOnTrial: boolean;
  trialDaysLeft: number | null;
  
  // Actions
  refetch: () => Promise<void>;
}

export function useWorkspace(): UseWorkspaceReturn {
  const [status, setStatus] = useState<WorkspaceStatus>({
    user: null,
    stage1Complete: false,
    phoneStatus: 'NOT_CONNECTED',
    workspace: null,
    loading: true,
    error: null,
  });

  const fetchStatus = useCallback(async () => {
    try {
      // Fetch user and workspace status in parallel
      const [userData, stage1Data] = await Promise.all([
        getCurrentUser().catch(() => null),
        get('/onboarding/bsp/stage1-status').catch(() => ({ stage1: { complete: false, phoneStatus: 'NOT_CONNECTED' } }))
      ]);

      if (!userData) {
        setStatus(prev => ({
          ...prev,
          loading: false,
          error: 'Not authenticated'
        }));
        return;
      }

      const stage1 = stage1Data?.stage1 || {};
      const details = stage1.details || {};
      
      setStatus({
        user: {
          id: userData._id || userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role || 'viewer',
          plan: userData.plan || 'free',
          trialEndsAt: userData.trialEndsAt,
        },
        stage1Complete: stage1.complete || false,
        phoneStatus: details.phoneStatus || stage1.phoneStatus || 'NOT_CONNECTED',
        phoneNumber: details.phoneNumber || stage1.phoneNumber,
        qualityRating: details.qualityRating || 'UNKNOWN',
        messagingTier: details.messagingTier || 'TIER_NOT_SET',
        degradation: stage1.degradation,
        workspace: userData.workspace ? {
          id: userData.workspace._id || userData.workspace,
          name: userData.workspace.name || 'My Workspace',
          wabaId: userData.workspace.wabaId,
          businessVerified: userData.workspace.businessVerified || false,
        } : null,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Failed to fetch workspace status:', err);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load workspace status'
      }));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Calculate trial status
  const calculateTrialDays = (): number | null => {
    if (!status.user?.trialEndsAt) return null;
    const trialEnd = new Date(status.user.trialEndsAt);
    const now = new Date();
    return Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const trialDaysLeft = calculateTrialDays();
  const isOnTrial = status.user?.plan === 'trial' || (trialDaysLeft !== null && trialDaysLeft > 0);

  // Permission helpers based on role and workspace status
  const role = status.user?.role || 'viewer';
  
  const canSendBasedOnHealth = status.stage1Complete && (status.degradation?.canSend ?? true) && status.qualityRating !== 'RED';
  const canCreateTemplates = status.stage1Complete && ['owner', 'manager'].includes(role);
  const canCreateCampaigns = status.stage1Complete && ['owner', 'manager'].includes(role) && canSendBasedOnHealth;
  const canSendMessages = canSendBasedOnHealth && ['owner', 'manager', 'agent'].includes(role);
  const canManageTeam = ['owner', 'manager'].includes(role);
  const canViewBilling = ['owner'].includes(role);
  const canAccessAdmin = ['owner'].includes(role);

  return {
    ...status,
    canCreateTemplates,
    canCreateCampaigns,
    canSendMessages,
    canManageTeam,
    canViewBilling,
    canAccessAdmin,
    isOnTrial,
    trialDaysLeft,
    refetch: fetchStatus,
  };
}

/**
 * Feature gate helper - checks if a feature should be accessible
 */
export function useFeatureGate(feature: 'templates' | 'campaigns' | 'messaging' | 'team' | 'billing' | 'admin') {
  const workspace = useWorkspace();
  
  const gates: Record<string, { allowed: boolean; reason?: string }> = {
    templates: {
      allowed: workspace.canCreateTemplates,
      reason: !workspace.stage1Complete 
        ? 'Connect your WhatsApp number to create templates'
        : !['owner', 'manager'].includes(workspace.user?.role || '')
          ? 'You need Manager or Owner access to create templates'
          : undefined
    },
    campaigns: {
      allowed: workspace.canCreateCampaigns,
      reason: !workspace.stage1Complete 
        ? 'Connect your WhatsApp number to create campaigns'
        : !['owner', 'manager'].includes(workspace.user?.role || '')
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
      reason: !['owner', 'manager'].includes(workspace.user?.role || '')
        ? 'You need Manager or Owner access to manage team'
        : undefined
    },
    billing: {
      allowed: workspace.canViewBilling,
      reason: !['owner'].includes(workspace.user?.role || '')
        ? 'Only the workspace Owner can access billing'
        : undefined
    },
    admin: {
      allowed: workspace.canAccessAdmin,
      reason: !['owner'].includes(workspace.user?.role || '')
        ? 'Only the workspace Owner can access admin settings'
        : undefined
    }
  };

  return {
    ...workspace,
    gate: gates[feature] || { allowed: true },
  };
}
