"use client";

import { Suspense } from 'react';
import BspOnboarding from '@/components/BspOnboarding';

export const dynamic = 'force-dynamic';

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
    </div>
  );
}

export default function EsbPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BspOnboarding />
    </Suspense>
  );
}
