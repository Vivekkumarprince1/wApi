"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GoogleLogin from '@/components/GoogleLogin';
import FacebookLogin from '@/components/FacebookLogin';
import { loginUser, getOnboardingStatus } from '@/lib/api';
import { FaWhatsapp } from 'react-icons/fa';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const redirectAfterLogin = async (emailVerified) => {
    if (!emailVerified) {
      router.push('/onboarding/verify-email');
      return;
    }

    try {
      const onboarding = await getOnboardingStatus();
      const businessInfoDone = onboarding?.status?.steps?.businessInfo === true;

      if (!businessInfoDone) {
        router.push('/dashboard/settings/whatsapp-profile');
        return;
      }
    } catch (_error) {
      // If status check fails, continue to dashboard as safe fallback
    }

    router.push('/dashboard');
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowCard(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSocialError('');
    setLoading(true);

    try {
      const data = await loginUser({ email, password });
      if (data?.token) {
        localStorage.setItem('token', data.token);
        document.cookie = `auth_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
        window.dispatchEvent(new Event('authChange'));
      }

      // Use login response data
      const user = data?.user || data;
      await redirectAfterLogin(user?.emailVerified !== false);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSuccess = async (result) => {
    if (result?.token) {
      localStorage.setItem('token', result.token);
      document.cookie = `auth_token=${result.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      window.dispatchEvent(new Event('authChange'));
    }
    setSocialError('');

    // Use result data
    const user = result?.user || result;
    await redirectAfterLogin(user?.emailVerified !== false);
  };

  const handleFacebookSuccess = async (result) => {
    if (result?.token) {
      localStorage.setItem('token', result.token);
      document.cookie = `auth_token=${result.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      window.dispatchEvent(new Event('authChange'));
    }
    setSocialError('');

    // Use result data
    const user = result?.user || result;
    await redirectAfterLogin(user?.emailVerified !== false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left - Gradient Illustration Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <FaWhatsapp className="text-2xl" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}
            </span>
          </div>

          <h2 className="text-4xl font-bold leading-tight mb-4">
            Power your business<br />
            with <span className="text-emerald-300">WhatsApp</span>
          </h2>
          <p className="text-lg text-white/70 max-w-md mb-8">
            Automate conversations, manage campaigns, and grow your customer relationships — all from one platform.
          </p>

          <div className="space-y-4">
            {[
              'Automated messaging & campaigns',
              'Team inbox for collaboration',
              'CRM & contact management',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-400/20 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                </div>
                <span className="text-white/80 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between max-w-lg mx-auto px-6 py-4 w-full">
            <Link href="/" className="flex items-center gap-2.5 group lg:hidden">
              <div className="h-9 w-9 relative">
                <Image src="/interact-logo.png" alt={process.env.NEXT_PUBLIC_APP_DOMAIN || ''} fill sizes="36px" className="object-contain" />
              </div>
              <span className="font-bold text-base tracking-tight text-foreground uppercase group-hover:text-primary transition-colors">
                {process.env.NEXT_PUBLIC_APP_DOMAIN}
              </span>
            </Link>
            <div className="text-sm text-muted-foreground ml-auto">
              <span className="hidden sm:inline">Not on {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}?</span>
              <Link href="/auth/register" className="ml-2 font-semibold text-primary hover:text-primary/80 transition-colors">
                Sign Up
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            <div
              className={`bg-card border border-border/50 rounded-2xl shadow-premium px-6 sm:px-10 py-10 transition-all duration-500 ${showCard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">Welcome back</h1>
                <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
              </div>

              {/* Social Login */}
              <div className="space-y-3 mb-6">
                <GoogleLogin
                  formType="login"
                  autoRedirect={false}
                  onError={(msg) => setSocialError(msg)}
                  onSuccess={handleSocialSuccess}
                />
                <FacebookLogin
                  autoRedirect={false}
                  onError={(msg) => setSocialError(msg)}
                  onSuccess={handleFacebookSuccess}
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <span className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">or</span>
                <span className="flex-1 h-px bg-border" />
              </div>

              {/* Error Messages */}
              {socialError && (
                <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive text-left">
                  {socialError}
                </div>
              )}
              {error && (
                <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive text-left">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-premium pl-11"
                    placeholder="Email Address"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-premium pl-11"
                    placeholder="Password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 group"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Footer Links */}
              <div className="mt-6 space-y-2">
                <div className="text-sm text-muted-foreground">
                  <Link href="/auth/reset" className="font-medium text-foreground hover:text-primary transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <Link href="/auth/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                    Register here
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}