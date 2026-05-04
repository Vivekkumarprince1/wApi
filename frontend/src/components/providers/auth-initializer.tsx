'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

export function AuthInitializer() {
    const pathname = usePathname();
    const router = useRouter();
    const { fetchSession, authenticated, loading, nextStep, user, accessRestriction } = useAuthStore();

    const isPublicRoute =
        pathname === '/' ||
        pathname.startsWith('/auth/') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/privacy/') ||
        pathname === '/privacy';

    useEffect(() => {
        if (isPublicRoute) return;

        fetchSession();
        
        const handleAuthChange = () => fetchSession(true);
        window.addEventListener('storage', handleAuthChange);
        window.addEventListener('authChange', handleAuthChange);
        return () => {
            window.removeEventListener('storage', handleAuthChange);
            window.removeEventListener('authChange', handleAuthChange);
        };
    }, [fetchSession, isPublicRoute]);

    useEffect(() => {
        if (loading || !authenticated || !user || isPublicRoute) return;

        const isAdminRoute = pathname.startsWith('/super-admin');
        const isAdminUser = user.role === 'super_admin';
        const currentPath = pathname.split('?')[0];
        const targetPath = (accessRestriction?.targetPath || nextStep || '').split('?')[0] || null;

        if (user.accountStatus === 'SIGNUP_COMPLETED') {
            if (currentPath.startsWith('/onboarding') && !targetPath) {
                router.replace('/');
            }
        }

        if (isAdminRoute && isAdminUser) return;

        if (!targetPath) return;

        if (currentPath.startsWith('/') && targetPath.startsWith('/') && currentPath === targetPath) return;
        if (currentPath.startsWith('/onboarding') && targetPath.startsWith('/onboarding') && currentPath === targetPath) return;
        if (currentPath === targetPath) return;

        router.replace(targetPath);
    }, [pathname, nextStep, authenticated, user, accessRestriction, loading, router]);

    return null;
}
