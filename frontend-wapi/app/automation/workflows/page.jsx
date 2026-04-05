'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Search, ChevronDown, Eye, Pencil, Trash2, ToggleLeft, ToggleRight, Workflow, RotateCcw
} from 'lucide-react';
import { get, post, del, patch } from '@/lib/api';
import PageLoader from '@/components/ui/PageLoader';
import PageHeader from '@/components/shared/PageHeader';

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
      const response = await get(`/automation/engine/rules?${params.toString()}`);
      
      // Handle the wrapped response structure { success: true, data: { rules: [], pagination: {} } }
      let list = [];
      if (response && response.success && response.data) {
        list = Array.isArray(response.data.rules) ? response.data.rules : [];
      } else if (Array.isArray(response)) {
        list = response;
      } else if (Array.isArray(response?.rules)) {
        list = response.rules;
      }
      
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
      const workflow = workflows.find(w => w._id === id);
      await patch(`/automation/engine/rules/${id}/toggle`, { enabled: !workflow.enabled });
      setWorkflows(workflows.map(w => w._id === id ? { ...w, enabled: !w.enabled } : w));
    } catch (err) {
      console.error('Error toggling workflow:', err);
    }
  };

  const deleteWorkflow = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await del(`/automation/engine/rules/${id}`);
      setWorkflows(workflows.filter(w => w._id !== id));
    } catch (err) {
      console.error('Error deleting workflow:', err);
    }
  };

  const triggerLabel = (trigger) => {
    const eventType = typeof trigger === 'string' ? trigger : trigger?.event;
    const map = {
      message_received: '📨 Message', 
      'customer.message.received': '📨 Message',
      status_updated: '📊 Status', 
      keyword: '🔑 Keyword',
      tag_added: '🏷️ Tag', 
      campaign_completed: '🎯 Campaign', 
      ad_lead: '📱 Ad Lead'
    };
    return map[eventType] || eventType || 'Unknown Trigger';
  };

  if (loading) return <PageLoader message="Loading workflows..." />;

  return (
    <div className="min-h-screen bg-slate-50 pb-12 animate-in fade-in duration-700">
      <div className="max-w-[1400px] mx-auto px-6">
        <PageHeader
          icon={Workflow}
          title="Automation Workflows"
          subtitle="Design sophisticated WhatsApp chatbots and logic flows."
          actions={
            <button 
              onClick={() => router.push('/automation/workflows/builder/create')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all active:scale-95"
            >
              <Plus className="h-5 w-5" /> Design New Workflow
            </button>
          }
        />

        {/* Status Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Flows</p>
            <p className="text-2xl font-bold text-slate-900">{workflows.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Active Now</p>
            <p className="text-2xl font-bold text-slate-900">{workflows.filter(w => w.enabled).length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Total Executions</p>
            <p className="text-2xl font-bold text-slate-900">{workflows.reduce((acc, w) => acc + (w.executionCount || 0), 0)}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Success</p>
            <p className="text-2xl font-bold text-slate-900">98.2%</p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 mb-8 shadow-sm flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or description..." 
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full bg-slate-50 border-none rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 ring-primary/20 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select 
              value={filters.trigger} 
              onChange={(e) => setFilters({ ...filters, trigger: e.target.value })}
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm outline-none cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <option value="all">Any Trigger</option>
              <option value="message_received">Message Received</option>
              <option value="keyword">Keyword Match</option>
              <option value="tag_added">Tag Added</option>
            </select>
            <select 
              value={filters.enabled} 
              onChange={(e) => setFilters({ ...filters, enabled: e.target.value })}
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm outline-none cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <option value="all">Any Status</option>
              <option value="true">Active Only</option>
              <option value="false">Paused Only</option>
            </select>
          </div>
        </div>

        {/* Workflows List */}
        <div className="grid grid-cols-1 gap-4">
          {workflows.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 py-24 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Workflow className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No flows designed yet</h3>
              <p className="text-slate-500 mb-8 max-w-sm mx-auto">Create your first automated conversation flow to start saving time and engaging leads.</p>
              <button 
                onClick={() => router.push('/automation/workflows/builder/create')}
                className="bg-primary text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
              >
                + Design Your First Flow
              </button>
            </div>
          ) : (
            workflows.map((wf) => (
              <div 
                key={wf._id} 
                className="group bg-white rounded-3xl border border-slate-200 hover:border-primary/50 hover:shadow-premium transition-all p-2 pr-6"
              >
                <div className="flex items-center gap-6">
                  {/* Visual Icon */}
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-xl shadow-inner ${
                    wf.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {wf.enabled ? <Workflow /> : <ToggleLeft />}
                  </div>

                  <div className="flex-1 py-4">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">{wf.name}</h3>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        wf.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {wf.enabled ? 'Live' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1">{wf.description || 'Automating your business logic...'}</p>
                  </div>

                  {/* Performance Data */}
                  <div className="hidden lg:flex items-center gap-12 px-8 border-x border-slate-50">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Runs</p>
                      <p className="text-sm font-bold text-slate-900">{wf.executionCount || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Success</p>
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                           <div className="bg-emerald-500 h-full rounded-full" style={{ width: '98%' }} />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600">98%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Trigger</p>
                      <p className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {triggerLabel(wf.trigger)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => toggleWorkflow(wf._id, e)}
                      title={wf.enabled ? "Pause Flow" : "Activate Flow"}
                      className={`p-3 rounded-2xl transition-colors ${
                        wf.enabled ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      {wf.enabled ? <ToggleLeft size={20} /> : <ToggleRight size={20} />}
                    </button>
                    <Link 
                      href={`/automation/workflows/builder/${wf._id}`}
                      className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-2xl transition-colors"
                      title="View Analytics"
                    >
                      <Eye size={20} />
                    </Link>
                    <Link 
                      href={`/automation/workflows/builder/${wf._id}`}
                      className="p-3 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-2xl transition-colors"
                      title="Edit Flow"
                    >
                      <Pencil size={20} />
                    </Link>
                    <button 
                      onClick={(e) => deleteWorkflow(wf._id, e)}
                      className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

}
