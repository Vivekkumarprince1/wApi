"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/esb');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center space-y-3">
        <p className="text-sm text-slate-600">Email/password login has been retired.</p>
        <p className="text-base font-semibold text-slate-900">Use the new automated ESB signup instead.</p>
        <button
          onClick={() => router.push('/esb')}
          className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
        >
          Go to Embedded Signup
        </button>
      </div>
    </div>
  );
}