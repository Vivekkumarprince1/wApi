"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert, BarChart3, Building2, Smartphone } from 'lucide-react';
import { getAllWorkspaces, getAdminAnalytics, getWABAHealth } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';

const AdminDashboard = () => {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const isAuthenticated = Boolean(authUser);
  const isAdmin = authUser?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [workspaces, setWorkspaces] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [wabaHealth, setWabaHealth] = useState([]);
  const [error, setError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) { router.push('/auth/login'); return; }

    const fetchAdminData = async () => {
      if (authUser.role !== 'admin') {
        setError('You do not have permission to access the admin dashboard');
        setLoading(false);
        setTimeout(() => router.push('/dashboard'), 3000);
        return;
      }
      try {
        const workspacesRes = await getAllWorkspaces({ limit: 50 });
        setWorkspaces(workspacesRes.data || []);
        const analyticsRes = await getAdminAnalytics();
        setAnalytics(analyticsRes.data || {});
        const wabaRes = await getWABAHealth();
        setWabaHealth(wabaRes.data || []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message);
      }
      setLoading(false);
      setStatsLoading(false);
    };
    fetchAdminData();
  }, [authUser, authLoading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (error && !isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-8 text-center max-w-md">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'workspaces', label: 'Workspaces', icon: Building2 },
    { id: 'waba', label: 'WABA Health', icon: Smartphone },
  ];

  const statCards = [
    { label: 'Total Workspaces', value: analytics?.overview?.totalWorkspaces || 0, color: 'from-blue-500/10 to-blue-600/10 border-blue-500/20', textColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Active Workspaces', value: analytics?.overview?.activeWorkspaces || 0, color: 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/20', textColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Suspension Rate', value: analytics?.overview?.suspension_rate || '0%', color: 'from-amber-500/10 to-amber-600/10 border-amber-500/20', textColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Plan Distribution', value: null, color: 'from-violet-500/10 to-violet-600/10 border-violet-500/20', textColor: 'text-violet-600 dark:text-violet-400', custom: true },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ShieldAlert className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground">Manage all tenants, monitor WABA health, and view platform analytics</p>
      </div>

      {error && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-6">
          <p className="text-destructive text-sm">Error: {error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-border">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`pb-3 font-medium transition-colors flex items-center gap-2 text-sm ${activeTab === tab.id
                ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {statsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {statCards.map((card, i) => (
                  <div key={i} className={`bg-gradient-to-br ${card.color} border rounded-xl p-5`}>
                    <div className={`text-sm font-medium ${card.textColor}`}>{card.label}</div>
                    {card.custom ? (
                      <div className={`text-sm font-medium mt-2 ${card.textColor}`}>
                        <div>Free: {analytics?.plans?.free || 0}</div>
                        <div>Premium: {analytics?.plans?.premium || 0}</div>
                      </div>
                    ) : (
                      <div className={`text-3xl font-bold mt-2 ${card.textColor}`}>{card.value}</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-card border border-border/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Verification Status</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(analytics?.verification || {}).map(([status, count]) => (
                    <div key={status} className="bg-muted rounded-xl p-4 text-center">
                      <div className="text-sm text-muted-foreground capitalize">{status}</div>
                      <div className="text-2xl font-bold text-foreground mt-2">{count}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">WABA Status Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(analytics?.wabaStatus || {}).map(([status, count]) => (
                    <div key={status} className="bg-muted rounded-xl p-4 text-center">
                      <div className="text-sm text-muted-foreground capitalize">{status.replace(/_/g, ' ')}</div>
                      <div className="text-2xl font-bold text-foreground mt-2">{count}</div>
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
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      {['Workspace', 'Owner', 'Plan', 'WABA Status', 'Verification', 'Members', 'Created', 'Actions'].map(h => (
                        <th key={h} className="text-left py-3 px-4 font-semibold text-muted-foreground text-sm">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {workspaces.map((workspace) => (
                      <tr key={workspace.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">{workspace.name}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{workspace.owner?.name || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">{workspace.plan}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${workspace.wabaStatus === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                            {workspace.wabaStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${workspace.verificationStatus === 'verified'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                            {workspace.verificationStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{workspace.memberCount}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(workspace.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <button onClick={() => router.push(`/admin/workspaces/${workspace.id}`)}
                            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
                            View Details →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {workspaces.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No workspaces found</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WABA Health Tab */}
      {activeTab === 'waba' && (
        <div>
          {statsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              {wabaHealth.map((waba) => (
                <div key={waba.workspaceId} className="bg-card border border-border/50 rounded-xl p-5 hover:shadow-premium transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-foreground">{waba.workspaceName}</h3>
                      <p className="text-sm text-muted-foreground mt-1">📱 {waba.phoneNumber}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${waba.accountStatus === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : waba.accountStatus === 'DISABLED'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                      {waba.accountStatus}
                    </span>
                  </div>
                  {waba.blocked && (
                    <div className="mt-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-sm text-destructive">
                      🔒 Blocked: {waba.blockReason}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    Last checked: {waba.lastCheckedAt ? new Date(waba.lastCheckedAt).toLocaleString() : 'Never'}
                  </div>
                </div>
              ))}
              {wabaHealth.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No WABA data available</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
