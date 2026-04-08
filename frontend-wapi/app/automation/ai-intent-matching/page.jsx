'use client';

import { useState, useEffect } from 'react';
import { 
  Bot, Sparkles, ShieldCheck, ToggleLeft, ToggleRight, 
  History, Info, Zap, AlertCircle, CheckCircle2, ChevronRight,
  TrendingUp, Activity, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { get, patch } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import FlashLoader from '@/components/ui/FlashLoader';
import toast from 'react-hot-toast';

export default function AiIntentMatchingPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalResolutions: 0, resolutionRate: 0, activeRules: 0 });
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ enabled: false, threshold: 0.7 });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsRes, statsRes, logsRes] = await Promise.all([
        get('/automation/engine/ai-settings'),
        get('/automation/engine/ai-stats'),
        get('/automation/engine/ai-logs')
      ]);

      if (settingsRes.success) setSettings(settingsRes.data);
      if (statsRes.success) setStats(statsRes.data);
      if (logsRes.success) setLogs(logsRes.data);
    } catch (error) {
      console.error('Failed to fetch AI data:', error);
      toast.error('Could not load AI settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleAiMatcher = async () => {
    try {
      setIsUpdating(true);
      const newStatus = !settings.enabled;
      const res = await patch('/automation/engine/ai-settings', { enabled: newStatus });
      
      if (res.success) {
        setSettings({ ...settings, enabled: newStatus });
        toast.success(`AI Intent Match ${newStatus ? 'Activated' : 'Deactivated'}`);
      }
    } catch (error) {
      toast.error('Action failed');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <FlashLoader />;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 animate-in fade-in duration-500">
      <div className="max-w-[1200px] mx-auto px-6">
        <PageHeader 
          icon={Bot}
          title="AI Intent Match"
          subtitle="Upgrade your workflows with natural language semantic understanding."
        />

        {/* Hero Section: Enable/Disable */}
        <div className="relative overflow-hidden bg-white rounded-[2.5rem] border border-slate-200 p-8 mb-8 shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-20 -mt-20 opacity-40 blur-3xl animate-pulse" />
          
          <div className="relative flex flex-col md:flex-row items-center gap-8">
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-4xl shadow-プレミアム ${
              settings.enabled ? 'bg-indigo-600 text-white animate-bounce-subtle' : 'bg-slate-100 text-slate-400'
            }`}>
              <Sparkles className={settings.enabled ? 'animate-pulse' : ''} />
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                <h2 className="text-2xl font-bold text-slate-900">Smart Automation Layer</h2>
                {settings.enabled ? (
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Zap size={12} className="fill-indigo-700" /> Active
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
                When enabled, Interakt analyzes the semantic intent of incoming messages. If no exact keyword matches, 
                AI automatically triggers the most relevant workflow.
              </p>
            </div>

            <button 
              onClick={toggleAiMatcher}
              disabled={isUpdating}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg ${
                settings.enabled 
                ? 'bg-red-50 text-red-600 hover:bg-red-100 shadow-red-100' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
              }`}
            >
              {isUpdating ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : settings.enabled ? (
                <>Disable AI Match</>
              ) : (
                <>Enable AI Intent Match</>
              )}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resolution Uplift</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">+{stats.resolutionRate}%</p>
            <p className="text-[10px] text-slate-400 mt-1">Increase in auto-matches vs keywords</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Activity size={20} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Semantic Matches</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">{stats.totalResolutions}</p>
            <p className="text-[10px] text-slate-400 mt-1">Queries resolved by AI Intent Match</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <ShieldCheck size={20} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confidence Floor</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">70%</p>
            <p className="text-[10px] text-slate-400 mt-1">Min threshold for AI to trigger rules</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="text-slate-400" size={20} />
              <h3 className="font-bold text-slate-900">Recent AI Conversions</h3>
            </div>
            <button className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
              Download CSV Report
            </button>
          </div>

          <div className="divide-y divide-slate-50">
            {logs.length === 0 ? (
              <div className="p-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="text-slate-300" size={32} />
                </div>
                <p className="text-slate-500 font-medium tracking-tight">No semantic matches recorded yet.</p>
                <p className="text-[10px] text-slate-400 mt-1">Enable AI Match and send a message to see it work!</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log._id} className="p-6 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-6">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 mb-1 italic">"{log.queryText}"</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-indigo-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Matched to:</span>
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {log.matchedRule?.name || 'Rule'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <div className="w-20 bg-slate-100 h-1 rounded-full overflow-hidden">
                           <div 
                             className="bg-indigo-600 h-full rounded-full" 
                             style={{ width: `${(log.confidence || 0.8) * 100}%` }} 
                           />
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600">
                          {Math.round((log.confidence || 0.8) * 100)}% Match
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </p>
                    </div>

                    <button className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100 shadow-sm transition-all">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Limitations Footer */}
        <div className="mt-8 flex items-center gap-4 bg-amber-50/50 border border-amber-100 p-4 rounded-2xl">
          <Info className="text-amber-500" size={20} />
          <p className="text-[11px] text-amber-700 leading-normal">
            <strong>Note:</strong> AI Intent Match behaves as a fallback. Traditional Keyword rules (Exact/Contains) 
            take priority. Multilingual support (Hindi, Marathi, etc.) is active by default.
          </p>
        </div>
      </div>
    </div>
  );
}
