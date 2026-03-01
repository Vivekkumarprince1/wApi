'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AUTH PROVIDER — CENTRALIZED SESSION MANAGEMENT (v2 - deduped)
 * Single fetch, shared everywhere. Bulletproof against:
 * - React StrictMode double-mounting
 * - Navigation-triggered re-renders
 * - Race conditions between authChange events and route changes
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, logoutUser, get } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'manager' | 'agent' | 'viewer' | 'admin';
    plan: string;
    emailVerified: boolean;
    trialEndsAt?: string;
}

export interface AuthWorkspace {
    id: string;
    name: string;
    wabaId?: string;
    gupshupIdentity?: {
        partnerAppId: string;
        appApiKey: string;
        source: string;
    } | null;
    businessVerified: boolean;
    verification?: any;
}

export interface AuthSession {
    user: AuthUser | null;
    workspace: AuthWorkspace | null;
    stage1Complete: boolean;
    phoneStatus: string;
    phoneNumber?: string;
    loading: boolean;
    authenticated: boolean;
    canCreateTemplates: boolean;
    canCreateCampaigns: boolean;
    canSendMessages: boolean;
    canManageTeam: boolean;
    canViewBilling: boolean;
    canAccessAdmin: boolean;
    isOnTrial: boolean;
    trialDaysLeft: number | null;
    refetch: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthSession | null>(null);

// ─── Cookie Helpers ───────────────────────────────────────────────────────────
function setAuthCookie(token: string) {
    document.cookie = `auth_token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

function clearAuthCookie() {
    document.cookie = 'auth_token=; path=/; max-age=0';
}

// ─── Module-level dedup ───────────────────────────────────────────────────────
// These live OUTSIDE the component so they survive StrictMode remounts
let inFlightPromise: Promise<void> | null = null;
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 3000; // Don't re-fetch within 3 seconds

// ─── Provider Component ───────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [workspace, setWorkspace] = useState<AuthWorkspace | null>(null);
    const [stage1Complete, setStage1Complete] = useState(false);
    const [phoneStatus, setPhoneStatus] = useState('NOT_CONNECTED');
    const [phoneNumber, setPhoneNumber] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);

    // Stable fetch function — NO dependencies that change on navigation
    const fetchSession = useCallback(async (force = false) => {
        const now = Date.now();

        // Dedup: if a fetch happened recently and this isn't forced, skip
        if (!force && now - lastFetchTime < MIN_FETCH_INTERVAL) {
            return;
        }

        // Dedup: if there's already a fetch in flight, wait for it
        if (inFlightPromise) {
            await inFlightPromise;
            return;
        }

        const token = localStorage.getItem('token');

        if (!token) {
            setUser(null);
            setWorkspace(null);
            setLoading(false);
            clearAuthCookie();
            return;
        }

        // Sync token to cookie for middleware
        setAuthCookie(token);

        const doFetch = async () => {
            try {
                lastFetchTime = Date.now();
                const [authData, stage1Data] = await Promise.all([
                    get('/auth/me').catch(() => null),
                    get('/onboarding/bsp/stage1-status').catch(() => ({
                        stage1: { complete: false, details: { phoneStatus: 'NOT_CONNECTED' } }
                    }))
                ]);

                if (!mountedRef.current) return;

                if (!authData || !authData.user) {
                    localStorage.removeItem('token');
                    clearAuthCookie();
                    setUser(null);
                    setWorkspace(null);
                    setLoading(false);
                    return;
                }

                const userData = authData.user;
                const userWorkspace = authData.workspace;

                setUser({
                    id: userData._id || userData.id,
                    name: userData.name,
                    email: userData.email,
                    role: userData.role || 'viewer',
                    plan: userWorkspace?.plan || userData.plan || 'free',
                    emailVerified: userData.emailVerified ?? true,
                    trialEndsAt: userData.trialEndsAt,
                });

                if (userWorkspace) {
                    setWorkspace({
                        id: typeof userWorkspace === 'string' ? userWorkspace : (userWorkspace._id || userWorkspace.id),
                        name: userWorkspace.name || 'My Workspace',
                        wabaId: userWorkspace.wabaId,
                        gupshupIdentity: userWorkspace.gupshupIdentity || null,
                        businessVerified: userWorkspace.businessVerified || false,
                        verification: userWorkspace.verification,
                    });
                }

                const stage1 = stage1Data?.stage1 || {};
                setStage1Complete(stage1.complete || false);
                setPhoneStatus(stage1.details?.phoneStatus || 'NOT_CONNECTED');
                setPhoneNumber(stage1.details?.phoneNumber);
            } catch (err) {
                console.error('[AuthProvider] Session fetch failed:', err);
                if (mountedRef.current) setUser(null);
            } finally {
                if (mountedRef.current) setLoading(false);
                inFlightPromise = null;
            }
        };

        inFlightPromise = doFetch();
        await inFlightPromise;
    }, []); // Empty deps — truly stable, never recreated

    // Initial fetch — runs exactly once even in StrictMode
    useEffect(() => {
        mountedRef.current = true;
        fetchSession();
        return () => { mountedRef.current = false; };
    }, [fetchSession]);

    // Listen for auth changes (login, logout, other tabs)
    useEffect(() => {
        const handleAuthChange = () => {
            // Force a fresh fetch (ignores dedup timer)
            lastFetchTime = 0;
            inFlightPromise = null;
            fetchSession(true);
        };

        window.addEventListener('storage', handleAuthChange);
        window.addEventListener('authChange', handleAuthChange);
        return () => {
            window.removeEventListener('storage', handleAuthChange);
            window.removeEventListener('authChange', handleAuthChange);
        };
    }, [fetchSession]);

    // Auto-refresh every 5 minutes (only on authenticated routes)
    useEffect(() => {
        const isPublicRoute = pathname === '/' ||
            pathname.startsWith('/auth/') ||
            pathname.startsWith('/privacy/') ||
            pathname === '/privacy';
        if (isPublicRoute) return;

        const interval = setInterval(() => {
            lastFetchTime = 0; // Allow the refresh
            fetchSession(true);
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchSession, pathname]);

    const handleLogout = useCallback(() => {
        logoutUser();
        clearAuthCookie();
        setUser(null);
        setWorkspace(null);
        setStage1Complete(false);
        lastFetchTime = 0;
        inFlightPromise = null;
        router.push('/auth/login');
    }, [router]);

    // Computed permissions
    const role = user?.role || 'viewer';
    const authenticated = !!user;
    const canCreateTemplates = stage1Complete && ['owner', 'manager', 'admin'].includes(role);
    const canCreateCampaigns = stage1Complete && ['owner', 'manager', 'admin'].includes(role);
    const canSendMessages = stage1Complete && ['owner', 'manager', 'agent', 'admin'].includes(role);
    const canManageTeam = ['owner', 'manager', 'admin'].includes(role);
    const canViewBilling = ['owner', 'admin'].includes(role);
    const canAccessAdmin = role === 'owner' || role === 'admin';

    const trialDaysLeft = user?.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;
    const isOnTrial = user?.plan === 'trial' || (trialDaysLeft !== null && trialDaysLeft > 0);

    const value: AuthSession = {
        user, workspace, stage1Complete, phoneStatus, phoneNumber, loading, authenticated,
        canCreateTemplates, canCreateCampaigns, canSendMessages, canManageTeam,
        canViewBilling, canAccessAdmin, isOnTrial, trialDaysLeft,
        refetch: fetchSession, logout: handleLogout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthSession {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
