'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { isPublicCustomerRoute } from '@/lib/public-routes';

export function AuthInitializer() {
    const pathname = usePathname();
    const router = useRouter();
    const { fetchSession, authenticated, loading, nextStep, user, accessRestriction } = useAuthStore();
    const isPublicRoute = isPublicCustomerRoute(pathname);

    useEffect(() => {
        if (isPublicRoute) return;

        let active = true;

        const redirectToLogin = () => {
            if (!active || typeof window === 'undefined') return;
            const callbackUrl = `${window.location.pathname}${window.location.search}`;
            router.replace(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl || '/')}`);
        };

        const loadSession = async (force = false) => {
            const session = await fetchSession(force);
            if (!session?.authenticated) {
                redirectToLogin();
            }
        };

        loadSession();
        
        const handleAuthChange = () => {
            loadSession(true);
        };
        window.addEventListener('storage', handleAuthChange);
        window.addEventListener('authChange', handleAuthChange);
        return () => {
            active = false;
            window.removeEventListener('storage', handleAuthChange);
            window.removeEventListener('authChange', handleAuthChange);
        };
    }, [fetchSession, isPublicRoute, router]);

    useEffect(() => {
        if (loading || !authenticated || !user || isPublicRoute) return;

        const currentPath = pathname.split('?')[0];
        const targetPath = (accessRestriction?.targetPath || nextStep || '').split('?')[0] || null;

        if (user.accountStatus === 'SIGNUP_COMPLETED') {
            if (currentPath.startsWith('/onboarding') && !targetPath) {
                router.replace('/');
            }
        }

        if (!targetPath) return;

        if (currentPath.startsWith('/') && targetPath.startsWith('/') && currentPath === targetPath) return;
        if (currentPath.startsWith('/onboarding') && targetPath.startsWith('/onboarding') && currentPath === targetPath) return;
        if (currentPath.startsWith('/dashboard') && targetPath === '/dashboard') return;
        if (currentPath === targetPath) return;

        router.replace(targetPath);
    }, [pathname, nextStep, authenticated, user, accessRestriction, loading, router]);

    return null;
}
