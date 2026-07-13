"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GoogleLogin from '@/components/auth/google-login';
import FacebookLogin from '@/components/auth/facebook-login';
import { registerUser } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth-store';
import { Mail, Lock, User, ArrowRight, Sparkles, Shield, Zap } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const getAuthCallbackUrl = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('callbackUrl') || params.get('redirectTo');
};

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [showCard, setShowCard] = useState(false);
  const { fetchSession } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setShowCard(true), 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sessionStorage.getItem('socket_auth_token')) return;

    let active = true;
    fetchSession(true).then((session) => {
      if (!active || !session?.authenticated) return;
      const callbackUrl = getAuthCallbackUrl();
      router.replace(callbackUrl || session.accessRestriction?.targetPath || session.nextStep || '/dashboard');
    });

    return () => {
      active = false;
    };
  }, [fetchSession, router]);

  const handleRegisterSuccess = async () => {
    const session = await fetchSession(true);
    const callbackUrl = getAuthCallbackUrl();
    router.replace(callbackUrl || session?.accessRestriction?.targetPath || session?.nextStep || '/onboarding/verify-mobile');
  };

  const onSubmit = async (values: RegisterFormValues) => {
    setError('');
    setSocialError('');
    try {
      await registerUser(values);
      router.push(
        `/auth/register/verify?email=${encodeURIComponent(values.email)}`
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left - Gradient Illustration Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-emerald-600 to-green-700" />
        <div className="absolute top-32 right-16 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-16 left-16 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="text-2xl" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              {process.env.NEXT_PUBLIC_APP_NAME || 'wApi'}
            </span>
          </div>

          <h2 className="text-4xl font-bold leading-tight mb-4">
            Start your journey<br />
            with <span className="text-emerald-300">WhatsApp Business</span>
          </h2>
          <p className="text-lg text-white/70 max-w-md mb-8">
            Join thousands of businesses using our platform to connect, engage, and grow with WhatsApp.
          </p>

          <div className="space-y-4">
            {[
              { icon: Sparkles, text: 'Free trial with all features' },
              { icon: Zap, text: 'Set up in minutes' },
              { icon: Shield, text: 'Enterprise-grade security' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-400/20 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-emerald-300" />
                </div>
                <span className="text-white/80 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Register Form */}
      <div className="flex-1 flex flex-col">
        <header className="w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between max-w-lg mx-auto px-6 py-4 w-full">
             <Link href="/" className="font-bold text-base tracking-tight text-foreground lg:hidden">
               {process.env.NEXT_PUBLIC_APP_NAME || 'wApi'}
            </Link>
            <div className="text-sm text-muted-foreground ml-auto">
              <span className="hidden sm:inline">Already on {process.env.NEXT_PUBLIC_APP_NAME || 'wApi'}?</span>
              <Link href="/auth/login" className="ml-2 font-semibold text-primary hover:text-primary/80 transition-colors">
                Sign In
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
                <h1 className="text-2xl font-bold text-foreground mb-2">Create your account</h1>
                <p className="text-sm text-muted-foreground">Get started with your free trial today</p>
              </div>

              <div className="space-y-3 mb-6">
                <GoogleLogin
                  onError={(msg: string) => setSocialError(msg)}
                  onSuccess={handleRegisterSuccess}
                />
                <FacebookLogin
                  onError={(msg: string) => setSocialError(msg)}
                  onSuccess={handleRegisterSuccess}
                />
              </div>

              <div className="flex items-center gap-4 my-6">
                <span className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">or</span>
                <span className="flex-1 h-px bg-border" />
              </div>

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

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
                <div className="space-y-1 relative">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="name"
                      type="text"
                      {...register('name')}
                      className={`w-full h-12 bg-background border border-border rounded-xl pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${errors.name ? 'border-destructive' : ''}`}
                      placeholder="Full Name"
                    />
                  </div>
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-1 relative">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      {...register('email')}
                      className={`w-full h-12 bg-background border border-border rounded-xl pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${errors.email ? 'border-destructive' : ''}`}
                      placeholder="Email Address"
                    />
                  </div>
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>

                <div className="space-y-1 relative">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="password"
                      type="password"
                      {...register('password')}
                      className={`w-full h-12 bg-background border border-border rounded-xl pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${errors.password ? 'border-destructive' : ''}`}
                      placeholder="Password"
                    />
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 group disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-xs text-muted-foreground text-center">
                By continuing you agree to our{' '}
                <Link href="/terms" className="font-medium text-foreground hover:text-primary transition-colors">Terms of Service</Link> and{' '}
                <Link href="/privacy" className="font-medium text-foreground hover:text-primary transition-colors">Privacy Policy</Link>.
              </p>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/auth/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
