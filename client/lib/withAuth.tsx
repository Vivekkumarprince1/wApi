"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, isAuthenticated } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

/**
 * Higher-Order Component to protect routes
 * Redirects to login if user is not authenticated
 * 
 * Usage:
 * import withAuth from '@/lib/withAuth';
 * 
 * function DashboardPage() {
 *   return <div>Protected Content</div>;
 * }
 * 
 * export default withAuth(DashboardPage);
 */
export default function withAuth(Component: React.ComponentType<any>) {
  return function ProtectedRoute(props: any) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
      const checkAuth = async () => {
        // Quick check if token exists
        if (!isAuthenticated()) {
          router.push('/auth/login');
          return;
        }

        try {
          // Verify token is valid by fetching user
          const currentUser = await getCurrentUser();
          
          if (!currentUser) {
            router.push('/auth/login');
            return;
          }

          setUser(currentUser);
        } catch (error) {
          console.error('Authentication error:', error);
          router.push('/auth/login');
        } finally {
          setLoading(false);
        }
      };

      checkAuth();
    }, [router]);

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner />
        </div>
      );
    }

    if (!user) {
      return null; // Will redirect to login
    }

    // Pass user data as prop to component
    return <Component {...props} user={user} />;
  };
}
