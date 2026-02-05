'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAYOUT WRAPPER WITH EMAIL VERIFICATION GUARD
 * Enforces email verification before accessing any protected routes
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Header from './Header';
import Sidebar from './Sidebar';
import { getCurrentUser } from '@/lib/api';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [showHeader, setShowHeader] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true); // Assume true until proven false
  const pathname = usePathname();
  const router = useRouter();
  
  // Define routes where sidebar should NOT be shown (landing/public pages)
  const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/reset', '/privacy'];
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/auth/');

  // Routes that don't require email verification
  const unprotectedRoutes = [...publicRoutes, '/onboarding/verify-email'];
  const requiresEmailVerification = !unprotectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  );

  // Set mounted state to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    if (!mounted) return;
    
    // Show header only if user is logged in
    const token = localStorage.getItem('token');
    setShowHeader(!!token);

    // CRITICAL: Email verification guard
    const checkEmailVerification = async () => {
      if (!token || isPublicRoute || pathname === '/onboarding/verify-email') {
        return;
      }

      try {
        const user = await getCurrentUser();
        if (user && !user.emailVerified && requiresEmailVerification) {
          // Block access - redirect to email verification
          router.push('/onboarding/verify-email');
          return;
        }
        setEmailVerified(user?.emailVerified || false);
      } catch (err) {
        console.error('Email verification check failed:', err);
      }
    };

    checkEmailVerification();
    
    // Listen for storage changes and custom auth changes to update header visibility
    const handleAuthChange = () => {
      const token = localStorage.getItem('token');
      setShowHeader(!!token);
      checkEmailVerification();
    };
    
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('authChange', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('authChange', handleAuthChange);
    };
  }, [mounted, pathname, isPublicRoute, requiresEmailVerification, router]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  const handleSectionChange = (section: string) => {
    setSidebarOpen(false);
  };
  
  // Only show sidebar if logged in AND not on a public route
  const shouldShowSidebar = mounted && showHeader && !isPublicRoute;
  
  // Don't render header/sidebar until mounted to prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }
  
  return (
    <>
      {showHeader && !isPublicRoute && <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
      {shouldShowSidebar && (
        <>
          <Sidebar 
            isOpen={sidebarOpen} 
            onClose={() => setSidebarOpen(false)}
            onSectionChange={handleSectionChange}
            currentPath={pathname}
          />
          
          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 top-[60px] bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </>
      )}
      <div className={shouldShowSidebar ? 'lg:ml-20' : ''}>
        {children}
      </div>
    </>
  );
}
