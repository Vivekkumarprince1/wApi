'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export function AuthInitializer() {
    const pathname = usePathname();
    const router = useRouter();
    const { fetchSession, authenticated, loading, nextStep } = useAuthStore();

    // Initial fetch and listener setup
    useEffect(() => {
        fetchSession();
        
        const handleAuthChange = () => fetchSession(true);
        window.addEventListener('storage', handleAuthChange);
        window.addEventListener('authChange', handleAuthChange);
        return () => {
            window.removeEventListener('storage', handleAuthChange);
            window.removeEventListener('authChange', handleAuthChange);
        };
    }, [fetchSession]);

    // Background refresh for protected routes
    useEffect(() => {
        const isPublicRoute = pathname === '/' ||
            pathname.startsWith('/auth/') ||
            pathname.startsWith('/privacy/') ||
            pathname === '/privacy';
        
        if (isPublicRoute) return;

        const interval = setInterval(() => {
            fetchSession(true);
        }, 5 * 60 * 1000); // refresh every 5 minutes
        
        return () => clearInterval(interval);
    }, [pathname, fetchSession]);

    // ═══════════════════════════════════════════════════════════════════
    // BACKEND-DRIVEN NAVIGATION LOOPS
    // ═══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (loading || !authenticated || !nextStep) return;

        const isPublicRoute = pathname === '/' ||
            pathname.startsWith('/auth/') ||
            pathname.startsWith('/privacy/') ||
            pathname === '/privacy';

        // Skip redirection logic for public routes (landing, login, etc)
        if (isPublicRoute) return;

        // Strip query params for comparison
        const currentBaseDir = pathname.split('?')[0];
        const nextBaseDir = nextStep.split('?')[0];

        // 1. If we are on an onboarding page but server says go somewhere else
        // 2. If we are on dashboard but server says go back to onboarding
        // 3. If we are on onboarding but server says go to dashboard
        const isOnboarding = pathname.startsWith('/onboarding');
        const isDashboard = pathname.startsWith('/dashboard');

        if (currentBaseDir !== nextBaseDir) {
            if (isOnboarding || isDashboard) {
                console.log(`[AuthRedirect] Backend requested ${nextStep} (currently at ${pathname})`);
                router.push(nextStep);
            }
        }
    }, [pathname, nextStep, authenticated, loading, router]);

    return null;
}
