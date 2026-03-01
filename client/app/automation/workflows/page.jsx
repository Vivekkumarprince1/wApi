'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Search, ChevronDown, Eye, Pencil, Trash2, ToggleLeft, ToggleRight, Workflow, RotateCcw
} from 'lucide-react';
import { get, post, del } from '@/lib/api';
import PageLoader from '@/components/ui/PageLoader';

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ enabled: 'all', trigger: 'all', search: '' });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { loadWorkflows(); }, [filters]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.enabled !== 'all') params.append('enabled', filters.enabled);
      if (filters.trigger !== 'all') params.append('trigger', filters.trigger);
      const data = await get(`/automation/rules?${params.toString()}`);
      let list = Array.isArray(data) ? data : (Array.isArray(data?.rules) ? data.rules : []);
      if (filters.search) {
        list = list.filter(w =>
          w.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
          w.description?.toLowerCase().includes(filters.search.toLowerCase())
        );
      }
      setWorkflows(list);
      setError('');
    } catch (err) {
      setError('Error loading workflows');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflow = async (id, e) => {
    e.stopPropagation();
    try {
      await post(`/automation/rules/${id}/enable`);
      setWorkflows(workflows.map(w => w._id === id ? { ...w, enabled: !w.enabled } : w));
    } catch (err) {
      console.error('Error toggling workflow:', err);
    }
  };

  const deleteWorkflow = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await del(`/automation/rules/${id}`);
      setWorkflows(workflows.filter(w => w._id !== id));
    } catch (err) {
      console.error('Error deleting workflow:', err);
    }
  };

  const triggerLabel = (trigger) => {
    const map = {
      message_received: '📨 Message', status_updated: '📊 Status', keyword: '🔑 Keyword',
      tag_added: '🏷️ Tag', campaign_completed: '🎯 Campaign', ad_lead: '📱 Ad Lead'
    };
    return map[trigger] || trigger;
  };

  if (loading) return <PageLoader message="Loading workflows..." />;

  return (
    <div className="animate-fade-in-up">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
            <Workflow className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workflows</h1>
            <p className="text-sm text-muted-foreground">Automate your WhatsApp business processes</p>
          </div>
        </div>
        <button onClick={() => router.push('/automation/workflows/create')}
          className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> New Workflow
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search workflows..." value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input-premium pl-9" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Trigger Type</label>
            <select value={filters.trigger} onChange={(e) => setFilters({ ...filters, trigger: e.target.value })}
              className="input-premium">
              <option value="all">All Triggers</option>
              <option value="message_received">Message Received</option>
              <option value="status_updated">Status Updated</option>
              <option value="keyword">Keyword Match</option>
              <option value="tag_added">Tag Added</option>
              <option value="campaign_completed">Campaign Completed</option>
              <option value="ad_lead">Ad Lead</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
            <select value={filters.enabled} onChange={(e) => setFilters({ ...filters, enabled: e.target.value })}
              className="input-premium">
              <option value="all">All Status</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({ enabled: 'all', trigger: 'all', search: '' })}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-border text-muted-foreground hover:bg-accent rounded-xl text-sm font-medium transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-6">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Workflows List */}
      <div className="space-y-3">
        {workflows.length === 0 ? (
          <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
            <Workflow className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No workflows found</p>
            <button onClick={() => router.push('/automation/workflows/create')}
              className="btn-primary inline-flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Create First Workflow
            </button>
          </div>
        ) : (
          workflows.map((wf) => (
            <div key={wf._id} className="bg-card rounded-xl border border-border/50 overflow-hidden hover:shadow-premium transition-all">
              <div className="p-5 cursor-pointer flex items-center justify-between"
                onClick={() => setExpandedId(expandedId === wf._id ? null : wf._id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 className="text-base font-semibold text-foreground">{wf.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${wf.enabled
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'}`}>
                      {wf.enabled ? '● Active' : '○ Inactive'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      {triggerLabel(wf.trigger)}
                    </span>
                  </div>
                  {wf.description && <p className="text-sm text-muted-foreground truncate">{wf.description}</p>}
                  <div className="flex gap-5 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span>Executions: <b className="text-foreground">{wf.executionCount || 0}</b></span>
                    <span>Success: <b className="text-emerald-600">{wf.successCount || 0}</b></span>
                    <span>Failed: <b className="text-destructive">{wf.failureCount || 0}</b></span>
                    {wf.lastExecutedAt && <span>Last: {new Date(wf.lastExecutedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground ml-4 shrink-0 transition-transform ${expandedId === wf._id ? 'rotate-180' : ''}`} />
              </div>

              {expandedId === wf._id && (
                <div className="border-t border-border p-5 bg-muted/30">
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Trigger Type</p>
                      <p className="text-sm font-semibold text-foreground">{wf.trigger}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Daily Limit</p>
                      <p className="text-sm font-semibold text-foreground">{wf.dailyExecutionLimit || 'Unlimited'}</p>
                    </div>
                  </div>

                  {wf.condition && Object.keys(wf.condition).length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs text-muted-foreground mb-1.5">Condition</p>
                      <pre className="bg-card rounded-xl p-3 text-xs font-mono text-foreground overflow-auto max-h-32">
                        {JSON.stringify(wf.condition, null, 2)}
                      </pre>
                    </div>
                  )}

                  {wf.actions?.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs text-muted-foreground mb-1.5">Actions ({wf.actions.length})</p>
                      <div className="space-y-2">
                        {wf.actions.map((action, idx) => (
                          <div key={idx} className="bg-card rounded-xl p-3">
                            <p className="text-sm font-semibold text-foreground mb-1">{idx + 1}. {action.type}</p>
                            <pre className="text-xs font-mono text-muted-foreground overflow-auto max-h-16">
                              {JSON.stringify(action, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={(e) => toggleWorkflow(wf._id, e)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${wf.enabled
                        ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'}`}>
                      {wf.enabled ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                      {wf.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <Link href={`/automation/workflows/view/${wf._id}`}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-xl text-sm font-medium transition-colors">
                      <Eye className="h-4 w-4" /> View
                    </Link>
                    <Link href={`/automation/workflows/edit/${wf._id}`}
                      className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 rounded-xl text-sm font-medium transition-colors">
                      <Pencil className="h-4 w-4" /> Edit
                    </Link>
                    <button onClick={(e) => deleteWorkflow(wf._id, e)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl text-sm font-medium transition-colors">
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
