'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  generateAnswerBotFAQs,
  getAnswerBotFAQs,
  approveAnswerBotFAQs,
  deleteAnswerBotFAQ,
  getAnswerBotSources,
  getAnswerBotSettings,
  updateAnswerBotSettings,
  addAnswerBotSource
} from '@/lib/api';
import PageLoader from '@/components/ui/PageLoader';
import PageHeader from '@/components/shared/PageHeader';
import { useAuthStore } from '@/store/authStore';
import { Bot, Save, Plus, Link as LinkIcon, FileText, Database, ShieldAlert, Sparkles, X, ChevronDown, Check, HelpCircle } from 'lucide-react';
import { toast } from '@/lib/toast';

export default function AnswerBotPage() {
  const params = useParams();
  const workspace = useAuthStore(state => state.workspace);
  const authUser = useAuthStore(state => state.user);
  const authLoading = useAuthStore(state => state.loading);
  const [workspaceId, setWorkspaceId] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState('knowledge_base'); // 'knowledge_base' or 'settings'

  // Data
  const [settings, setSettings] = useState(null);
  const [sources, setSources] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Settings Form
  const [savingSettings, setSavingSettings] = useState(false);

  // Add Source Modal/State
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceType, setSourceType] = useState('url'); // 'url', 'text', 'document'
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceData, setNewSourceData] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  // FAQ approvals
  const [approving, setApproving] = useState(false);
  const [selectedFaqIds, setSelectedFaqIds] = useState(new Set());
  const [expandedFaqIds, setExpandedFaqIds] = useState(new Set());

  useEffect(() => {
    if (authLoading) return;

    // Resolve Workspace ID strictly: Params -> Store Object -> User Field -> LocalStorage
    let id = params?.workspaceId || workspace?.id || authUser?.workspace;

    if (!id && typeof window !== 'undefined') {
      const keys = ['workspaceId', 'workspace', 'currentWorkspace', 'selectedWorkspace'];
      for (const k of keys) {
        let val = localStorage.getItem(k);
        if (val) {
          try {
            val = JSON.parse(val);
            if (val && (val._id || val.id)) id = val._id || val.id;
            else if (typeof val === 'string') id = val;
          } catch (e) {
            id = val;
          }
          if (id) break;
        }
      }
    }

    if (id) {
      setWorkspaceId(id);
    } else {
      setLoading(false);
    }
  }, [params, workspace?.id, authUser?.workspace, authLoading]);

  useEffect(() => {
    if (workspaceId) {
      loadInitialData();
    }
  }, [workspaceId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, sourcesRes, faqsRes] = await Promise.all([
        getAnswerBotSettings(workspaceId),
        getAnswerBotSources(workspaceId),
        getAnswerBotFAQs(workspaceId)
      ]);

      if (settingsRes.success) setSettings(settingsRes.settings);
      if (sourcesRes.success) setSources(sourcesRes.sources || []);
      if (faqsRes.faqs) setFaqs(faqsRes.faqs);

    } catch (err) {
      console.error('Failed to load AnswerBot data', err);
      toast?.error?.('Failed to load AnswerBot settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await updateAnswerBotSettings(workspaceId, settings);
      if (res.success) {
        toast?.success?.('AnswerBot Settings updated successfully');
      }
    } catch (err) {
      toast?.error?.('Error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSourceData.trim()) return toast?.error?.('Please provide the source content.');

    setAddingSource(true);
    try {
      let payload = { sourceType, title: newSourceTitle };
      if (sourceType === 'url') {
        payload.websiteUrl = newSourceData;

        // Also trigger FAQ generation for URL
        const genRes = await generateAnswerBotFAQs(workspaceId, { websiteUrl: newSourceData });
        if (genRes.success && genRes.faqs) {
          setFaqs([...faqs, ...genRes.faqs]);
        }
      } else if (sourceType === 'text') {
        payload.textContent = newSourceData;
      } else if (sourceType === 'document') {
        payload.documentData = { fileUrl: newSourceData, fileName: newSourceTitle || 'Document' }; // Mock URL mapping
      }

      const res = await addAnswerBotSource(workspaceId, payload);
      if (res.success) {
        setSources([res.source, ...sources]);
        setShowAddSource(false);
        setNewSourceData('');
        setNewSourceTitle('');
        toast?.success?.('Source added to Knowledge Base');
      }
    } catch (err) {
      toast?.error?.(err.message || 'Error adding source');
    } finally {
      setAddingSource(false);
    }
  };

  const toggleFaqSelection = (id) => {
    const updated = new Set(selectedFaqIds);
    updated.has(id) ? updated.delete(id) : updated.add(id);
    setSelectedFaqIds(updated);
  };

  const handleApproveFAQs = async () => {
    if (selectedFaqIds.size === 0) return;
    setApproving(true);
    try {
      const res = await approveAnswerBotFAQs(workspaceId, Array.from(selectedFaqIds));
      if (res.success) {
        toast?.success?.(`Approved ${selectedFaqIds.size} FAQs`);
        setFaqs(faqs.filter(f => !selectedFaqIds.has(f._id)));
        setSelectedFaqIds(new Set());
      }
    } catch (err) {
      toast?.error?.('Error approving FAQs');
    } finally {
      setApproving(false);
    }
  };

  if (loading) return <PageLoader message="Loading Smart ReplyBot..." />;
  
  if (!workspaceId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Workspace not identified</h2>
        <p className="text-slate-500 max-w-md mb-8">
          We couldn't resolve which workspace to load settings for. This usually happens if the session is stale.
        </p>
        <div className="flex gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            Reload Page
          </button>
          <button 
            onClick={() => useAuthStore.getState().fetchSession(true)}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg transition-all"
          >
            Re-sync Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12 animate-in fade-in duration-700">
      <div className="max-w-[1200px] mx-auto px-6">

        <PageHeader
          icon={Bot}
          title="Smart AnswerBot"
          subtitle="Define a persona and upload knowledge to automatically resolve customer queries."
        />

        {/* Global Enable Toggle */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              AnswerBot is currently {settings?.enabled ? <span className="text-emerald-600">Active</span> : <span className="text-slate-400">Offline</span>}
            </h3>
            <p className="text-slate-500 text-sm mt-1">When active, the bot will intercept incoming queries and attempt to resolve them using the Knowledge Base.</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, enabled: !settings?.enabled })}
            className={`relative w-16 h-8 rounded-full transition-colors ${settings?.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${settings?.enabled ? 'left-9' : 'left-1'}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-8 gap-8">
          <button
            onClick={() => setActiveTab('knowledge_base')}
            className={`pb-4 font-bold transition-all relative ${activeTab === 'knowledge_base' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Knowledge Base
            {activeTab === 'knowledge_base' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-4 font-bold transition-all relative ${activeTab === 'settings' ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Bot Settings & Persona
            {activeTab === 'settings' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
          </button>
        </div>

        {/* TAB 1: KNOWLEDGE BASE */}
        {activeTab === 'knowledge_base' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-bold text-slate-900">Data Sources</h3>
                  <div className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 border border-slate-200">
                    Sources Used: {sources.length} / {(workspace?.plan === 'free' || workspace?.plan === 'trial') ? 4 : 6}
                  </div>
                </div>
                <p className="text-sm text-slate-500">Provide links and documents for the AI to learn from.</p>
              </div>
              <div className="flex items-center gap-4">
                <a 
                  href="https://help.interakt.ai/resource-center/whatsapp-answerbot" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:text-slate-900 text-sm font-bold transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                  Resource Center → WhatsApp AnswerBot
                </a>
                <button
                  onClick={() => setShowAddSource(true)}
                  disabled={sources.length >= ((workspace?.plan === 'free' || workspace?.plan === 'trial') ? 4 : 6)}
                  className="bg-primary hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Source
                </button>
              </div>
            </div>

            {/* Sources Table */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              {sources.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No sources added yet. Click "Add Source" to start training your bot.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Source Name / Content</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sources.map(src => (
                        <tr key={src._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {src.sourceType === 'url' && <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit text-sm font-bold"><LinkIcon className="w-4 h-4" /> URL</div>}
                            {src.sourceType === 'document' && <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-fit text-sm font-bold"><Database className="w-4 h-4" /> Document</div>}
                            {src.sourceType === 'text' && <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit text-sm font-bold"><FileText className="w-4 h-4" /> Text</div>}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800">{src.title || src.websiteUrl}</p>
                            <p className="text-xs text-slate-400 max-w-md truncate">{src.websiteUrl || src.textContent || src.documentData?.fileUrl}</p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${src.crawlStatus === 'failed' ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
                              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                {src.crawlStatus || 'completed'}
                              </span>
                            </div>
                            {src.faqCount > 0 && <p className="text-[10px] text-slate-400 mt-0.5 ml-3.5">{src.faqCount} FAQs indexed</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Existing Scraped FAQs Awaiting Approval */}
            {faqs.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center justify-between mb-4 border-t border-slate-200 pt-8">
                  <h3 className="text-lg font-bold text-slate-900">Extracted FAQs (Draft)</h3>
                  <button
                    onClick={handleApproveFAQs}
                    disabled={selectedFaqIds.size === 0 || approving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2 rounded-xl font-bold transition-all flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Approve Selected ({selectedFaqIds.size})
                  </button>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-sm text-yellow-800">
                  These FAQs were automatically extracted from your URL sources. Approve them to inject them definitively into the Bot's Knowledge Base.
                </div>
                <div className="space-y-3">
                  {faqs.map(faq => (
                    <div key={faq._id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="p-4 flex items-center gap-4">
                        <input type="checkbox" checked={selectedFaqIds.has(faq._id)} onChange={() => toggleFaqSelection(faq._id)} className="w-4 h-4 accent-primary" />
                        <div className="flex-1 cursor-pointer" onClick={() => setExpandedFaqIds(prev => { const n = new Set(prev); n.has(faq._id) ? n.delete(faq._id) : n.add(faq._id); return n; })}>
                          <h4 className="font-bold text-slate-800">{faq.question}</h4>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedFaqIds.has(faq._id) ? 'rotate-180' : ''}`} />
                      </div>
                      {expandedFaqIds.has(faq._id) && (
                        <div className="px-12 pb-4 pt-2 text-sm text-slate-600 border-t border-slate-50 bg-slate-50">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="animate-in fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Bot Persona</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Bot Name</label>
                  <input
                    type="text"
                    value={settings?.personaName || ''}
                    onChange={e => setSettings({ ...settings, personaName: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-xs text-slate-400 mt-2">The name visible to the customer if handoff is announced.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">AI Processing Model</label>
                  <select
                    value={settings?.aiModel || 'gpt-3.5-turbo'}
                    onChange={e => setSettings({ ...settings, aiModel: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fastest)</option>
                    <option value="claude-3-haiku">Claude 3 Haiku (Best Tone)</option>
                    <option value="gpt-4">GPT-4 (Most Advanced)</option>
                  </select>
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-bold text-slate-700 mb-2">System Instructions (Prompt)</label>
                <textarea
                  rows={4}
                  value={settings?.systemPrompt || ''}
                  onChange={e => setSettings({ ...settings, systemPrompt: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                  placeholder="You are a helpful assistant..."
                />
              </div>

              <hr className="border-slate-100 my-8" />

              <div className="flex items-center gap-2 mb-6">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h3 className="text-xl font-bold text-slate-900">Fallback & Handover</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">If bot doesn't know the answer:</label>
                  <select
                    value={settings?.fallbackAction || 'send_fallback_message'}
                    onChange={e => setSettings({ ...settings, fallbackAction: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="send_fallback_message">Send Custom Message</option>
                    <option value="assign_to_agent">Assign to Human Agent immediately</option>
                  </select>
                </div>
              </div>

              {settings?.fallbackAction === 'send_fallback_message' && (
                <div className="mb-8 p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <label className="block text-sm font-bold text-amber-900 mb-2">Fallback Message</label>
                  <textarea
                    rows={2}
                    value={settings?.fallbackMessage || ''}
                    onChange={e => setSettings({ ...settings, fallbackMessage: e.target.value })}
                    className="w-full border border-amber-200 rounded-xl p-3 focus:outline-none focus:border-amber-400 resize-none bg-white"
                  />
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-100 mt-8">
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="bg-primary hover:bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  {savingSettings ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Add Source Modal */}
      {showAddSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Add Knowledge Source</h2>
              <button onClick={() => setShowAddSource(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Source Type</label>
                <div className="flex border border-slate-200 rounded-xl overflow-hidden p-1 bg-slate-50">
                  {['url', 'text', 'document'].map(t => (
                    <button key={t} onClick={() => setSourceType(t)} className={`flex-1 py-2 text-sm font-bold rounded-lg capitalize transition-colors ${sourceType === t ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Internal Title (Optional)</label>
                <input type="text" value={newSourceTitle} onChange={e => setNewSourceTitle(e.target.value)} placeholder="e.g., Return Policy 2024" className="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-primary" />
              </div>

              {sourceType === 'url' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Website URL</label>
                  <input type="url" value={newSourceData} onChange={e => setNewSourceData(e.target.value)} placeholder="https://example.com/faqs" className="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-primary" />
                  <p className="text-xs text-slate-400 mt-2">The bot will crawl this page and auto-generate FAQs.</p>
                </div>
              )}

              {sourceType === 'text' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Raw Text</label>
                  <textarea rows={5} value={newSourceData} onChange={e => setNewSourceData(e.target.value)} placeholder="Paste any text payload here for the AI to read..." className="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-primary resize-none" />
                </div>
              )}

              {sourceType === 'document' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Document URL</label>
                  <input type="url" value={newSourceData} onChange={e => setNewSourceData(e.target.value)} placeholder="https://storage.etc/file.pdf" className="w-full border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-primary" />
                  <p className="text-xs text-slate-400 mt-2">MVP: Paste a public link to the PDF or Document.</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 rounded-b-3xl flex justify-end gap-3">
              <button onClick={() => setShowAddSource(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleAddSource} disabled={addingSource} className="bg-primary hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all">
                {addingSource ? 'Saving...' : 'Add to Knowledge Base'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}