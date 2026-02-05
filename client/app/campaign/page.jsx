'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/api';
import { useQuota } from '@/lib/useQuota';
import { toast } from 'react-toastify';
import { FaPlay, FaPause, FaTrash, FaEye, FaSearch, FaFilter, FaChartBar, FaCalendarAlt, FaUser, FaPlus, FaExclamationTriangle } from 'react-icons/fa';

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

  // Quota state
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
      // Backend returns { campaigns: [] } based on my previous fix
      let data = resp.campaigns || [];
      
      // Basic frontend filtering for the tabs until backend supports it
      if (activeTab === 'one-time') {
        data = data.filter(c => c.campaignType === 'one-time' || !c.campaignType);
      } else if (activeTab === 'ongoing') {
        data = data.filter(c => c.campaignType === 'scheduled');
      }

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'sending': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'paused': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'failed': return 'bg-red-100 text-red-700 border-red-200';
      case 'queued': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4 border border-green-100 shadow-sm">
        <FaChartBar className="text-green-600 text-3xl" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Campaigns Found</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
        You haven't created any campaigns in this view yet. Start by creating your first WhatsApp campaign.
      </p>
      <button
        onClick={() => router.push('/dashboard/campaign/new')}
        className="px-6 py-2.5 rounded-lg bg-green-700 hover:bg-green-800 text-white font-medium transition-all shadow-sm hover:shadow flex items-center gap-2"
      >
        <FaPlus className="text-sm" /> Create Your First Campaign
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-gray-950">
      {/* Quota Warning Banner */}
      {showQuotaWarning && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-8 py-3">
          <div className="max-w-[1600px] mx-auto flex items-center gap-3">
            <FaExclamationTriangle className="text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              You're approaching your campaign limit. <strong>{remainingCampaigns}</strong> campaign{remainingCampaigns !== 1 ? 's' : ''} remaining.{' '}
              <button 
                onClick={() => router.push('/dashboard/settings/billing')}
                className="underline font-medium hover:text-amber-900"
              >
                Upgrade now
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 py-5">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              Campaigns
              <span className="text-xs font-normal bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                {campaigns.length} Total
              </span>
            </h1>
          </div>
          <button
            onClick={() => router.push('/dashboard/campaign/new')}
            className="px-5 py-2.5 rounded-md bg-[#00A884] hover:bg-[#008F70] text-white font-semibold transition-all shadow-sm flex items-center gap-2"
          >
            <FaPlus className="text-sm" /> Create New Campaign
          </button>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto">
          {/* Tabs */}
          <div className="px-8 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-8">
              {[
                { key: 'one-time', label: 'One Time Campaigns' },
                { key: 'ongoing', label: 'Ongoing Campaigns' },
                { key: 'api', label: 'API campaigns' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`py-4 px-1 border-b-[3px] text-sm font-bold transition-all ${
                    activeTab === t.key 
                    ? 'border-[#00A884] text-[#00A884]' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="px-8 py-3 flex flex-wrap items-center gap-4 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="relative flex-1 min-w-[300px]">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns by name..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#00A884] focus:border-[#00A884] transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 overflow-hidden shadow-sm">
                <span className="px-2 py-2 text-gray-400"><FaFilter className="text-xs" /></span>
                <select value={status} onChange={(e)=>setStatus(e.target.value)} className="pr-3 py-2 text-xs font-semibold bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none border-none">
                  <option value="ANY">Status: Any</option>
                  <option value="draft">Draft</option>
                  <option value="sending">Sending</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 overflow-hidden shadow-sm">
                <span className="px-2 py-2 text-gray-400"><FaUser className="text-xs" /></span>
                <select value={createdBy} onChange={(e)=>setCreatedBy(e.target.value)} className="pr-3 py-2 text-xs font-semibold bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none border-none">
                  <option value="ALL">Created by: All</option>
                </select>
              </div>

              <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 overflow-hidden shadow-sm">
                <span className="px-2 py-2 text-gray-400"><FaCalendarAlt className="text-xs" /></span>
                <select value={dateSetLive} onChange={(e)=>setDateSetLive(e.target.value)} className="pr-3 py-2 text-xs font-semibold bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none border-none">
                  <option value="ALL">Live: All Time</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1600px] mx-auto px-8 py-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden min-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-[#00A884] mb-4"></div>
              <p className="text-sm text-gray-500 font-medium">Fetching campaigns...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Campaign Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center border-l border-gray-100 dark:border-gray-800">Sent</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Delivered</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Read</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Last Activity</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {campaigns.map((c) => (
                    <tr key={c._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 hover:text-[#00A884] cursor-pointer" onClick={() => router.push(`/dashboard/campaign/${c._id}`)}>
                            {c.name}
                          </span>
                          <span className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded uppercase font-medium">WhatsApp</span>
                            • {c.template?.name || 'Manual Message'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                         <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${getStatusColor(c.status)} uppercase shadow-sm`}>
                           {c.status}
                         </span>
                      </td>
                      <td className="px-6 py-5 text-center border-l border-gray-50 dark:border-gray-800">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{c.sentCount || 0}</span>
                        <p className="text-[10px] text-gray-400 uppercase mt-0.5">Total: {c.totalContacts || 0}</p>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-sm font-bold text-blue-600 font-mono">
                          {c.deliveredCount || 0}
                        </span>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                          {c.sentCount > 0 ? Math.round(((c.deliveredCount || 0) / c.sentCount) * 100) : 0}%
                        </p>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-sm font-bold text-green-600 font-mono">
                          {c.readCount || 0}
                        </span>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                          {c.sentCount > 0 ? Math.round(((c.readCount || 0) / c.sentCount) * 100) : 0}%
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-[12px] text-gray-600 dark:text-gray-400">{new Date(c.updatedAt || c.createdAt).toLocaleDateString()}</span>
                          <span className="text-[11px] text-gray-400 mt-0.5">{new Date(c.updatedAt || c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => router.push(`/dashboard/campaign/${c._id}`)}
                            className="p-2 text-gray-400 hover:text-[#00A884] hover:bg-[#00A884]/10 rounded-md transition-all"
                            title="View Report"
                          >
                            <FaEye size={14} />
                          </button>
                          
                          {c.status === 'draft' && (
                            <button 
                              onClick={() => handleAction(c._id, 'start')}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                              title="Send Now"
                            >
                              <FaPlay size={14} />
                            </button>
                          )}

                          {['sending', 'queued'].includes(c.status) && (
                            <button 
                              onClick={() => handleAction(c._id, 'pause')}
                              className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-all"
                              title="Pause"
                            >
                              <FaPause size={14} />
                            </button>
                          )}

                          {c.status === 'paused' && (
                            <button 
                              onClick={() => handleAction(c._id, 'resume')}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-all"
                              title="Resume"
                            >
                              <FaPlay size={14} />
                            </button>
                          )}

                          <button 
                            onClick={() => handleDelete(c._id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                            title="Delete"
                          >
                            <FaTrash size={14} />
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

      {/* Footer Info */}
      <div className="max-w-[1600px] mx-auto px-8 pb-10 flex items-center justify-between text-[11px] text-gray-400">
        <p>© 2026 WhatsApp Campaign Engine • Interakt Architecture</p>
        <div className="flex gap-4">
          <a href="#" className="hover:text-[#00A884]">Support</a>
          <a href="#" className="hover:text-[#00A884]">Rate Limits</a>
          <a href="#" className="hover:text-[#00A884]">System Status</a>
        </div>
      </div>
    </div>
  );
}
