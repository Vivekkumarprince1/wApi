"use client"

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, ArrowLeft, Play, Pause, ShieldAlert, X } from 'lucide-react';
// Sidebar is rendered globally by LayoutWrapper
import { getWorkspaceDetails, suspendWorkspace, resumeWorkspace } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';

const WorkspaceDetailPage = () => {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId;
  const { user: authUser, loading: authLoading, authenticated: isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) { router.push('/auth/login'); return; }

    const fetchWorkspace = async () => {
      try {
        if (authUser.role !== 'admin') {
          setError('You do not have permission to access admin features');
          setLoading(false);
          setTimeout(() => router.push('/dashboard'), 3000);
          return;
        }
        const res = await getWorkspaceDetails(workspaceId);
        setWorkspace(res.data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    if (workspaceId) fetchWorkspace();
  }, [workspaceId, router]);

  const handleSuspend = async () => {
    try {
      setActionLoading(true);
      await suspendWorkspace(workspaceId, suspendReason);
      setShowSuspendModal(false);
      setSuspendReason('');
      const res = await getWorkspaceDetails(workspaceId);
      setWorkspace(res.data);
    } catch (err) { setError(err.message); }
    finally { setActionLoading(false); }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await resumeWorkspace(workspaceId);
      const res = await getWorkspaceDetails(workspaceId);
      setWorkspace(res.data);
    } catch (err) { setError(err.message); }
    finally { setActionLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!isAuthenticated) return null;

  if (!workspace) return (
    <div className="p-6">
      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-8 text-center">
        <p className="text-destructive text-lg">{error || 'Workspace not found'}</p>
      </div>
    </div>
  );

  const InfoItem = ({ label, value }) => (
    <div>
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="text-foreground font-medium">{value || 'N/A'}</div>
    </div>
  );

  return (
    <div className="animate-fade-in-up">
      <button onClick={() => router.back()}
        className="mb-4 text-primary hover:text-primary/80 flex items-center gap-2 text-sm font-medium transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>

      <div className="bg-card border border-border/50 rounded-xl shadow-premium p-6 sm:p-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-border">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{workspace.name}</h1>
              <p className="text-muted-foreground mt-1 text-sm">Workspace ID: {workspace.id}</p>
            </div>
            <div className="flex gap-3">
              {workspace.suspended ? (
                <button onClick={handleResume} disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 text-sm">
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Resume
                </button>
              ) : (
                <button onClick={() => setShowSuspendModal(true)} disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl font-medium transition-all disabled:opacity-50 text-sm">
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />} Suspend
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-6">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {workspace.suspended && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
            <p className="text-amber-700 dark:text-amber-300 text-sm">🔒 This workspace is currently suspended</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Business Information</h2>
            <div className="space-y-3">
              <InfoItem label="Plan" value={workspace.plan} />
              <InfoItem label="Industry" value={workspace.industry} />
              <InfoItem label="Website" value={workspace.website} />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Owner Information</h2>
            <div className="space-y-3">
              <InfoItem label="Name" value={workspace.owner?.name} />
              <InfoItem label="Email" value={workspace.owner?.email} />
              <InfoItem label="Phone" value={workspace.owner?.phone} />
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Team Members ({workspace.members?.length || 0})</h2>
          {workspace.members?.length > 0 ? (
            <div className="space-y-3">
              {workspace.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between bg-muted rounded-xl p-4">
                  <div>
                    <div className="font-medium text-foreground">{member.name}</div>
                    <div className="text-sm text-muted-foreground">{member.email}</div>
                  </div>
                  <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium capitalize">{member.role}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground text-sm">No team members</p>}
        </div>

        {/* WABA */}
        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">WhatsApp Business Account (WABA)</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Status</label>
                <div className="mt-1">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${workspace.waba?.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                    {workspace.waba?.status || 'not_started'}
                  </span>
                </div>
              </div>
              <InfoItem label="Account Status" value={workspace.waba?.accountStatus || 'UNKNOWN'} />
              <InfoItem label="Phone Number" value={workspace.waba?.phoneNumber} />
            </div>
            <div className="space-y-3">
              <InfoItem label="Phone Number ID" value={workspace.waba?.phoneNumberId} />
              <InfoItem label="WABA ID" value={workspace.waba?.wabaId} />
            </div>
          </div>
        </div>

        {/* Verification */}
        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Verification Status</h2>
          <div className="bg-muted rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm text-muted-foreground">Status</label>
                <div className="mt-2">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${workspace.verification?.status === 'verified'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground border border-border'}`}>
                    {workspace.verification?.status || 'not_submitted'}
                  </span>
                </div>
              </div>
              <InfoItem label="Submitted At" value={workspace.verification?.submittedAt ? new Date(workspace.verification.submittedAt).toLocaleDateString() : 'N/A'} />
              <InfoItem label="Verified By" value={workspace.verification?.verifiedBy} />
            </div>
            {workspace.verification?.rejectionReason && (
              <div className="mt-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive">
                <strong>Rejection Reason:</strong> {workspace.verification.rejectionReason}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-premium animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Suspend Workspace</h2>
              <button onClick={() => setShowSuspendModal(false)} className="p-1 hover:bg-accent rounded-lg transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              Are you sure you want to suspend this workspace? Users will not be able to access it.
            </p>
            <textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension (optional)"
              className="input-premium mb-4 min-h-[80px]" />
            <div className="flex gap-3">
              <button onClick={() => setShowSuspendModal(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-foreground font-medium hover:bg-accent transition-colors text-sm">Cancel</button>
              <button onClick={handleSuspend} disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-xl font-medium transition-all disabled:opacity-50 text-sm">
                {actionLoading ? 'Suspending...' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceDetailPage;
