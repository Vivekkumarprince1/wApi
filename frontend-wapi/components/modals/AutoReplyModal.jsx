import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Zap, MessageSquare, AlertCircle } from 'lucide-react';
import { get, post, put } from '@/lib/api';
import { toast } from '@/lib/toast';

export default function AutoReplyModal({ isOpen, onClose, autoReplyId, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  
  const [form, setForm] = useState(getDefaultForm());

  function getDefaultForm() {
    return {
      name: '',
      category: 'auto_reply',
      enabled: true,
      priority: 10,
      trigger: {
        event: 'customer.message.received',
        filters: {
          keywords: [''],
          keywordMatchMode: 'contains',
          businessHoursOnly: false
        }
      },
      actions: [
        {
          type: 'send_template_message',
          config: {
            templateId: '',
            templateName: '',
            templateLanguage: 'en',
            templateVariables: {}
          },
          order: 0
        }
      ]
    };
  }

  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      setForm(getDefaultForm());
    }
  }, [isOpen, autoReplyId]);

  const loadData = async () => {
    setInitLoading(true);
    try {
      const [{ templates: tpls }, ruleRes] = await Promise.all([
        get('/templates'),
        autoReplyId ? get(`/automation/engine/rules/${autoReplyId}`) : Promise.resolve(null)
      ]);

      setTemplates((tpls || []).filter(t => t.status === 'APPROVED'));

      if (ruleRes?.success) {
        const rule = ruleRes.data;
        setForm({
          name: rule.name || '',
          category: 'auto_reply',
          enabled: rule.enabled !== false,
          priority: rule.priority || 10,
          trigger: {
            event: rule.trigger?.event || 'customer.message.received',
            filters: {
              keywords: rule.trigger?.filters?.keywords?.length ? rule.trigger?.filters?.keywords : [''],
              keywordMatchMode: rule.trigger?.filters?.keywordMatchMode || 'contains',
              businessHoursOnly: rule.trigger?.filters?.businessHoursOnly || false
            }
          },
          actions: rule.actions?.length ? rule.actions : getDefaultForm().actions
        });
      }
    } catch (err) {
      toast?.error?.('Failed to load data');
    } finally {
      setInitLoading(false);
    }
  };

  const updateKeyword = (idx, val) => {
    const keywords = [...form.trigger.filters.keywords];
    keywords[idx] = val;
    setForm({ ...form, trigger: { ...form.trigger, filters: { ...form.trigger.filters, keywords } } });
  };

  const addKeyword = () => {
    if (form.trigger.filters.keywords.length >= 10) return;
    setForm({ ...form, trigger: { ...form.trigger, filters: { ...form.trigger.filters, keywords: [...form.trigger.filters.keywords, ''] } } });
  };

  const removeKeyword = (idx) => {
    const keywords = form.trigger.filters.keywords.filter((_, i) => i !== idx);
    setForm({ ...form, trigger: { ...form.trigger, filters: { ...form.trigger.filters, keywords: keywords.length ? keywords : [''] } } });
  };

  const handleTemplateChange = (templateId) => {
    const template = templates.find(t => t._id === templateId);
    if (!template) {
       setForm({
        ...form,
        actions: [{ ...form.actions[0], config: { ...form.actions[0].config, templateId: '', templateName: '', templateLanguage: 'en' } }]
      });
      return;
    }

    setForm({
      ...form,
      actions: [{
        ...form.actions[0],
        config: {
          ...form.actions[0].config,
          templateId,
          templateName: template.name,
          templateLanguage: template.language || 'en'
        }
      }]
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      return toast?.error?.('Please provide a name for this auto-reply');
    }
    
    if (!form.trigger.filters.businessHoursOnly) {
      const validKw = form.trigger.filters.keywords.filter(k => k.trim());
      if (validKw.length === 0) {
        return toast?.error?.('At least one trigger keyword is required');
      }
    }

    if (!form.actions[0].config.templateId) {
      return toast?.error?.('Please select a response template');
    }

    setLoading(true);
    try {
      const finalForm = { ...form };
      if (!finalForm.trigger.filters.businessHoursOnly) {
        finalForm.trigger.filters.keywords = finalForm.trigger.filters.keywords.filter(k => k.trim());
      }

      let res;
      if (autoReplyId) {
        res = await put(`/automation/engine/rules/${autoReplyId}`, finalForm);
      } else {
        res = await post('/automation/engine/rules', finalForm);
      }

      if (res.success) {
        toast?.success?.(autoReplyId ? 'Auto-reply updated' : 'Auto-reply created');
        onSuccess(res.data);
        onClose();
      }
    } catch (err) {
      toast?.error?.(err.message || 'Failed to save auto-reply');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
      <div className="w-full max-w-[600px] h-full bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-8 py-6 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {autoReplyId ? 'Edit Custom Reply' : 'Add new Custom Reply'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">Send immediate template responses.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {initLoading ? (
            <div className="flex flex-col items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-slate-500">Loading settings...</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Basics */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <label className="block text-sm font-bold text-slate-900 mb-2">Reply Name</label>
                <input 
                  type="text" 
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Pricing Inquiry"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              {/* Trigger */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Zap className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-slate-900">Configure Trigger</h3>
                </div>

                <div className="flex gap-4 mb-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      className="accent-primary w-4 h-4"
                      checked={!form.trigger.filters.businessHoursOnly}
                      onChange={() => setForm({ ...form, trigger: { ...form.trigger, filters: { ...form.trigger.filters, businessHoursOnly: false } } })}
                    />
                    <span className="text-sm font-medium text-slate-800">Keyword Match</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      className="accent-primary w-4 h-4"
                      checked={form.trigger.filters.businessHoursOnly}
                      onChange={() => setForm({ ...form, trigger: { ...form.trigger, filters: { ...form.trigger.filters, businessHoursOnly: true } } })}
                    />
                    <span className="text-sm font-medium text-slate-800">Away (After Hours)</span>
                  </label>
                </div>

                {!form.trigger.filters.businessHoursOnly && (
                  <div className="space-y-5 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Match Type</label>
                      <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                        {['exact', 'contains', 'starts_with'].map(m => (
                          <button
                            key={m}
                            onClick={() => setForm({ ...form, trigger: { ...form.trigger, filters: { ...form.trigger.filters, keywordMatchMode: m } } })}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${form.trigger.filters.keywordMatchMode === m ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            {m.replace('_', ' ').toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">If customer says:</label>
                      <div className="space-y-2">
                        {form.trigger.filters.keywords.map((kw, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input 
                              type="text" 
                              value={kw}
                              onChange={e => updateKeyword(idx, e.target.value)}
                              placeholder={`Keyword or phrase...`}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                            />
                            {form.trigger.filters.keywords.length > 1 && (
                              <button onClick={() => removeKeyword(idx)} className="p-2.5 text-slate-400 hover:text-red-500 bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {form.trigger.filters.keywords.length < 10 && (
                        <button onClick={addKeyword} className="mt-3 text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                          <Plus className="w-3 h-3" /> Add keyword variation
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <MessageSquare className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-base font-bold text-slate-900">Configure Response</h3>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Send WhatsApp Template</label>
                  <select 
                    value={form.actions[0].config.templateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  >
                    <option value="">Select a template...</option>
                    {templates.map(t => (
                      <option key={t._id} value={t._id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-200 bg-white flex justify-end gap-3 z-10">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading || initLoading}
            className="bg-primary hover:bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 text-sm disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  );
}
