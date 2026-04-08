'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronDown, Reply, 
  RotateCcw, Search, Zap, Clock, MessageSquare, BarChart3, MoreVertical,
  ArrowRight
} from 'lucide-react';
import { get, del, patch } from '@/lib/api';
import { toast } from '@/lib/toast';
import FlashLoader from '@/components/ui/FlashLoader';
import PageHeader from '@/components/shared/PageHeader';
import AutoReplyModal from '@/components/modals/AutoReplyModal';

export default function AutoRepliesPage() {
  const [autoReplies, setAutoReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ enabled: 'all', search: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAutoReplyId, setSelectedAutoReplyId] = useState(null);

  useEffect(() => { 
    loadAutoReplies(); 
  }, []);

  const loadAutoReplies = async () => {
    try {
      setLoading(true);
      const res = await get('/automation/engine/rules?category=auto_reply');
      if (res.success) {
        setAutoReplies(res.data.rules || []);
      }
      setError('');
    } catch (err) {
      setError('Error loading auto-replies: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id, currentStatus) => {
    try {
      const res = await patch(`/automation/engine/rules/${id}/toggle`, { enabled: !currentStatus });
      if (res.success) {
        setAutoReplies(autoReplies.map(ar => ar._id === id ? { ...ar, enabled: !currentStatus } : ar));
        toast?.success?.(!currentStatus ? 'Auto-reply activated' : 'Auto-reply paused');
      }
    } catch (err) {
      toast?.error?.('Failed to toggle auto-reply');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this auto-reply?')) return;
    try {
      const res = await del(`/automation/engine/rules/${id}`);
      if (res.success) {
        setAutoReplies(autoReplies.filter(ar => ar._id !== id));
        toast?.success?.('Auto-reply deleted');
      }
    } catch (err) {
      toast?.error?.('Failed to delete auto-reply');
    }
  };

  const handleModalSuccess = (savedRule) => {
    // If it's an update, replace the item, otherwise prepend it
    setAutoReplies(prev => {
      const exists = prev.find(ar => ar._id === savedRule._id);
      if (exists) {
        return prev.map(ar => ar._id === savedRule._id ? savedRule : ar);
      }
      return [savedRule, ...prev];
    });
  };

  const filteredReplies = autoReplies.filter(ar => {
    // Search filter
    const searchMatch = !filters.search || 
      ar.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      ar.trigger?.filters?.keywords?.some(k => k.toLowerCase().includes(filters.search.toLowerCase()));
    
    // Status filter
    const statusMatch = filters.enabled === 'all' || 
      String(ar.enabled) === filters.enabled;

    return searchMatch && statusMatch;
  });

  const getTriggerLabel = (ar) => {
    const keywords = ar.trigger?.filters?.keywords;
    if (keywords && keywords.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {keywords.slice(0, 2).map((kw, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">
              {kw}
            </span>
          ))}
          {keywords.length > 2 && <span className="text-[10px] text-slate-400">+{keywords.length - 2} more</span>}
        </div>
      );
    }
    if (ar.trigger?.filters?.businessHoursOnly) return 'Away (After Hours)';
    return 'Always Reply';
  };

  if (loading) return <FlashLoader />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12 animate-in fade-in duration-700">
      <div className="max-w-[1400px] mx-auto px-6">
        <PageHeader
          icon={Reply}
          title="Instant Auto Replies"
          subtitle="Simple template-based responses for common customer queries."
          actions={
            <button 
              onClick={() => { setSelectedAutoReplyId(null); setIsModalOpen(true); }}
              className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <Plus className="h-5 w-5" /> Create New Reply
            </button>
          }
        />

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Logic Rules</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{autoReplies.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Active Now</p>
            <p className="text-2xl font-bold">{autoReplies.filter(ar => ar.enabled).length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Total Sent</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {autoReplies.reduce((acc, ar) => acc + (ar.stats?.totalExecutions || 0), 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Speed</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">&lt; 1s</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or keyword..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select 
              value={filters.enabled}
              onChange={(e) => setFilters({ ...filters, enabled: e.target.value })}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm outline-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm dark:text-slate-100"
            >
              <option value="all">Any Status</option>
              <option value="true">Active Only</option>
              <option value="false">Paused Only</option>
            </select>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm mb-8 flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">!</div>
             {error}
          </div>
        )}

        {/* Auto Replies List */}
        <div className="space-y-4">
          {filteredReplies.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 py-24 text-center">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Reply className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No auto-replies configured</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">Set up your first automated response to handle frequent customer questions automatically.</p>
              <button 
                onClick={() => { setSelectedAutoReplyId(null); setIsModalOpen(true); }}
                className="bg-primary text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
              >
                + Create First Reply
              </button>
            </div>
          ) : (
            filteredReplies.map((ar) => (
              <div 
                key={ar._id}
                className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:shadow-premium transition-all p-2 pr-6"
              >
                <div className="flex items-center gap-6">
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-xl shadow-inner ${
                    ar.enabled ? 'bg-primary/5 dark:bg-primary/10 text-primary' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {ar.enabled ? <Zap /> : <Clock />}
                  </div>

                  <div className="flex-1 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">{ar.name}</h3>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        ar.enabled ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {ar.enabled ? 'Live' : 'Paused'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Trigger</p>
                        {getTriggerLabel(ar)}
                      </div>
                      <span className="text-slate-300 self-end mb-1">•</span>
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Action</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-primary" /> Send: {ar.actions?.[0]?.config?.templateName || 'Message'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Performance */}
                  <div className="hidden lg:flex items-center gap-12 px-8 border-x border-slate-50 dark:border-slate-800">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Hits</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ar.stats?.totalExecutions || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Last Run</p>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {ar.stats?.lastExecutedAt ? new Date(ar.stats.lastExecutedAt).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleToggle(ar._id, ar.enabled)}
                      className={`p-3 rounded-xl transition-all ${
                        ar.enabled 
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30' 
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                      title={ar.enabled ? "Deactivate" : "Activate"}
                    >
                      {ar.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                    </button>
                    <button 
                      onClick={() => { setSelectedAutoReplyId(ar._id); setIsModalOpen(true); }}
                      className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                      title="Edit"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(ar._id)}
                      className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 rounded-xl transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AutoReplyModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        autoReplyId={selectedAutoReplyId}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
