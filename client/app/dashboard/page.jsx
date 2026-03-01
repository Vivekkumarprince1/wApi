"use client"

import dynamic from 'next/dynamic';

// Code-split the heavy dashboard component
const HomeDashboard = dynamic(
  () => import('@/components/dashboard/HomeDashboard'),
  {
    loading: () => (
      <div className="animate-fade-in-up p-6 space-y-6">
        {/* Skeleton hero */}
        <div className="skeleton h-44 rounded-2xl" />
        {/* Skeleton stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
        {/* Skeleton content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="skeleton h-48 rounded-2xl" />
            <div className="skeleton h-40 rounded-2xl" />
          </div>
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </div>
    ),
    ssr: false,
  }
);

// Middleware already protects this route — no client-side auth check needed
const DashboardPage = () => <HomeDashboard />;

export default DashboardPage;

