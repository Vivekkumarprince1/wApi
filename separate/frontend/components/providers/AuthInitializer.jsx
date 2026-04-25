'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export function AuthInitializer() {
    const pathname = usePathname();
    const router = useRouter();
    const { fetchSession, authenticated, loading, nextStep, user } = useAuthStore();

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
    // STATUS-DRIVEN NAVIGATION GUARD
    // ═══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (loading || !authenticated || !user) return;

        const isPublicRoute = pathname === '/' ||
            pathname.startsWith('/auth/') ||
            pathname.startsWith('/privacy/') ||
            pathname === '/privacy';

        const isAdminRoute = pathname.startsWith('/admin');
        const isAdminUser = user.role === 'admin' || user.role === 'super_admin' || user.role === 'owner';
        const currentPath = pathname.split('?')[0];

        // 1. If user has completed signup, we mostly stop forced navigation
        if (user.accountStatus === 'SIGNUP_COMPLETED') {
            // Only redirect if they are trying to access onboarding pages accidentally
            if (currentPath.startsWith('/onboarding')) {
                router.replace('/dashboard');
            }
            return; // EXIT: No more forced navigation for completed users
        }

        // 2. Admin route bypass (for those still in onboarding status but are admins)
        if (isAdminRoute && isAdminUser) return;

        // 3. Status-driven navigation for users still in onboarding flow
        if (!nextStep) return;
        const targetPath = nextStep.split('?')[0];

        // Keep subpages stable if we are already in the right area
        if (currentPath.startsWith('/dashboard') && targetPath.startsWith('/dashboard')) return;
        if (currentPath.startsWith('/onboarding') && targetPath.startsWith('/onboarding')) return;

        // Forced redirect to the mandatory next step
        if (currentPath !== targetPath) {
            router.replace(targetPath);
        }
    }, [pathname, nextStep, authenticated, user, loading, router]);

    return null;
}
