"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getOnboardingStatus } from '@/lib/api';

const getOnboardingPath = (onboarding) => {
  if (!onboarding?.status?.steps?.phoneVerified) {
    return '/onboarding/verify-mobile';
  }

  if (!onboarding?.status?.steps?.businessInfo) {
    return '/onboarding/business-info';
  }

  return '/dashboard';
};

export default function GoogleCallbackPage() {
  const router = useRouter();
  const fetchSession = useAuthStore(state => state.fetchSession);

  useEffect(() => {
    let cancelled = false;

    const finishGoogleSignIn = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || localStorage.getItem('token');

      if (!token) {
        router.replace('/auth/login');
        return;
      }

      localStorage.setItem('token', token);
      document.cookie = `auth_token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      window.dispatchEvent(new Event('authChange'));

      try {
        await fetchSession(true);
        if (cancelled) return;

        const cleanUrl = window.location.origin + '/auth/google/callback';
        window.history.replaceState({}, document.title, cleanUrl);

        const onboarding = await getOnboardingStatus().catch(() => null);
        router.replace(getOnboardingPath(onboarding));
      } catch (error) {
        console.error('Google callback session refresh failed:', error);
        if (!cancelled) {
          router.replace('/auth/login');
        }
      }
    };

    finishGoogleSignIn();

    return () => {
      cancelled = true;
    };
  }, [fetchSession, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Signing you in…</h2>
        <p className="text-sm text-muted-foreground mt-2">Finishing Google sign-in, please wait...</p>
      </div>
    </div>
  );
}
