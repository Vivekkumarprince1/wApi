'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { verifySignupOtp } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth-store';

function RegisterVerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';
  const { fetchSession } = useAuthStore();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Missing email. Go back to registration.');
      return;
    }
    if (otp.length < 4) {
      setError('Enter the code from your email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await verifySignupOtp(email, otp);
      const session = await fetchSession(true);
      router.push(
        session?.accessRestriction?.targetPath || session?.nextStep || '/onboarding/verify-mobile'
      );
    } catch (err: any) {
      setError(err?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No email provided.</p>
          <Link href="/auth/register" className="text-primary font-semibold">
            Back to sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            Enter the verification code we sent to <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\s/g, ''))}
            placeholder="Verification code"
            className="w-full h-12 rounded-xl border border-border bg-background px-4 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify & continue'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Wrong email?{' '}
          <Link href="/auth/register" className="font-semibold text-primary">
            Start over
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RegisterVerifyInner />
    </Suspense>
  );
}
