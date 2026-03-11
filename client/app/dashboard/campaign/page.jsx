'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/api';
import { useQuota } from '@/lib/useQuota';
import { toast } from 'react-toastify';
import { Play, Pause, Trash2, Eye, Search, SlidersHorizontal, BarChart3, Calendar, User, Plus, AlertTriangle, Loader2 } from 'lucide-react';

export default function CampaignsPage() {
  const router = useRouter();
  const { usageData, isApproachingLimit, getRemainingQuota } = useQuota();
  const [activeTab, setActiveTab] = useState('one-time');
  const [channel, setChannel] = useState('WhatsApp');
  const [status, setStatus] = useState('ANY');
  const [category, setCategory] = useState('ALL');
  const [createdBy, setCreatedBy] = useState('ALL');
  const [dateSetLive, setDateSetLive] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [campaigns, setCampaigns] = useState([]);

  const showQuotaWarning = isApproachingLimit('campaigns', 80);
  const remainingCampaigns = getRemainingQuota('campaigns');

  useEffect(() => {
    loadCampaigns();
  }, [activeTab, channel, status, category, createdBy, dateSetLive, search]);

  async function loadCampaigns() {
    try {
      setLoading(true);
      setError('');
      const resp = await api.get('/campaigns');
      let data = resp.campaigns || [];
      if (activeTab === 'one-time') data = data.filter(c => c.campaignType === 'one-time' || !c.campaignType);
      else if (activeTab === 'ongoing') data = data.filter(c => c.campaignType === 'scheduled');
      setCampaigns(data);
    } catch (e) {
      console.error('Failed to load campaigns:', e);
      setCampaigns([]);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }

  const handleAction = async (id, action) => {
    try {
      await api.post(`/campaigns/${id}/${action}`, {});
      toast.success(`Campaign ${action} successful`);
      loadCampaigns();
    } catch (e) {
      toast.error(e.message || `Failed to ${action} campaign`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await api.del(`/campaigns/${id}`);
      toast.success('Campaign deleted successfully');
      loadCampaigns();
    } catch (e) {
      toast.error(e.message || 'Failed to delete campaign');
    }
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'sending': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'paused': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'failed': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'queued': return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <BarChart3 className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">No Campaigns Found</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
        You haven&apos;t created any campaigns in this view yet.
      </p>
      <button onClick={() => router.push('/dashboard/campaign/new')}
        className="btn-primary flex items-center gap-2 text-sm">
        <Plus className="h-4 w-4" /> Create Your First Campaign
      </button>
    </div>
  );

  return (
    <div className="animate-fade-in-up">
      {/* Quota Warning */}
      {showQuotaWarning && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3 mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You&apos;re approaching your campaign limit. <strong>{remainingCampaigns}</strong> campaign{remainingCampaigns !== 1 ? 's' : ''} remaining.{' '}
              <button onClick={() => router.push('/dashboard/settings/billing')} className="underline font-medium hover:text-amber-800">Upgrade now</button>
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            Campaigns
            <span className="text-xs font-normal bg-muted text-muted-foreground px-2.5 py-1 rounded-full border border-border">{campaigns.length} Total</span>
          </h1>
        </div>
        <button onClick={() => router.push('/dashboard/campaign/new')}
          className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> Create New Campaign
        </button>
      </div>

      {/* Tabs & Filters */}
      <div className="bg-card border border-border/50 rounded-xl mb-6">
        <div className="px-6 border-b border-border">
          <div className="flex items-center gap-6">
            {[
              { key: 'one-time', label: 'One Time Campaigns' },
              { key: 'ongoing', label: 'Ongoing Campaigns' },
              { key: 'api', label: 'API campaigns' },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`py-3.5 px-1 border-b-[3px] text-sm font-bold transition-all ${activeTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 flex flex-wrap items-center gap-3 bg-muted/30">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns by name..."
              className="input-premium pl-10 text-sm py-2" />
          </div>
          <div className="flex items-center gap-2">
            {[
              { icon: SlidersHorizontal, value: status, onChange: setStatus, options: [['ANY', 'Status: Any'], ['draft', 'Draft'], ['sending', 'Sending'], ['paused', 'Paused'], ['completed', 'Completed']] },
              { icon: User, value: createdBy, onChange: setCreatedBy, options: [['ALL', 'Created by: All']] },
              { icon: Calendar, value: dateSetLive, onChange: setDateSetLive, options: [['ALL', 'Live: All Time']] },
            ].map((f, i) => (
              <div key={i} className="flex items-center bg-card border border-border rounded-xl px-2 overflow-hidden">
                <f.icon className="h-3.5 w-3.5 text-muted-foreground mx-1.5" />
                <select value={f.value} onChange={(e) => f.onChange(e.target.value)}
                  className="pr-2 py-2 text-xs font-semibold bg-transparent text-foreground focus:outline-none border-none">
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-card border border-border/50 rounded-xl shadow-premium overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-80">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground font-medium">Fetching campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {['Campaign Details', 'Status', 'Sent', 'Delivered', 'Read', 'Last Activity', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {campaigns.map((c) => (
                  <tr key={c._id} className="hover:bg-accent/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground hover:text-primary cursor-pointer" onClick={() => router.push(`/dashboard/campaign/${c._id}`)}>
                          {c.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                          <span className="px-1.5 py-0.5 bg-muted rounded uppercase font-medium">WhatsApp</span>
                          • {c.template?.name || 'Manual Message'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${getStatusColor(c.status)} uppercase`}>{c.status}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-foreground">{c.sentCount || 0}</span>
                      <p className="text-[10px] text-muted-foreground uppercase mt-0.5">Total: {c.totalContacts || 0}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">{c.deliveredCount || 0}</span>
                      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        {c.sentCount > 0 ? Math.round(((c.deliveredCount || 0) / c.sentCount) * 100) : 0}%
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">{c.readCount || 0}</span>
                      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                        {c.sentCount > 0 ? Math.round(((c.readCount || 0) / c.sentCount) * 100) : 0}%
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">{new Date(c.updatedAt || c.createdAt).toLocaleDateString()}</span>
                        <span className="text-[11px] text-muted-foreground mt-0.5">{new Date(c.updatedAt || c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => router.push(`/dashboard/campaign/${c._id}`)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="View Report">
                          <Eye className="h-4 w-4" />
                        </button>
                        {c.status === 'draft' && (
                          <button onClick={() => handleAction(c._id, 'start')}
                            className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 rounded-lg transition-all" title="Send Now">
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        {['sending', 'queued'].includes(c.status) && (
                          <button onClick={() => handleAction(c._id, 'pause')}
                            className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-all" title="Pause">
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                        {c.status === 'paused' && (
                          <button onClick={() => handleAction(c._id, 'resume')}
                            className="p-2 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-all" title="Resume">
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(c._id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
