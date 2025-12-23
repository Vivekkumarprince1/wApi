"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GoogleLogin from '@/components/GoogleLogin';
import FacebookLogin from '@/components/FacebookLogin';
import { loginUser } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);

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
        window.dispatchEvent(new Event('authChange'));
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSuccess = (result) => {
    if (result?.token) {
      localStorage.setItem('token', result.token);
      window.dispatchEvent(new Event('authChange'));
    }
    setSocialError('');
    router.push('/esb');
  };

  const handleFacebookSuccess = (result) => {
    if (result?.token) {
      localStorage.setItem('token', result.token);
      window.dispatchEvent(new Event('authChange'));
    }
    setSocialError('');
    router.push('/esb');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col text-gray-900">
      <header className="w-full border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between max-w-5xl mx-auto px-6 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 relative">
              <Image src="/interact-logo.png" alt="interakt.shop" fill sizes="40px" className="object-contain" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-gray-900 uppercase group-hover:text-green-700 transition-colors">
              interakt.shop
            </span>
          </Link>
          <div className="text-sm text-gray-700">
            <span>Not on Interakt?</span>
            <Link href="/auth/register" className="ml-2 font-semibold text-green-700 hover:text-green-800">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start md:items-center justify-center px-4 py-12 bg-white">
        <div className="w-full max-w-md">
          <div
            className={`bg-white border border-gray-200 rounded-[36px] shadow-[0_18px_45px_rgba(15,23,42,0.08)] px-6 sm:px-10 py-12 text-center transition-all duration-500 ${
              showCard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <h1 className="text-[32px] font-semibold tracking-[0.25rem] text-gray-900 uppercase mb-10">Sign in</h1>

            <div className="space-y-4 mb-6">
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

            <div className="flex items-center gap-4 text-gray-400 text-xs font-semibold tracking-[0.2rem] uppercase my-9">
              <span className="flex-1 h-px bg-gray-200" />
              <span>Or, sign in with email</span>
              <span className="flex-1 h-px bg-gray-200" />
            </div>

            {socialError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-left">
                {socialError}
              </div>
            )}

            {error && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-left">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-3 text-gray-900 placeholder-gray-500 font-medium focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                  placeholder="Email Address"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-3 text-gray-900 placeholder-gray-500 font-medium focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                  placeholder="Password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-green-700 py-3 text-white font-semibold text-lg tracking-wide hover:bg-green-800 transition disabled:opacity-70"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 text-left text-sm text-gray-600 space-y-1">
              <p className="font-semibold text-gray-800">Forgot password?</p>
              <p>Your password was emailed to you when the account was created.</p>
              <Link href="/auth/reset" className="text-gray-900 font-semibold underline">
                Click here to reset
              </Link>
            </div>

            <div className="mt-4 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <a 
                  href="/auth/register" 
                  className="text-blue-500 hover:text-blue-700 font-semibold"
                >
                  Register here
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}