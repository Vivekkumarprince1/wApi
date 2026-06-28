"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { completeGoogleCallback } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth-store';
import { Loader2, Sparkles } from 'lucide-react';

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fetchSession = useAuthStore((s) => s.fetchSession);
  const [status, setStatus] = useState('Verifying your account...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      toast.error('Google authentication failed');
      router.push('/auth/login');
      return;
    }

    if (!code) {
      router.push('/auth/login');
      return;
    }

    const verifyCallback = async () => {
      try {
        setStatus('Syncing with Google...');
        const response: any = await completeGoogleCallback(code);

        if (response.success) {
          const session = await fetchSession(true);
          setStatus('Authentication successful! Redirecting...');
          toast.success('Successfully logged in with Google');

          const destination = session?.accessRestriction?.targetPath || session?.nextStep || response.accessRestriction?.targetPath || response.nextStep || '/dashboard';
          setTimeout(() => {
            router.replace(destination);
          }, 1500);
        } else {
          throw new Error(response.message || 'Login failed');
        }
      } catch (err: any) {
        console.error('[Google Callback Error]:', err);
        toast.error(err?.response?.data?.message || err.message || 'Failed to authenticate with Google');
        router.push('/auth/login');
      }
    };

    verifyCallback();
  }, [fetchSession, router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="relative">
        {/* Decorative background blur */}
        <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
        
        <div className="relative bg-card border border-border/50 rounded-2xl shadow-premium p-8 max-w-sm w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-bounce">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">Completing Sign-in</h1>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>

          <div className="flex justify-center pt-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}
