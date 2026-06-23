import { create } from 'zustand';
import { apiClient as api } from '@/lib/api/client';

const clearAuthCookie = () => {
    if (typeof document !== 'undefined') {
        document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
    }
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('socket_auth_token');
    }
}

const STARTER_PLAN_FALLBACK = {
    name: 'Starter (Standard)',
    slug: 'starter',
    features: [
        'MESSAGING', 'CONTACTS', 'BILLING', 'STATS_TOTAL_CONTACTS', 'STATS_MESSAGES_SENT'
    ],
    limits: {
        maxContacts: 1000,
        maxMessagesPerMonth: 5000,
        maxAutomations: 5
    }
};

interface AuthState {
    user: any;
    workspace: any;
    stage1Complete: boolean;
    phoneStatus: string;
    phone: {
        number: string | null;
        verified: boolean;
    };
    loading: boolean;
    authenticated: boolean;
    nextStep: string | null;
    accessRestriction: {
        kind: 'onboarding' | 'billing';
        title: string;
        description: string;
        targetPath: string;
        actionLabel: string;
    } | null;
    wallet: {
        balance: number;
        thresholdAmount: number;
        currency: string;
        isServiceDown?: boolean;
    };
    permissions: any;
    canCreateTemplates: boolean;
    canCreateCampaigns: boolean;
    canSendMessages: boolean;
    canManageTeam: boolean;
    canViewBilling: boolean;
    canAccessAdmin: boolean;
    systemStatus: {
        maintenanceMode: boolean;
        systemNotice: {
            message: string;
            level: 'info' | 'warning' | 'critical';
            active: boolean;
        } | null;
    };
    isImpersonating: boolean;
    inFlightPromise: Promise<any> | null;
    lastFetchedAt: number;
    fetchSession: (force?: boolean) => Promise<any>;
    invalidateSession: () => Promise<any>;
    logout: () => void;
    stopImpersonating: () => Promise<void>;
    getRole: () => string;
    getTrialDaysLeft: () => number | null;
    getIsOnTrial: () => boolean;
    isSuperAdmin: () => boolean;
}

/**
 * Minimum interval between successive *forced* session refetches.
 *
 * Sized to absorb a React render-cycle storm (multiple effects /
 * children firing fetchSession(true) in the same mount sequence)
 * without affecting real human-time mutations, which are always
 * separated by at least an HTTP round-trip + a click. Post-mutation
 * code paths that absolutely need a fresh fetch should call
 * `invalidateSession()` — it bypasses this window.
 */
