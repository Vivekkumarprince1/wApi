import { create } from 'zustand';
import api from '@/lib/axios';

const clearAuthCookie = () => {
    if (typeof document !== 'undefined') {
        document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
    }
}

const STARTER_PLAN_FALLBACK = {
    name: 'Starter (Standard)',
    slug: 'starter',
    features: ['CRM', 'ANALYTICS', 'MESSAGING', 'BULK_CAMPAIGN', 'CONTACTS', 'COMMERCE', 'WHATSAPP_FORMS'],
    limits: {
        maxContacts: 500,
        maxMessagesPerMonth: 2000,
        maxAutomations: 2
    }
};

export const useAuthStore = create((set, get) => ({
    user: null,
    workspace: null,
    stage1Complete: false,
    phoneStatus: 'NOT_CONNECTED',
    phone: {
        number: null,
        verified: false
    },
    loading: true,
    lastFetchTime: 0,
    inFlightPromise: null,
    nextStep: null,

    // Permissions
    authenticated: false,
    permissions: null,
    canCreateTemplates: false,
    canCreateCampaigns: false,
    canSendMessages: false,
    canManageTeam: false,
    canViewBilling: false,
    canAccessAdmin: false,
    isOnTrial: false,
    trialDaysLeft: null,

    // Computed getters
    getRole: () => get().user?.role || 'viewer',
    getAuthenticated: () => !!get().user,
    getTrialDaysLeft: () => {
        const user = get().user;
        return user?.trialEndsAt
            ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null;
    },
    getIsOnTrial: () => {
        const user = get().user;
        const days = get().getTrialDaysLeft();
        return user?.plan === 'trial' || (days !== null && days > 0);
    },

    fetchSession: async (force = false) => {
        const { inFlightPromise } = get();
        if (inFlightPromise) return inFlightPromise;

        const doFetch = async () => {
            try {
                const sessionData = await api.get('/auth/session');
                
                if (!sessionData || !sessionData.authenticated) {
                    clearAuthCookie();
                    set({ 
                        user: null, 
                        workspace: null, 
                        loading: false, 
                        inFlightPromise: null, 
                        authenticated: false,
                        phone: { number: null, verified: false }
                    });
                    return;
                }

                const { user: userData, workspace: userWorkspace, phone: phoneData, permissions: userPerms } = sessionData;
                const role = userData.role || 'viewer';
                const stage1Complete = userWorkspace?.stage1?.complete || false;

                // Robust Plan Parsing with Starter Fallback
                let activePlan = userWorkspace?.plan || userData.plan;
                if (!activePlan || (typeof activePlan === 'string' && activePlan === 'free') || !activePlan.features) {
                    activePlan = STARTER_PLAN_FALLBACK;
                }

                set({
                    user: {
                        id: userData.id,
                        name: userData.name,
                        email: userData.email,
                        role: role,
                        team: userData.team,
                        plan: activePlan,
                        emailVerified: userData.emailVerified,
                        accountStatus: userData.accountStatus || 'AWAITING_EMAIL_VERIFICATION',
                        workspace: userWorkspace ? userWorkspace.id : null,
                    },
                    workspace: userWorkspace ? {
                        id: userWorkspace.id,
                        name: userWorkspace.name,
                        whatsappConnected: userWorkspace.whatsappConnected,
                        onboardingStatus: userWorkspace.onboarding?.status,
                        stage1: userWorkspace.stage1,
                        // Hydration data
                        address: userWorkspace.address,
                        city: userWorkspace.city,
                        state: userWorkspace.state,
                        country: userWorkspace.country,
                        zipCode: userWorkspace.zipCode,
                        industry: userWorkspace.industry,
                        website: userWorkspace.website,
                        onboarding: userWorkspace.onboarding
                    } : null,
                    stage1Complete: stage1Complete,
                    phoneStatus: userWorkspace?.stage1?.phoneStatus || 'NOT_CONNECTED',
                    phone: {
                        number: phoneData?.number || null,
                        verified: !!phoneData?.verified
                    },
                    
                    authenticated: true,
                    nextStep: sessionData.nextStep,
                    permissions: userPerms,
                    canCreateTemplates: stage1Complete && (userPerms?.createTemplates ?? ['owner', 'manager', 'admin'].includes(role)),
                    canCreateCampaigns: stage1Complete && (userPerms?.createCampaigns ?? ['owner', 'manager', 'admin'].includes(role)),
                    canSendMessages: stage1Complete && (userPerms?.sendMessages ?? ['owner', 'manager', 'agent', 'admin'].includes(role)),
                    canManageTeam: userPerms?.manageTeam ?? ['owner', 'manager', 'admin'].includes(role),
                    canViewBilling: userPerms?.billing?.view ?? ['owner', 'admin'].includes(role),
                    canAccessAdmin: ['owner', 'admin'].includes(role),
                });
                return sessionData;
            } catch (err) {
                console.error('[AuthStore] Session fetch failed:', err);
                set({ user: null, authenticated: false });
                throw err;
            } finally {
                set({ loading: false, inFlightPromise: null });
            }
        };

        const promise = doFetch();
        set({ inFlightPromise: promise });
        return promise;
    },

    logout: () => {
        api.post('/auth/logout').catch(() => {});
        clearAuthCookie();
        set({
            user: null,
            workspace: null,
            stage1Complete: false,
            lastFetchTime: 0,
            inFlightPromise: null,
            authenticated: false,
        });
        if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
        }
    },

    deleteAccount: async () => {
        try {
            await api.delete('/auth/account');
            clearAuthCookie();
            set({
                user: null,
                workspace: null,
                stage1Complete: false,
                lastFetchTime: 0,
                inFlightPromise: null,
                authenticated: false,
            });
            if (typeof window !== 'undefined') {
                window.location.href = '/';
            }
            return { success: true };
        } catch (error) {
            console.error('[AuthStore] Account deletion failed:', error);
            throw error;
        }
    }
}));

