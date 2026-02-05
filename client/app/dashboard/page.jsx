"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';

const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-emerald-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
    <div className="relative">
      {/* Animated circles */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 border-4 border-[#13C18D]/20 rounded-full animate-ping"></div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#13C18D]/30 rounded-full animate-pulse"></div>
      </div>
      {/* Main spinner */}
      <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-[#13C18D] rounded-full animate-spin"></div>
    </div>
    <div className="mt-6 text-center">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Loading Dashboard</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">Preparing your workspace...</p>
    </div>
    {/* Animated dots */}
    <div className="flex space-x-1.5 mt-4">
      <div className="w-2 h-2 bg-[#13C18D] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 bg-[#13C18D] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 bg-[#13C18D] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  </div>
);

const DashboardPage = () => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('No token found, redirecting to login');
      router.push('/auth/login');
      return;
    }

    console.log('Token found, user authenticated');
    setIsAuthenticated(true);
    // Add a slight delay for smoother transition
    setTimeout(() => setLoading(false), 500);
  }, [router]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <DashboardLayout />;
};

export default DashboardPage;