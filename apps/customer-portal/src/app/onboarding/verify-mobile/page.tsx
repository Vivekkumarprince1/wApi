"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { sendMobileVerificationOTP, verifyMobileVerificationOTP } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth-store';

export default function VerifyMobilePage() {
  const router = useRouter();
  const { user, phone: authPhone, fetchSession, loading: authLoading } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const hasSentInitialOTP = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const currentPhone = authPhone?.number || '';
    if (currentPhone) {
      setPhone(currentPhone);
      if (!user.phoneVerified && !hasSentInitialOTP.current) {
        hasSentInitialOTP.current = true;
        sendOTP(currentPhone);
      }
    }
  }, [user, authPhone, authLoading, router]);

  const startCountdown = () => {
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
  };

  async function sendOTP(phoneNumber = phone) {
    if (!phoneNumber) {
      setError('Phone number is required');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      await sendMobileVerificationOTP(phoneNumber);
      setOtpSent(true);
      startCountdown();
    } catch (err: any) {
      if (err.message && err.message.includes('60 seconds')) {
        setOtpSent(true);
        startCountdown();
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
      const result = await verifyMobileVerificationOTP(phone, otp);
      await fetchSession(true);
      router.push(result?.nextStep || '/onboarding/business-info');
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-4xl text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card/80 backdrop-blur-md rounded-xl shadow-premium border border-border p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 2 of 3</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Verify Mobile</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: '66%' }} />
          </div>
        </div>

        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Verify your mobile</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">We will send a one-time code to verify your mobile number before you continue.</p>
          {phone && <p className="text-sm text-foreground mt-1 font-semibold">{phone}</p>}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {!otpSent ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Mobile number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-4 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-center text-xl tracking-wide outline-none transition-all placeholder:text-muted-foreground/30"
              />
              <p className="text-[10px] text-muted-foreground text-center">Include country code (e.g. +91 for India)</p>
            </div>
            <button
              type="button"
              onClick={() => sendOTP(phone)}
              disabled={loading || !phone}
              className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
              Send verification code
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Verification code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="••••••"
                required
                maxLength={6}
                className="w-full px-4 py-4 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-center text-3xl tracking-[0.5em] font-bold outline-none transition-all placeholder:text-muted-foreground/30"
              />
            </div>

            <div className="flex flex-col items-center gap-4">
              {countdown > 0 ? (
                <p className="text-sm text-muted-foreground">Resend code in <span className="text-foreground font-medium">{countdown}s</span></p>
              ) : (
                <div className="flex flex-col w-full gap-2">
                  <button
                      type="button"
                      onClick={() => sendOTP(phone)}
                      disabled={loading}
                      className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors disabled:opacity-50"
                  >
                      Resend code
                  </button>
                  <button
                      type="button"
                      onClick={() => {
                          setOtpSent(false);
                          setOtp('');
                          setCountdown(0);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                  >
                      Change mobile number
                  </button>
                </div>
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
        )}
      </div>
    </div>
  );
}
