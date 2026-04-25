'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, CheckCircle, AlertCircle, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { requestPasswordReset, resetPassword } from '@/lib/api/auth';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Determine if we are in "Request" mode or "Reset" mode
  const isResetMode = !!token;

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await requestPasswordReset(email);
      setSuccess('If an account exists with this email, you will receive password reset instructions shortly.');
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await resetPassword({ token, password });
      setSuccess('Your password has been reset successfully. You can now log in with your new password.');
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card/80 backdrop-blur-md rounded-xl shadow-premium border border-border p-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
            {isResetMode ? <KeyRound className="h-8 w-8 text-primary" /> : <Mail className="h-8 w-8 text-primary" />}
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {isResetMode ? 'Set New Password' : 'Reset Password'}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {isResetMode 
              ? 'Enter your new password below to regain access to your account.' 
              : "Enter your email address and we'll send you instructions to reset your password."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {success ? (
          <div className="text-center space-y-6">
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex flex-col items-center gap-3 text-primary text-center">
                <CheckCircle className="h-10 w-10 mb-2" />
                <p className="text-sm font-medium leading-relaxed">{success}</p>
              </div>
            </div>
            {!isResetMode && (
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 text-sm text-primary font-semibold hover:text-primary/80 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            )}
          </div>
        ) : (
          <form onSubmit={isResetMode ? handleResetPassword : handleRequestReset} className="space-y-6">
            {!isResetMode ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-11 pr-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-11 pr-4 py-3 bg-secondary/50 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  Processing...
                </>
              ) : (
                <>
                  {isResetMode ? 'Reset Password' : 'Send Reset Link'}
                </>
              )}
            </button>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground font-medium hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </form>
        )}

        <div className="mt-8 p-4 bg-accent/50 border border-accent rounded-lg">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-primary font-bold mr-1">Security:</span> 
            {isResetMode 
              ? 'Make sure your new password is at least 6 characters long and includes a mix of characters.' 
              : "We'll never share your email with anyone else. Password reset links expire after a short time."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
