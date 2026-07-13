'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getCurrentUser, sendEmailVerificationOTP, verifyEmailOTP } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth-store';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const hasFetched = useRef(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const init = async () => {
      try {
        const session = user ? { user } : await getCurrentUser();
        const currentUser = session?.user || session;
        if (currentUser) {
          setEmail(currentUser.email || '');
          if (currentUser.emailVerified) {
            router.push(session?.nextStep || '/onboarding/verify-mobile');
            return;
          }
          sendOTP();
        } else {
          router.push('/auth/login');
        }
      } catch (err) {
        console.error('Error getting user:', err);
        router.push('/auth/login');
      }
    };

    init();
  }, [router, user]);

  async function sendOTP() {
    try {
      setLoading(true);
      setError('');
      await sendEmailVerificationOTP(email);
      setCountdown(60);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      if (err.message && err.message.includes('60 seconds')) {
        setCountdown(60);
      } else {
        setError(err.message || 'Failed to send OTP');
      }
    } finally {
      setLoading(false);
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Code must be 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await verifyEmailOTP(otp);
      router.push(result?.nextStep || '/onboarding/verify-mobile');
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card/80 backdrop-blur-md rounded-xl shadow-premium border border-border p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 1 of 3</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Verify Email</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: '33%' }}></div>
          </div>
        </div>

        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Verify Your Email
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We've sent a 6-character verification code to
          </p>
          {email && (
            <p className="text-sm text-foreground mt-1 font-semibold">
              {email}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleVerifyOTP} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Verification Code
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6))}
              placeholder="••••••"
              required
              maxLength={6}
              className="w-full px-4 py-4 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-center text-3xl tracking-[0.5em] font-bold outline-none transition-all placeholder:text-muted-foreground/30"
            />
          </div>

          <div className="flex flex-col items-center gap-4">
            {countdown > 0 ? (
              <p className="text-sm text-muted-foreground">
                Resend code in <span className="text-foreground font-medium">{countdown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => sendOTP()}
                disabled={loading}
                className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors disabled:opacity-50"
              >
                Resend verification code
              </button>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Verify & Continue
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 p-4 bg-accent/50 border border-accent rounded-lg">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-primary font-bold mr-1">Tip:</span> 
            Verifying your email helps secure your account and ensures you receive important notifications about your WhatsApp Business account.
          </p>
        </div>
      </div>
    </div>
  );
}
