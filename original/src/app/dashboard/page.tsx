import { Suspense } from 'react';
import DashboardPageClient from './dashboard-page-client';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin" /></div>}>
      <DashboardPageClient />
    </Suspense>
  );
}
