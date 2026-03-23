'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export function AuthInitializer() {
    const pathname = usePathname();
    const fetchSession = useAuthStore(state => state.fetchSession);

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

    return null;
}
