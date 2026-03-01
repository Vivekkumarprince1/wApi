'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronDown, Reply, RotateCcw, Search
} from 'lucide-react';
import { getAutoReplies, toggleAutoReply, deleteAutoReply } from '@/lib/api';
import { toast } from 'react-toastify';
import PageLoader from '@/components/ui/PageLoader';

export default function AutoRepliesPage() {
  const router = useRouter();
  const [autoReplies, setAutoReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ enabled: 'all', search: '' });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { loadAutoReplies(); }, [filters.enabled]); // Only reload from API when status filter changes

  const loadAutoReplies = async () => {
    try {
      setLoading(true);
      const data = await getAutoReplies({ enabled: filters.enabled });
      setAutoReplies(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredReplies = autoReplies.filter(ar => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return ar.keywords?.some(k => k.includes(searchLower)) ||
           ar.templateName?.toLowerCase().includes(searchLower);
  });

  const handleToggle = async (id) => {
    try {
      const updated = await toggleAutoReply(id);
      setAutoReplies(autoReplies.map(ar => ar._id === id ? updated : ar));
      toast?.success?.(updated.enabled ? 'Auto-reply enabled' : 'Auto-reply disabled');
    } catch (err) {
      toast?.error?.('Failed to toggle auto-reply');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this auto-reply?')) return;
    try {
      await deleteAutoReply(id);
      setAutoReplies(autoReplies.filter(ar => ar._id !== id));
      toast?.success?.('Auto-reply deleted');
    } catch (err) {
      toast?.error?.('Failed to delete auto-reply');
    }
  };

  if (loading) return <PageLoader message="Loading auto-replies..." />;

  return (
    <div className="animate-fade-in-up">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
            <Reply className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Auto Replies</h1>
            <p className="text-sm text-muted-foreground">Automatically respond to incoming messages</p>
          </div>
        </div>
        <Link href="/automation/auto-replies/create"
          className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> Create Auto-Reply
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-6">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Search Keywords</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" value={filters.search} placeholder="Search by keyword..."
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input-premium pl-9" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
            <select value={filters.enabled} onChange={(e) => setFilters({ ...filters, enabled: e.target.value })}
              className="input-premium">
              <option value="all">All Auto-Replies</option>
              <option value="true">Enabled Only</option>
              <option value="false">Disabled Only</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({ enabled: 'all', search: '' })}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-border text-muted-foreground hover:bg-accent rounded-xl text-sm font-medium transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredReplies.length === 0 ? (
          <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
            <Reply className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No auto-replies found</p>
            <Link href="/automation/auto-replies/create"
              className="btn-primary inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Create Your First Auto-Reply
            </Link>
          </div>
        ) : (
          filteredReplies.map((ar) => (
            <div key={ar._id} className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <div onClick={() => setExpandedId(expandedId === ar._id ? null : ar._id)}
                className="p-5 cursor-pointer hover:bg-accent/30 transition-colors flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-foreground text-sm">
                      {ar.triggerType === 'keyword' || !ar.triggerType ? `Keywords: ${ar.keywords?.join(', ')}` : 
                       ar.triggerType === 'always' ? 'Always Reply' : 'Away Message (After Hours)'}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ar.enabled
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-destructive/10 text-destructive'}`}>
                      {ar.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Trigger: <span className="font-medium capitalize">{ar.triggerType?.replace('_', ' ') || 'Keyword'}</span> •
                    Template: <span className="font-medium">{ar.templateName}</span> •
                    Sent: <span className="font-medium">{ar.totalRepliesSent || 0}</span>
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground ml-4 shrink-0 transition-transform ${expandedId === ar._id ? 'rotate-180' : ''}`} />
              </div>

              {expandedId === ar._id && (
                <div className="px-5 py-4 bg-muted/30 border-t border-border space-y-4">
                  {(ar.triggerType === 'keyword' || !ar.triggerType) && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ar.keywords?.map(kw => (
                          <span key={kw} className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {ar.triggerType === 'keyword' && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Match Mode</p>
                      <p className="text-sm font-medium text-foreground capitalize">{ar.matchMode}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Replies</p>
                      <p className="text-lg font-bold text-foreground">{ar.totalRepliesSent || 0}</p>
                    </div>
                    {ar.lastSentAt && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Last Sent</p>
                        <p className="text-sm font-medium text-foreground">{new Date(ar.lastSentAt).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                    <p className="text-xs text-blue-700 dark:text-blue-300">💡 Sends once per contact in a 24-hour window</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
                <button onClick={() => handleToggle(ar._id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${ar.enabled
                    ? 'text-primary hover:bg-primary/10'
                    : 'text-muted-foreground hover:bg-accent'}`}>
                  {ar.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {ar.enabled ? 'Disable' : 'Enable'}
                </button>
                <Link href={`/automation/auto-replies/edit/${ar._id}`}
                  className="flex items-center gap-1.5 px-3 py-2 text-blue-600 hover:bg-blue-500/10 rounded-xl text-xs font-medium transition-colors">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
                <button onClick={() => handleDelete(ar._id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-destructive hover:bg-destructive/10 rounded-xl text-xs font-medium transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
