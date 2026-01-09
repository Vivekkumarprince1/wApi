"use client"

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import Sidebar from '@/components/Sidebar';
import { getWorkspaceDetails, suspendWorkspace, resumeWorkspace, getCurrentUser } from '@/lib/api';

const WorkspaceDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId;
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    setIsAuthenticated(true);
    
    const checkAdminAndFetchWorkspace = async () => {
      try {
        // Check if user is admin
        const user = await getCurrentUser();
        if (user?.role !== 'admin') {
          setError('❌ You do not have permission to access admin features');
          setLoading(false);
          setTimeout(() => router.push('/dashboard'), 3000);
          return;
        }
        
        setIsAdmin(true);
        
        // Fetch workspace details
        const res = await getWorkspaceDetails(workspaceId);
        setWorkspace(res.data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    if (workspaceId) {
      checkAdminAndFetchWorkspace();
    }
  }, [workspaceId, router]);

  const handleSuspend = async () => {
    try {
      setActionLoading(true);
      await suspendWorkspace(workspaceId, suspendReason);
      setShowSuspendModal(false);
      setSuspendReason('');
      
      // Refresh workspace data
      const res = await getWorkspaceDetails(workspaceId);
      setWorkspace(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await resumeWorkspace(workspaceId);
      
      // Refresh workspace data
      const res = await getWorkspaceDetails(workspaceId);
      setWorkspace(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

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

  if (!workspace) {
    return (
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} currentPath="/admin" />
        <div className="flex-1 flex flex-col lg:ml-16">
          <main className="flex-1 overflow-auto p-6">
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg p-8 text-center">
              <p className="text-red-800 dark:text-red-200 text-lg">{error || 'Workspace not found'}</p>
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
            <button
              onClick={() => router.back()}
              className="mb-4 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-2"
            >
              ← Back to Dashboard
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
              {/* Header */}
              <div className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{workspace.name}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">Workspace ID: {workspace.id}</p>
                  </div>
                  <div className="flex gap-3">
                    {workspace.owner?.email === localStorage.getItem('userEmail') || true ? (
                      <>
                        {workspace.suspended ? (
                          <button
                            onClick={handleResume}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:bg-gray-400"
                          >
                            {actionLoading ? '⏳' : '▶️'} Resume Workspace
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowSuspendModal(true)}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:bg-gray-400"
                          >
                            {actionLoading ? '⏳' : '⏸️'} Suspend
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg p-4 mb-6">
                  <p className="text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {/* Workspace Status */}
              {workspace.suspended && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                  <p className="text-yellow-800 dark:text-yellow-200">🔒 This workspace is currently suspended</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Business Information */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Business Information</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Plan</label>
                      <div className="text-gray-800 dark:text-white font-medium capitalize">{workspace.plan}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Industry</label>
                      <div className="text-gray-800 dark:text-white font-medium">{workspace.industry || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Website</label>
                      <div className="text-gray-800 dark:text-white font-medium">{workspace.website || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {/* Owner Information */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Owner Information</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Name</label>
                      <div className="text-gray-800 dark:text-white font-medium">{workspace.owner?.name || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Email</label>
                      <div className="text-gray-800 dark:text-white font-medium break-all">{workspace.owner?.email || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Phone</label>
                      <div className="text-gray-800 dark:text-white font-medium">{workspace.owner?.phone || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Members */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Team Members ({workspace.members?.length || 0})</h2>
                {workspace.members && workspace.members.length > 0 ? (
                  <div className="space-y-3">
                    {workspace.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white">{member.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{member.email}</div>
                        </div>
                        <span className="px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 rounded-full text-xs font-medium capitalize">
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400">No team members</p>
                )}
              </div>

              {/* WABA Information */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">WhatsApp Business Account (WABA)</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Status</label>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        workspace.waba?.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                      }`}>
                        {workspace.waba?.status || 'not_started'}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Account Status</label>
                      <div className="text-gray-800 dark:text-white font-medium">{workspace.waba?.accountStatus || 'UNKNOWN'}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Phone Number</label>
                      <div className="text-gray-800 dark:text-white font-medium">{workspace.waba?.phoneNumber || 'N/A'}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Phone Number ID</label>
                      <div className="text-gray-800 dark:text-white font-medium text-sm break-all">{workspace.waba?.phoneNumberId || 'N/A'}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">WABA ID</label>
                      <div className="text-gray-800 dark:text-white font-medium text-sm break-all">{workspace.waba?.wabaId || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verification Status */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Verification Status</h2>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Status</label>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${
                        workspace.verification?.status === 'verified'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300'
                      }`}>
                        {workspace.verification?.status || 'not_submitted'}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Submitted At</label>
                      <div className="text-gray-800 dark:text-white font-medium mt-2">
                        {workspace.verification?.submittedAt ? new Date(workspace.verification.submittedAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 dark:text-gray-400">Verified By</label>
                      <div className="text-gray-800 dark:text-white font-medium mt-2">{workspace.verification?.verifiedBy || 'N/A'}</div>
                    </div>
                  </div>
                  {workspace.verification?.rejectionReason && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                      <strong>Rejection Reason:</strong> {workspace.verification.rejectionReason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Suspend Workspace</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to suspend this workspace? Users will not be able to access it.
            </p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension (optional)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm mb-4"
              rows="3"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSuspendModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:bg-gray-400"
              >
                {actionLoading ? '⏳' : '⏸️'} Suspend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceDetailPage;