const MIN_SESSION_REFETCH_MS = 300;

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    workspace: null,
    stage1Complete: false,
    phoneStatus: 'NOT_CONNECTED',
    phone: {
        number: null,
        verified: false
    },
    loading: true,
    authenticated: false,
    nextStep: null,
    accessRestriction: null,
    wallet: {
        balance: 0,
        thresholdAmount: 500,
        currency: 'INR'
    },
    permissions: null,
    canCreateTemplates: false,
    canCreateCampaigns: false,
    canSendMessages: false,
    canManageTeam: false,
    canViewBilling: false,
    canAccessAdmin: false,
    systemStatus: {
        maintenanceMode: false,
        systemNotice: null
    },
    isImpersonating: false,
    inFlightPromise: null,
    lastFetchedAt: 0,

    getRole: () => get().user?.role || 'viewer',

    getTrialDaysLeft: () => {
        const user = get().user;
        return user?.trialEndsAt
            ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null;
    },

    getIsOnTrial: () => {
        const user = get().user;
        const days = get().getTrialDaysLeft();
        return user?.plan?.slug === 'trial' || (days !== null && days > 0);
    },

    isSuperAdmin: () => get().user?.role === 'super_admin',

    invalidateSession: async () => {
        // Single entry point post-mutation. Bypasses the dedupe in
        // fetchSession by clearing inFlightPromise + lastFetchedAt, so
        // the next caller actually hits the network.
        set({ inFlightPromise: null, lastFetchedAt: 0 });
        return get().fetchSession(true);
    },

    fetchSession: async (force = false) => {
        const { inFlightPromise, lastFetchedAt, user, workspace, authenticated, nextStep, accessRestriction } = get();
        if (inFlightPromise) return inFlightPromise;

        // Re-entrant forced calls collapse to the cached snapshot if
        // the previous fetch completed less than MIN_SESSION_REFETCH_MS
        // ago. We return a sessionData-shaped object built from the
        // current store so callers that read e.g. session.accessRestriction
        // continue to work (login page, billing page, etc.).
        if (force && authenticated && lastFetchedAt && Date.now() - lastFetchedAt < MIN_SESSION_REFETCH_MS) {
            return {
                authenticated: true,
                user,
                workspace,
                nextStep,
                accessRestriction,
            };
        }

        const doFetch = async () => {
            try {
                const sessionData: any = await api.get('/auth/session');

                if (!sessionData || !sessionData.authenticated) {
                    clearAuthCookie();
                    set({
                        user: null,
                        workspace: null,
                        loading: false,
                        inFlightPromise: null,
                        authenticated: false,
                        accessRestriction: null,
                        phone: { number: null, verified: false }
                    });
                    return null;
                }

                // Store token from session for Socket.io access
                if (sessionData.token && typeof sessionStorage !== 'undefined') {
                    try {
                        sessionStorage.setItem('socket_auth_token', sessionData.token);
                        console.log('[AuthStore] ✓ Token stored in sessionStorage');
                    } catch (err) {
                        console.warn('[AuthStore] Could not store token in sessionStorage:', err);
                    }
                }

                const { user: userData, workspace: userWorkspace, phone: phoneData, permissions: userPerms } = sessionData;
                const role = userData.role || 'viewer';
                const stage1Complete = userWorkspace?.stage1?.complete || false;
                const accessRestriction = sessionData.accessRestriction || null;

                let activePlan = userWorkspace?.plan || userData.plan;
                if (!activePlan || (typeof activePlan === 'string' && activePlan === 'free') || !activePlan.features) {
                    activePlan = STARTER_PLAN_FALLBACK;
                }

                set({
                    user: {
                        ...userData,
                        role,
                        plan: activePlan,
                    },
                    workspace: userWorkspace ? {
                        ...userWorkspace,
                        id: userWorkspace.id || userWorkspace._id,
                    } : null,
                    stage1Complete,
                    phoneStatus: userWorkspace?.stage1?.phoneStatus || 'NOT_CONNECTED',
                    phone: {
                        number: phoneData?.number || null,
                        verified: !!phoneData?.verified
                    },
                    authenticated: true,
                    nextStep: sessionData.nextStep,
                    accessRestriction,
                    permissions: userPerms,
                    wallet: userWorkspace?.wallet || { balance: 0, thresholdAmount: 500, currency: 'INR' },

                    canCreateTemplates: stage1Complete && (userPerms?.createTemplates ?? ['owner', 'manager', 'admin'].includes(role)),
                    canCreateCampaigns: stage1Complete && (userPerms?.createCampaigns ?? ['owner', 'manager', 'admin'].includes(role)),
                    canSendMessages: stage1Complete && (userPerms?.sendMessages ?? ['owner', 'manager', 'agent', 'admin'].includes(role)),
                    canManageTeam: userPerms?.manageTeam ?? ['owner', 'manager', 'admin'].includes(role),
                    canViewBilling: (userPerms?.manageBilling || userPerms?.billing?.view) ?? ['owner', 'admin'].includes(role),
                    canAccessAdmin: role === 'super_admin',
                    systemStatus: sessionData.systemStatus || { maintenanceMode: false, systemNotice: null },
                    isImpersonating: !!sessionData.isImpersonating
                });
                return sessionData;
            } catch (err: any) {
                const status = err?.response?.status || err?.status;
                if (status !== 401 && status !== 402) {
                    console.error('[AuthStore] Session fetch failed:', err);
                }
                set({ user: null, authenticated: false, isImpersonating: false, accessRestriction: null });
                return null;
            } finally {
                set({ loading: false, inFlightPromise: null, lastFetchedAt: Date.now() });
            }
        };

        const promise = doFetch();
        set({ inFlightPromise: promise });
        return promise;
    },

    logout: () => {
        clearAuthCookie();
        // Tear down the shared socket so the next user doesn't inherit the
        // previous user's rooms or auth token.
        try {
            // Lazy import to avoid pulling socket.io into the auth store
            // bundle on cold paths that never authenticate.
            import('@/hooks/use-socket').then(mod => mod.disconnectGlobalSocket?.()).catch(() => {});
        } catch {}
        set({
            user: null,
            workspace: null,
            stage1Complete: false,
            authenticated: false,
            accessRestriction: null,
            isImpersonating: false,
            // Reset throttle window so the next login flow gets a real fetch.
            lastFetchedAt: 0,
            inFlightPromise: null,
        });
        api.post('/auth/logout')
            .catch(() => {})
            .finally(() => {
                if (typeof window !== 'undefined') {
                    window.location.href = '/auth/login';
                }
            });
    },

    stopImpersonating: async () => {
        try {
            const res: any = await api.post('/super-admin/stop-impersonating');
            if (res?.success) {
                // Super-admin lives in a separate app now; on stop, return to the
                // customer dashboard (the admin portal is reopened separately).
                window.location.href = res.targetUrl || '/dashboard';
            }
        } catch (error: any) {
            if (error?.response?.status === 403) {
                console.warn('Permission denied to stop impersonating, redirecting to dashboard');
                window.location.href = '/dashboard';
            } else {
                console.error('Failed to restore session', error);
                throw error;
            }
        }
    }
}));

/**
 * Feature Gating Hook (Ported from Legacy)
 */
