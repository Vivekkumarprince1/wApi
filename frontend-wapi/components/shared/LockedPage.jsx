"use client";

import React from 'react';
import { FaLock, FaRocket, FaShieldAlt } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

const LockedPage = ({ 
  title = "Module Locked", 
  description = "This feature is restricted based on your current role or workspace permissions. Upgrade your plan or contact your administrator to gain access.",
  icon: Icon = FaLock,
  requiredPermission,
  requiredRole,
  isUpgradeRequired = true
}) => {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in zoom-in duration-500">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] blur-2xl opacity-20 rounded-full animate-pulse"></div>
        <div className="relative w-24 h-24 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 flex items-center justify-center">
          <Icon className="text-4xl text-[#13C18D]" />
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800">
            <FaLock className="text-white text-xs" />
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
        {title}
      </h1>
      
      <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-10 leading-relaxed">
        {description}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {isUpgradeRequired && (
          <button
            onClick={() => router.push('/dashboard/billing')}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-[#13C18D] to-[#0e8c6c] text-white font-bold rounded-2xl shadow-lg shadow-[#13C18D]/20 hover:scale-105 active:scale-95 transition-all"
          >
            <FaRocket />
            Explore Plans
          </button>
        )}
        
        <button
          onClick={() => router.back()}
          className="px-8 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
        >
          Go Back
        </button>
      </div>

      {(requiredRole || requiredPermission) && (
        <div className="mt-12 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <FaShieldAlt className="text-gray-400" />
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            Required: {requiredRole ? `Role [${requiredRole}]` : `Permission [${requiredPermission}]`}
          </p>
        </div>
      )}
    </div>
  );
};

export default LockedPage;
