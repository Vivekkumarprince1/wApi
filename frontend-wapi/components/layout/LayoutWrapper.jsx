'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAYOUT WRAPPER — NOW POWERED BY AuthProvider
 * No more independent getCurrentUser() calls. Uses useAuth() context.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Header from './Header';
import Sidebar from './AppSidebar';
import FlashLoader from '@/components/ui/FlashLoader';
import { useAuthStore as useAuth } from '@/store/authStore';
import { loadingStore } from '@/lib/api/loadingStore';
import { cn } from '@/lib/utils';

export default function LayoutWrapper({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, authenticated, loading } = useAuth();

  // Public routes where sidebar/header should NOT be shown
  const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/reset', '/privacy'];
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/auth/') || pathname.startsWith('/privacy/');

  // Email verification enforcement
  const unprotectedRoutes = [...publicRoutes, '/onboarding/verify-email'];
  const requiresEmailVerification = !unprotectedRoutes.some(route =>
    pathname === route || pathname.startsWith(route)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to verify-email if not verified
  useEffect(() => {
    if (loading || isPublicRoute || !mounted) return;
    if (user && !user.emailVerified && requiresEmailVerification && pathname !== '/onboarding/verify-email') {
      router.push('/onboarding/verify-email');
    }
  }, [user, loading, isPublicRoute, requiresEmailVerification, pathname, mounted, router]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [sidebarOpen]);

  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('token');
  const isAuthPage = pathname.startsWith('/auth/');
  const shouldShowSidebar = mounted && authenticated && !isAuthPage;

    // Client-side protection: redirect to login if not authenticated on a protected route
  useEffect(() => {
    if (!mounted || loading) return;
    
    // If not authenticated and not on a public route, go to login
    if (!authenticated && !isPublicRoute) {
      router.push('/auth/login');
    }
  }, [mounted, loading, authenticated, isPublicRoute, router]);

  if (!mounted || (hasToken && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <FlashLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {authenticated && !isAuthPage && (
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      )}

      {/* Sidebar */}
      {shouldShowSidebar && (
        <>
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onSectionChange={() => setSidebarOpen(false)}
            currentPath={pathname}
          />

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 top-[60px] bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </>
      )}

      {/* Main Content */}
      <div className={cn(
        shouldShowSidebar ? 'lg:ml-[72px] pt-[60px] transition-all duration-300' : 'transition-all duration-300',
        "min-h-screen bg-background"
      )}>
        <main className={cn(
          authenticated && !isAuthPage ? "max-w-[1600px] mx-auto w-full p-4 md:p-6 lg:p-8" : ""
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
