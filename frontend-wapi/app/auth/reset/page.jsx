"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestPasswordReset, resetPassword } from "@/lib/api";
import { Mail, KeyRound, ArrowRight, ArrowLeft, RefreshCw, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setStatus({
        type: "success",
        message: "Reset code sent to your email. Please check your inbox.",
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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }
    
    setStatus({ type: "", message: "" });
    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setStatus({
        type: "success",
        message: "Password reset successful! Redirecting to login...",
      });
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Invalid or expired reset code.",
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

        {step === 1 && (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Enter the email associated with your account and we&apos;ll send you a
              reset code to get back in.
            </p>
            <form className="space-y-4" onSubmit={handleRequestReset}>
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
                    <span>Send Reset Code</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {step === 2 && (status.type !== 'success' || !status.message.includes('Redirecting')) && (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Enter the reset code sent to <span className="font-semibold text-foreground">{email}</span> and your new password.
            </p>
            <form className="space-y-4" onSubmit={handleResetPassword}>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="Reset Code"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="input-premium pl-11"
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-premium pl-11"
                  minLength={6}
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-premium pl-11"
                  minLength={6}
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
                    <span>Reset Password</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors flex items-center justify-center gap-1.5 mx-auto"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Change email or resend code
                </button>
              </div>
            </form>
          </>
        )}

        <div className="text-center pt-2">
          <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
