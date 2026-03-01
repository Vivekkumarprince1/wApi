'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlay, FaPause, FaTrash, FaEye, FaPlus } from 'react-icons/fa';
import * as api from '../../../../lib/api';

export default function CampaignListPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });

  useEffect(() => {
    loadCampaigns();
  }, [statusFilter, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    const hasRunningCampaign = campaigns.some((campaign) => ['queued', 'sending', 'running'].includes((campaign.status || '').toLowerCase()));

    if (!hasRunningCampaign) return;

    const interval = setInterval(() => {
      loadCampaigns({ silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [campaigns, statusFilter, page, limit]);

  const loadCampaigns = async ({ silent = false } = {}) => {
    try {
      setError('');
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', String(limit));
      if (statusFilter) query.set('status', statusFilter);
      if (search.trim()) query.set('search', search.trim());

      const response = await api.get(`/campaigns?${query.toString()}`);
      setCampaigns(response.campaigns || []);
      setPagination(response.pagination || { page, pages: 1, total: 0, limit });
    } catch (err) {
      console.error('Error loading campaigns:', err);
      setError(err.message || 'Failed to load campaigns');
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadCampaigns();
  };

  const handleStart = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/enqueue`, {});
      loadCampaigns();
    } catch (err) {
      alert(err.message || 'Failed to start campaign');
    }
  };

  const handlePause = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/pause`, {});
      loadCampaigns();
    } catch (err) {
      alert(err.message || 'Failed to pause campaign');
    }
  };

  const handleResume = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/resume`, {});
      loadCampaigns();
    } catch (err) {
      alert(err.message || 'Failed to resume campaign');
    }
  };

  const handleDelete = async (campaignId) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await api.del(`/campaigns/${campaignId}`);
      loadCampaigns();
    } catch (err) {
      alert(err.message || 'Failed to delete campaign');
    }
  };

  const getStatusBadge = (campaign) => {
    const { status, pausedReason } = campaign;
    
    const statusStyles = {
      draft: 'bg-gray-100 text-foreground dark:bg-muted dark:text-gray-200',
      queued: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      sending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      paused: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };

    const label = status === 'paused' && pausedReason 
      ? `${status} (${pausedReason})`
      : status;

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-muted-foreground">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {refreshing ? 'Live refresh active…' : 'Use filters to narrow campaigns'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadCampaigns({ silent: true })}
              className="px-3 py-2 border border-border text-foreground rounded-xl hover:bg-accent transition-colors text-sm"
            >
              Refresh
            </button>
            <button
              onClick={() => router.push('/dashboard/campaign/create-enhanced')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
            >
              <FaPlus /> Create Campaign
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-border bg-card">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by campaign name"
            className="px-3 py-2 border border-border rounded-xl bg-background text-foreground text-sm min-w-[240px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl bg-background text-foreground text-sm"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-xl bg-background text-foreground text-sm"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="m-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Campaign List */}
      <div className="p-6">
        {campaigns.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <p className="text-muted-foreground mb-4">No campaigns yet</p>
            <button
              onClick={() => router.push('/dashboard/campaign/create-enhanced')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
            >
              Create your first campaign
            </button>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted dark:bg-card">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Template</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Progress</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Created</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map(campaign => (
                  <tr key={campaign._id} className="bg-card hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{campaign.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-muted-foreground">
                        {campaign.template?.name || 'N/A'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(campaign)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-foreground">
                          {campaign.sentCount}/{campaign.totalContacts}
                        </p>
                        <div className="w-32 h-2 bg-border dark:bg-muted rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-blue-600"
                            style={{ width: `${campaign.totalContacts > 0 ? (campaign.sentCount / campaign.totalContacts) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {campaign.status === 'draft' && (
                          <button
                            onClick={() => handleStart(campaign._id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                            title="Start Campaign"
                          >
                            <FaPlay />
                          </button>
                        )}
                        
                        {['queued', 'sending'].includes(campaign.status) && (
                          <button
                            onClick={() => handlePause(campaign._id)}
                            className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-colors"
                            title="Pause Campaign"
                          >
                            <FaPause />
                          </button>
                        )}
                        
                        {campaign.status === 'paused' && (
                          <button
                            onClick={() => handleResume(campaign._id)}
                            className="p-2 text-primary hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors"
                            title="Resume Campaign"
                          >
                            <FaPlay />
                          </button>
                        )}
                        
                        <button
                          onClick={() => router.push(`/dashboard/campaign/${campaign._id}`)}
                          className="p-2 text-muted-foreground hover:bg-accent rounded-xl transition-colors"
                          title="View Details"
                        >
                          <FaEye />
                        </button>
                        
                        {['draft', 'completed', 'failed'].includes(campaign.status) && (
                          <button
                            onClick={() => handleDelete(campaign._id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                            title="Delete Campaign"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Showing page {pagination.page || page} of {pagination.pages || 1} • {pagination.total || campaigns.length} total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={(pagination.page || page) <= 1}
                className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min((pagination.pages || 1), p + 1))}
                disabled={(pagination.page || page) >= (pagination.pages || 1)}
                className="px-3 py-1.5 border border-border rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
