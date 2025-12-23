"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GoogleCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.dispatchEvent(new Event('authChange'));
      // Clean up URL without token
      const cleanUrl = window.location.origin + '/auth/google/callback';
      window.history.replaceState({}, document.title, cleanUrl);
      // Redirect to dashboard
      router.push('/dashboard');
    } else {
      // No token: redirect to login
      router.push('/auth/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Signing you in…</h2>
        <p className="text-sm text-gray-600 mt-2">Finishing Google sign-in, please wait...</p>
      </div>
    </div>
  );
}
