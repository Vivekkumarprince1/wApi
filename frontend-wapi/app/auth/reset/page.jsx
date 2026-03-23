"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendLoginOTP, verifyLoginOTP } from "@/lib/api";
import { Mail, KeyRound, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });
    setLoading(true);
    try {
      await sendLoginOTP({ email });
      setStatus({
        type: "success",
        message: "OTP sent to your email. Please check your console/email.",
      });
      setStep(2);
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Unable to send reset code.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });
    setLoading(true);
    try {
      const result = await verifyLoginOTP({ email, otp });
      if (result.token) {
        localStorage.setItem('token', result.token);
        document.cookie = `auth_token=${result.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        window.dispatchEvent(new Event('authChange'));
        setStatus({
          type: "success",
          message: "Password reset successful! Redirecting to dashboard...",
        });
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Invalid or expired OTP.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-premium p-8 space-y-6 animate-fade-in-up">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
        </div>

        {step === 1 && (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Enter the email associated with your account and we&apos;ll send you a
              one-time code to get back in.
            </p>
            {status.message && (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${status.type === "success"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-destructive/5 text-destructive border border-destructive/20"
                  }`}
              >
                {status.message}
              </div>
            )}
            <form className="space-y-4" onSubmit={handleSendOTP}>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-premium pl-11"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Send reset code</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Enter the 6-digit code sent to <span className="font-semibold text-foreground">{email}</span>
            </p>
            <div className="text-center">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                Change email
              </button>
            </div>
            {status.message && (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${status.type === "success"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-destructive/5 text-destructive border border-destructive/20"
                  }`}
              >
                {status.message}
              </div>
            )}
            <form className="space-y-4" onSubmit={handleVerifyOTP}>
              <input
                type="text"
                required
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="input-premium text-center text-2xl font-semibold tracking-[0.5em] placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
              />
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify & Login</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus({ type: "", message: "" });
                  setLoading(false);
                  handleSendOTP({ preventDefault: () => { } });
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Resend code
              </button>
            </form>
          </>
        )}

        <div className="text-center">
          <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