export function useFeatureGate(feature: string) {
    const store = useAuthStore();
    const userPlan = store.user?.plan;
    const features = userPlan?.features || [];

    const getMappedFeatureKey = (f: string) => {
        const map: Record<string, string> = {
            'campaigns': 'CAMPAIGNS',
            'commerce': 'COMMERCE',
            'whatsform': 'WA_FORMS',
            'whatsapp-forms': 'WA_FORMS',
            'analytics': 'ANALYTICS',
            'automation': 'AUTOMATION',
            'crm': 'CRM',
            'answerbot': 'ANSWERBOT',
            'templates-library': 'TEMPLATES_LIBRARY',
            'flow-hub': 'FLOW_HUB',
            'workflows': 'WORKFLOWS',
            'auto-replies': 'AUTO_REPLIES',
            'instagram-quickflows': 'INSTAGRAM_QUICKFLOWS',
            'ai-intent-matching': 'AI_INTENT',
            'interaktive-list': 'INTERAKTIVE_LIST',
            'pipeline': 'PIPELINE',
            'tasks': 'TASKS',
            'reports': 'REPORTS',
            'catalog': 'CATALOG',
            'orders': 'ORDERS',
            'checkout-bot': 'CHECKOUT_BOT',
            'commerce-settings': 'COMMERCE_SETTINGS',
            'chat-assignment': 'CHAT_ASSIGNMENT',
            'team-management': 'TEAM_MGMT',
            'macros': 'MACROS',
            'integrations': 'INTEGRATIONS',
            'widget-config': 'WIDGET_CONFIG',
            'stats-total-contacts': 'STATS_TOTAL_CONTACTS',
            'stats-messages-sent': 'STATS_MESSAGES_SENT',
            'stats-delivery-rate': 'STATS_DELIVERY_RATE',
            'stats-open-rate': 'STATS_OPEN_RATE'
        };
        const normalized = f.toLowerCase().replace(/-/g, '_');
        return map[normalized] || normalized.toUpperCase();
    };

    const featureKey = getMappedFeatureKey(feature);
    const hasPlanAccess = features.includes(featureKey) || features.includes('ALL');

    const gates: Record<string, { allowed: boolean; reason?: string }> = {
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
            allowed: store.stage1Complete && (hasPlanAccess || features.includes('INBOX')),
            reason: !store.stage1Complete 
                ? 'Connect your WhatsApp number to use the Shared Inbox' 
                : !hasPlanAccess ? 'Upgrade your plan to unlock the Shared Inbox' : undefined
        },
        contacts: {
            allowed: hasPlanAccess || features.includes('CONTACTS'),
            reason: !hasPlanAccess ? 'Upgrade your plan to unlock Contact Management' : undefined
        },
        templates: {
            allowed: store.canCreateTemplates && (hasPlanAccess || features.includes('TEMPLATES') || features.includes('BULK_CAMPAIGN')),
            reason: !store.stage1Complete
                ? 'Connect your WhatsApp number to create templates'
                : !hasPlanAccess && !features.includes('BULK_CAMPAIGN')
                    ? 'Upgrade required for advanced templates'
                    : !store.canCreateTemplates
                        ? 'You do not have permission to create templates'
                        : undefined
        },
        campaigns: {
            allowed: store.canCreateCampaigns && (hasPlanAccess || features.includes('BULK_CAMPAIGN')),
            reason: !store.stage1Complete
                ? 'Connect your WhatsApp number to create campaigns'
                : !hasPlanAccess && !features.includes('BULK_CAMPAIGN')
                    ? 'Upgrade required for advanced campaigns'
                    : !store.canCreateCampaigns
                        ? 'You do not have permission to create campaigns'
                        : undefined
        },
        messaging: {
            allowed: store.canSendMessages,
            reason: !store.stage1Complete
                ? 'Connect your WhatsApp number to send messages'
                : !store.canSendMessages
                    ? 'You do not have permission to send messages'
                    : undefined
        },
        team: {
            allowed: store.canManageTeam && (hasPlanAccess || features.includes('TEAM')),
            reason: !store.canManageTeam
                ? 'You do not have permission to manage team'
                : !hasPlanAccess && !features.includes('TEAM')
                    ? 'Upgrade your plan to unlock Team Management'
                    : undefined
        },
        billing: {
            allowed: store.canViewBilling,
            reason: !store.canViewBilling
                ? 'Only the workspace Owner or Admin can access billing'
                : undefined
        },
        admin: {
            allowed: store.canAccessAdmin,
            reason: !store.canAccessAdmin
                ? 'Only the workspace Owner or Admin can access admin settings'
                : undefined
        }
    };

    const gate = store.isSuperAdmin()
        ? { allowed: true, reason: undefined }
        : (gates[feature.toLowerCase()] || {
            allowed: hasPlanAccess,
            reason: !hasPlanAccess ? `Upgrade your plan to unlock ${feature}` : undefined
          });

    return {
        ...store,
        gate,
        isPlanLocked: store.isSuperAdmin() ? false : !hasPlanAccess
    };
}// Re-triggering build
