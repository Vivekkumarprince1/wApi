"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const fetchSession = useAuthStore(state => state.fetchSession);

  useEffect(() => {
    let cancelled = false;

    const finishGoogleSignIn = async () => {
      try {
        // fetchSession(true) will hit /auth/session, which succeeds if the cookie is set
        const session = await fetchSession(true);
        if (cancelled) return;

        if (!session || !session.authenticated) {
          router.replace('/auth/login');
          return;
        }

        router.replace(session.nextStep || '/dashboard');
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
