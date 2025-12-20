"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/esb');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center space-y-3">
        <p className="text-sm text-slate-600">Signup via email/password has been removed.</p>
        <p className="text-base font-semibold text-slate-900">Use Embedded Signup to onboard automatically.</p>
        <button
          onClick={() => router.push('/esb')}
          className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
        >
          Start Embedded Signup
        </button>
      </div>
    </div>
  );
}