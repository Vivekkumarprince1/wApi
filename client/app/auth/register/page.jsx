"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GoogleLogin from '@/components/GoogleLogin';
import FacebookLogin from '@/components/FacebookLogin';
import { registerUser } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCard(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSocialError('');
    setLoading(true);

    try {
      const data = await registerUser(formData);
      if (data?.token) {
        localStorage.setItem('token', data.token);
        window.dispatchEvent(new Event('authChange'));
      }
      router.push('/onboarding/verify-email'); // Redirect to email verification after registration
    } catch (err) {
      setError(err.message || 'Registration failed');
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
    router.push('/dashboard');
  };

  const handleFacebookSuccess = (result) => {
    if (result?.token) {
      localStorage.setItem('token', result.token);
      window.dispatchEvent(new Event('authChange'));
    }
    setSocialError('');
    router.push('/onboarding/esb');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col text-gray-900">
      <header className="w-full border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between max-w-5xl mx-auto px-6 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 relative">
              <Image src="/interact-logo.png" alt={process.env.NEXT_PUBLIC_APP_DOMAIN || 'interakt.shop'} fill sizes="40px" className="object-contain" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-gray-900 uppercase group-hover:text-green-700 transition-colors">
              {process.env.NEXT_PUBLIC_APP_DOMAIN || 'interakt.shop'}
            </span>
          </Link>
          <div className="text-sm text-gray-700">
            <span>Already on {process.env.NEXT_PUBLIC_APP_NAME || 'Interakt'}?</span>
            <Link href="/auth/login" className="ml-2 font-semibold text-green-700 hover:text-green-800">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start md:items-center justify-center px-4 py-12 bg-white">
        <div className="w-full max-w-lg">
          <div
            className={`bg-white border border-gray-200 rounded-[40px] shadow-[0_25px_60px_rgba(15,23,42,0.08)] px-6 sm:px-12 py-14 text-center transition-all duration-500 ${
              showCard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <h1 className="text-3xl font-semibold tracking-[0.3rem] text-gray-900 uppercase mb-10">Sign Up</h1>

            <div className="space-y-4 mb-6">
              <GoogleLogin
                formType="signup"
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

            <div className="flex items-center gap-4 text-gray-400 text-xs font-semibold tracking-[0.2rem] uppercase my-8">
              <span className="flex-1 h-px bg-gray-200" />
              <span>Or, create account with email</span>
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
                <label htmlFor="name" className="sr-only">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-[18px] bg-[#cfd4e1] border border-transparent px-5 py-3 text-gray-900 placeholder-gray-600 font-medium focus:border-gray-900 focus:ring-2 focus:ring-gray-900 transition"
                  placeholder="Full Name"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="sr-only">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-[18px] bg-[#cfd4e1] border border-transparent px-5 py-3 text-gray-900 placeholder-gray-600 font-medium focus:border-gray-900 focus:ring-2 focus:ring-gray-900 transition"
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
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full rounded-[18px] bg-[#cfd4e1] border border-transparent px-5 py-3 text-gray-900 placeholder-gray-600 font-medium focus:border-gray-900 focus:ring-2 focus:ring-gray-900 transition"
                  placeholder="Password"
                  minLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[18px] bg-green-700 py-3 text-white font-semibold text-lg tracking-wide hover:bg-green-800 transition disabled:opacity-70"
              >
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>
            </form>

            <p className="mt-6 text-xs text-gray-500">
              By continuing you agree to our{' '}
              <span className="font-semibold text-gray-800">Terms of Service</span> and{' '}
              <span className="font-semibold text-gray-800">Privacy Policy</span>.
            </p>

            <div className="mt-4 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <a 
                  href="/auth/login" 
                  className="text-blue-500 hover:text-blue-700 font-semibold"
                >
                  Login here
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}