export const refetch = () => useAuthStore.getState().fetchSession(true);

export function useFeatureGate(feature) {
  const workspace = useAuthStore();
  const userPlan = workspace.user?.plan;
  const features = userPlan?.features || [];

  // Normalize feature name and map to backend Plan keys
    const getMappedFeatureKey = (f) => {
        const map = {
            'campaigns': 'BULK_CAMPAIGN',
            'commerce': 'COMMERCE',
            'whatsform': 'WHATSAPP_FORMS',
            'whatsapp-forms': 'WHATSAPP_FORMS',
            'analytics': 'ANALYTICS',
            'automation': 'AUTOMATION',
            'crm': 'CRM',
            'answerbot': 'ANSWERBOT'
        };
        const normalized = f.toLowerCase().replace(/-/g, '_');
        return map[normalized] || normalized.toUpperCase();
    };

  const featureKey = getMappedFeatureKey(feature);
  const hasPlanAccess = features.includes(featureKey) || features.includes('ALL');

  const gates = {
    analytics: {
        allowed: hasPlanAccess || features.includes('ANALYTICS'),
        reason: !hasPlanAccess ? 'Upgrade your plan to unlock analytics' : undefined
    },
    crm: {
        allowed: hasPlanAccess || features.includes('CRM'),
        reason: !hasPlanAccess ? 'Upgrade your plan to unlock Sales CRM' : undefined
    },
    automation: {
        allowed: hasPlanAccess || features.includes('AUTOMATION'),
        reason: !hasPlanAccess ? 'Upgrade your plan to unlock advanced automation' : undefined
    },
    commerce: {
        allowed: hasPlanAccess || features.includes('COMMERCE'),
        reason: !hasPlanAccess ? 'Upgrade your plan to unlock WhatsApp Commerce' : undefined
    },
    inbox: {
        allowed: hasPlanAccess || features.includes('INBOX'),
        reason: !hasPlanAccess ? 'Upgrade your plan to unlock the Shared Inbox' : undefined
    },
    contacts: {
        allowed: hasPlanAccess || features.includes('CONTACTS'),
        reason: !hasPlanAccess ? 'Upgrade your plan to unlock Contact Management' : undefined
    },
    ads: {
        allowed: hasPlanAccess || features.includes('ADS'),
        reason: !hasPlanAccess ? 'Upgrade your plan to unlock Meta Ads' : undefined
    },
    integrations: {
        allowed: hasPlanAccess || features.includes('INTEGRATIONS'),
        reason: !hasPlanAccess ? 'Upgrade your plan to unlock External Integrations' : undefined
    },
    widget: {
        allowed: hasPlanAccess || features.includes('WIDGET'),
        reason: !hasPlanAccess ? 'Upgrade your plan to unlock the Chat Widget' : undefined
    },
    templates: {
      allowed: workspace.canCreateTemplates && (hasPlanAccess || features.includes('TEMPLATES') || features.includes('BULK_CAMPAIGN')),
      reason: !workspace.stage1Complete
        ? 'Connect your WhatsApp number to create templates'
        : !hasPlanAccess && !features.includes('BULK_CAMPAIGN')
          ? 'Upgrade required for advanced templates'
          : !workspace.canCreateTemplates
            ? 'You do not have permission to create templates'
            : undefined
    },
    campaigns: {
      allowed: workspace.canCreateCampaigns && (hasPlanAccess || features.includes('BULK_CAMPAIGN')),
      reason: !workspace.stage1Complete
        ? 'Connect your WhatsApp number to create campaigns'
        : !hasPlanAccess && !features.includes('BULK_CAMPAIGN')
          ? 'Upgrade required for advanced campaigns'
          : !workspace.canCreateCampaigns
            ? 'You do not have permission to create campaigns'
            : undefined
    },
    messaging: {
      allowed: workspace.canSendMessages,
      reason: !workspace.stage1Complete
        ? 'Connect your WhatsApp number to send messages'
        : !workspace.canSendMessages
          ? 'You do not have permission to send messages'
          : undefined
    },
    team: {
      allowed: workspace.canManageTeam && (hasPlanAccess || features.includes('TEAM')),
      reason: !workspace.canManageTeam
        ? 'You do not have permission to manage team'
        : !hasPlanAccess && !features.includes('TEAM')
          ? 'Upgrade your plan to unlock Team Management'
          : undefined
    },
    billing: {
      allowed: workspace.canViewBilling,
      reason: !workspace.canViewBilling
        ? 'Only the workspace Owner or Admin can access billing'
        : undefined
    },
    admin: {
      allowed: workspace.canAccessAdmin,
      reason: !workspace.canAccessAdmin
        ? 'Only the workspace Owner or Admin can access admin settings'
        : undefined
    }
  };

  const gate = gates[feature.toLowerCase()] || { 
    allowed: hasPlanAccess,
    reason: !hasPlanAccess ? `Upgrade your plan to unlock ${feature}` : undefined
  };

  return {
    ...workspace,
    gate,
    isPlanLocked: !hasPlanAccess
  };
}
