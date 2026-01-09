"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import Sidebar from '@/components/Sidebar';
import { getIntegrations } from '@/lib/api';

const IntegrationsPage = () => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [integrations, setIntegrations] = useState([]);
  const [error, setError] = useState(null);

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
    
    // Fetch integrations
    const fetchIntegrations = async () => {
      try {
        const response = await getIntegrations();
        setIntegrations(response.data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching integrations:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchIntegrations();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} currentPath="/integrations" />
        
        <div className="flex-1 flex flex-col lg:ml-16">
          <main className="flex-1 overflow-auto">
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-8">
                <h1 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-4">Error Loading Integrations</h1>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} currentPath="/integrations" />
      
      <div className="flex-1 flex flex-col lg:ml-16">
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">🔌</div>
                  <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Integrations</h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {integrations.length > 0 ? `Connected with ${integrations.length} integration(s)` : 'Connect your favorite apps and tools to enhance your WhatsApp business capabilities.'}
                </p>
              </div>

              {integrations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No integrations configured yet</p>
                  <button className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors">
                    + Add Integration
                  </button>
                </div>
              ) : (
                <>
                  {/* Integration Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {integrations.map((integration) => (
                      <div
                        key={integration._id || integration.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow duration-300"
                      >
                        {/* Name and Description */}
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                          {integration.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {integration.description || 'No description available'}
                        </p>

                        {/* Type and Status */}
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                            {integration.type || 'Custom'}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              integration.status === 'connected'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}
                          >
                            {integration.status === 'connected' ? '✓ Connected' : 'Available'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Info Section */}
              <div className="mt-12 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1">🧩</div>
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                      Need More Integrations?
                    </h3>
                    <p className="text-blue-800 dark:text-blue-300 text-sm">
                      We're constantly adding new integrations. Contact our support team to request integration for your favorite tool.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default IntegrationsPage;
