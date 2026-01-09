"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import Sidebar from '@/components/Sidebar';
import { getAllWorkspaces, getAdminAnalytics, getWABAHealth, getCurrentUser } from '@/lib/api';

const AdminDashboard = () => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data states
  const [workspaces, setWorkspaces] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [wabaHealth, setWabaHealth] = useState([]);
  const [error, setError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated and is admin
    const token = localStorage.getItem('token');
    
    if (!token) {
      router.push('/auth/login');
      return;
    }

    setIsAuthenticated(true);
    
    // Check user role
    const checkAdminAccess = async () => {
      try {
        const user = await getCurrentUser();
        
        // Check if user is admin
        if (user?.role !== 'admin') {
          setError('❌ You do not have permission to access the admin dashboard');
          setLoading(false);
          setTimeout(() => router.push('/dashboard'), 3000);
          return;
        }
        
        setIsAdmin(true);
        
        // Fetch dashboard data
        try {
          const workspacesRes = await getAllWorkspaces({ limit: 50 });
          setWorkspaces(workspacesRes.data || []);
          
          const analyticsRes = await getAdminAnalytics();
          setAnalytics(analyticsRes.data || {});
          
          const wabaRes = await getWABAHealth();
          setWabaHealth(wabaRes.data || []);
          
          setLoading(false);
          setStatsLoading(false);
        } catch (err) {
          console.error('Error fetching dashboard data:', err);
          setError(err.message);
          setLoading(false);
          setStatsLoading(false);
        }
      } catch (err) {
        console.error('Error checking admin access:', err);
        setError('❌ Unauthorized access - admin role required');
        setLoading(false);
        setTimeout(() => router.push('/dashboard'), 3000);
      }
    };

    checkAdminAccess();
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

  // Show error if not admin
  if (error && !isAdmin) {
    return (
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} currentPath="/admin" />
        <div className="flex-1 flex flex-col lg:ml-16">
          <main className="flex-1 overflow-auto flex items-center justify-center p-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg p-8 text-center max-w-md">
              <div className="text-5xl mb-4">🔒</div>
              <h1 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-2">Access Denied</h1>
              <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
              <p className="text-sm text-red-600 dark:text-red-400">Redirecting to dashboard...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} currentPath="/admin" />
      
      <div className="flex-1 flex flex-col lg:ml-16">
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">⚙️</span>
                  <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Admin Dashboard</h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage all tenants, monitor WABA health, and view platform analytics
                </p>
              </div>

              {error && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg p-4 mb-6">
                  <p className="text-red-800 dark:text-red-200">Error: {error}</p>
                </div>
              )}

              {/* Tabs */}
              <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-8">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`pb-4 font-medium transition-colors ${
                      activeTab === 'overview'
                        ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
                    }`}
                  >
                    📊 Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('workspaces')}
                    className={`pb-4 font-medium transition-colors ${
                      activeTab === 'workspaces'
                        ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
                    }`}
                  >
                    🏢 Workspaces
                  </button>
                  <button
                    onClick={() => setActiveTab('waba')}
                    className={`pb-4 font-medium transition-colors ${
                      activeTab === 'waba'
                        ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
                    }`}
                  >
                    📱 WABA Health
                  </button>
                </div>
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div>
                  {statsLoading ? (
                    <div className="flex justify-center py-12">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/50 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                          <div className="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Workspaces</div>
                          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                            {analytics?.overview?.totalWorkspaces || 0}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/50 rounded-lg p-6 border border-green-200 dark:border-green-800">
                          <div className="text-green-600 dark:text-green-400 text-sm font-medium">Active Workspaces</div>
                          <div className="text-3xl font-bold text-green-900 dark:text-green-100 mt-2">
                            {analytics?.overview?.activeWorkspaces || 0}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/50 rounded-lg p-6 border border-orange-200 dark:border-orange-800">
                          <div className="text-orange-600 dark:text-orange-400 text-sm font-medium">Suspension Rate</div>
                          <div className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-2">
                            {analytics?.overview?.suspension_rate || '0%'}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/50 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                          <div className="text-purple-600 dark:text-purple-400 text-sm font-medium">Plan Distribution</div>
                          <div className="text-sm font-medium text-purple-900 dark:text-purple-100 mt-2">
                            <div>Free: {analytics?.plans?.free || 0}</div>
                            <div>Premium: {analytics?.plans?.premium || 0}</div>
                          </div>
                        </div>
                      </div>

                      {/* Verification Status */}
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Verification Status</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {Object.entries(analytics?.verification || {}).map(([status, count]) => (
                            <div key={status} className="bg-white dark:bg-gray-600 rounded p-4 text-center">
                              <div className="text-sm text-gray-600 dark:text-gray-300 capitalize">{status}</div>
                              <div className="text-2xl font-bold text-gray-800 dark:text-white mt-2">{count}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* WABA Status Distribution */}
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">WABA Status Distribution</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          {Object.entries(analytics?.wabaStatus || {}).map(([status, count]) => (
                            <div key={status} className="bg-white dark:bg-gray-600 rounded p-4 text-center">
                              <div className="text-sm text-gray-600 dark:text-gray-300 capitalize">{status.replace(/_/g, ' ')}</div>
                              <div className="text-2xl font-bold text-gray-800 dark:text-white mt-2">{count}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Workspaces Tab */}
              {activeTab === 'workspaces' && (
                <div>
                  {statsLoading ? (
                    <div className="flex justify-center py-12">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Workspace</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Owner</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Plan</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">WABA Status</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Verification</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Members</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Created</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workspaces.map((workspace) => (
                            <tr key={workspace.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="py-3 px-4">
                                <div className="font-medium text-gray-800 dark:text-white">{workspace.name}</div>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                {workspace.owner?.name || 'N/A'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
                                  {workspace.plan}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  workspace.wabaStatus === 'completed'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                                }`}>
                                  {workspace.wabaStatus}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  workspace.verificationStatus === 'verified'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}>
                                  {workspace.verificationStatus}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                {workspace.memberCount}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                {new Date(workspace.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  onClick={() => router.push(`/admin/workspaces/${workspace.id}`)}
                                  className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 text-sm font-medium"
                                >
                                  View Details →
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {workspaces.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          No workspaces found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* WABA Health Tab */}
              {activeTab === 'waba' && (
                <div>
                  {statsLoading ? (
                    <div className="flex justify-center py-12">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {wabaHealth.map((waba) => (
                        <div key={waba.workspaceId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-gray-800 dark:text-white">{waba.workspaceName}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                📱 {waba.phoneNumber}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              waba.accountStatus === 'ACTIVE'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : waba.accountStatus === 'DISABLED'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                            }`}>
                              {waba.accountStatus}
                            </span>
                          </div>
                          {waba.blocked && (
                            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                              🔒 Blocked: {waba.blockReason}
                            </div>
                          )}
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Last checked: {waba.lastCheckedAt ? new Date(waba.lastCheckedAt).toLocaleString() : 'Never'}
                          </div>
                        </div>
                      ))}
                      {wabaHealth.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          No WABA data available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
