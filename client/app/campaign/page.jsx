'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/api';

export default function CampaignsPage() {
  const router = useRouter();
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

  useEffect(() => {
    loadCampaigns();
  }, [activeTab, channel, status, category, createdBy, dateSetLive, search]);

  async function loadCampaigns() {
    try {
      setLoading(true);
      setError('');
      // Placeholder: hook up to backend later
      const resp = await api.get('/campaigns', {
        params: {
          tab: activeTab,
          channel,
          status,
          category,
          createdBy,
          dateSetLive,
          q: search,
        },
      });
      setCampaigns(Array.isArray(resp?.data) ? resp.data : (resp?.campaigns || []));
    } catch (e) {
      // Keep UI usable even if backend isn't ready
      setCampaigns([]);
      setError('');
    } finally {
      setLoading(false);
    }
  }

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
        <span className="text-green-700 text-xl">🟢</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">No Campaigns here</p>
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">Click below to send a campaign</p>
      <button
        onClick={() => router.push('/dashboard/campaign/new')}
        className="px-4 py-2 rounded bg-green-700 hover:bg-green-800 text-white"
      >
        + New Campaign
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
          <button
            onClick={() => router.push('/dashboard/campaign/new')}
            className="px-4 py-2 rounded bg-green-700 hover:bg-green-800 text-white"
          >
            + New Campaign
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
        <div className="flex items-center gap-6">
          {[
            { key: 'one-time', label: 'One Time Campaigns' },
            { key: 'ongoing', label: 'Ongoing Campaigns' },
            { key: 'api', label: 'API campaigns' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === t.key ? 'border-green-700 text-green-700' : 'border-transparent text-gray-500 dark:text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="flex-1 min-w-[220px] px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">📱</span>
            <select value={channel} onChange={(e)=>setChannel(e.target.value)} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option>WhatsApp</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">🔽 Status</span>
            <select value={status} onChange={(e)=>setStatus(e.target.value)} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="ANY">Any</option>
              <option>Scheduled</option>
              <option>Sent</option>
              <option>Draft</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">❤ Category</span>
            <select value={category} onChange={(e)=>setCategory(e.target.value)} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="ALL">All</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">👤 Created by</span>
            <select value={createdBy} onChange={(e)=>setCreatedBy(e.target.value)} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="ALL">All</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">📅 Date Set Live</span>
            <select value={dateSetLive} onChange={(e)=>setDateSetLive(e.target.value)} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="ALL">All</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="px-6 py-6">
        <div className="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 min-h-[320px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700"></div>
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="p-4 text-sm text-gray-700 dark:text-gray-300">{/* TODO: render campaigns table */}
              {campaigns.map((c) => (
                <div key={c._id} className="py-2 border-b border-gray-100 dark:border-gray-700">
                  {c.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
