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
import AdminSidebar from './AdminSidebar';
import GlobalAlertBanner from './GlobalAlertBanner';
import FlashLoader from '../ui/FlashLoader';
import { useAuthStore } from '@/store/authStore';
import { loadingStore } from '@/lib/api/loadingStore';
import { cn } from '@/lib/utils';

export default function LayoutWrapper({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, authenticated, loading, stage1Complete, phoneStatus, wallet, isOnTrial, trialDaysLeft } = useAuthStore();

  const ACTIVE_PHONE_STATUSES = ['CONNECTED', 'RESTRICTED', 'LIVE', 'ACTIVE', 'VERIFIED'];
  const isWhatsAppConnected = Array.isArray(ACTIVE_PHONE_STATUSES) && stage1Complete || ACTIVE_PHONE_STATUSES.includes(String(phoneStatus || '').toUpperCase());

  const showBanner = authenticated && !pathname.startsWith('/auth/') && (
    !isWhatsAppConnected ||
    (wallet?.balance < (wallet?.thresholdAmount || 500)) ||
    (isOnTrial && trialDaysLeft !== null && trialDaysLeft <= 3)
  );

  const bannerHeight = showBanner ? 48 : 0;

  // Public routes where sidebar/header should NOT be shown
  const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/reset', '/privacy'];
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/auth/') || pathname.startsWith('/privacy/');

  const unprotectedRoutes = [...publicRoutes];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Removed redundant email verification redirection
  // This is now handled by AuthInitializer via nextStep field

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
      {/* Header & Banner Container */}
      {authenticated && !isAuthPage && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <GlobalAlertBanner />
          <div style={{ top: 0 }}>
             <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          </div>
        </div>
      )}

      {/* Sidebar Selection */}
      {shouldShowSidebar && (
        <div style={{ marginTop: `${bannerHeight}px` }}>
          {pathname.startsWith('/admin') ? (
            <AdminSidebar 
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              currentPath={pathname}
            />
          ) : (
            <Sidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              onSectionChange={() => setSidebarOpen(false)}
              currentPath={pathname}
            />
          )}

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
              style={{ top: `${60 + bannerHeight}px` }}
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </div>
      )}

      {/* Main Content */}
      <div 
        className={cn(
          shouldShowSidebar ? 'lg:ml-[72px] transition-all duration-300' : 'transition-all duration-300',
          "min-h-screen bg-background"
        )}
        style={{ paddingTop: `${60 + bannerHeight}px` }}
      >
        <main className={cn(
          authenticated && !isAuthPage ? "max-w-[1600px] mx-auto w-full p-4 md:p-6 lg:p-8" : ""
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
