'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FaArrowLeft, FaPlus, FaTrash, FaSave, FaRobot, FaFilter, FaBolt, FaPlusCircle,
  FaCheckCircle, FaExclamationTriangle, FaClock, FaTag, FaUserPlus, FaLink, FaCommentDots
} from 'react-icons/fa';
import Link from 'next/link';
import { post, get } from '@/lib/api';
import { toast } from 'react-toastify';

export default function CreateWorkflowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger: {
      event: 'customer.message.received',
      filters: {
        channel: 'all',
        messageTypes: [],
        keywords: [],
        source: 'all',
        businessHoursOnly: false
      }
    },
    conditions: [],
    actions: [],
    rateLimit: {
      maxExecutions: 100,
      windowSeconds: 3600,
      perContactCooldown: 300,
      maxPerContactPerDay: 10
    },
    enabled: true
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await get('/templates');
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const triggerEvents = [
    { value: 'customer.message.received', label: '📨 Customer Message Received', icon: FaCommentDots },
    { value: 'conversation.created', label: '🆕 New Conversation Started', icon: FaBolt },
    { value: 'first.agent.reply', label: '👤 First Agent Reply', icon: FaUserPlus },
    { value: 'conversation.closed', label: '✅ Conversation Closed', icon: FaCheckCircle },
    { value: 'sla.breached', label: '⚠️ SLA Breached', icon: FaExclamationTriangle },
    { value: 'contact.created', label: '👤 New Contact Created', icon: FaUserPlus },
    { value: 'contact.tag.added', label: '🏷️ Tag Added to Contact', icon: FaTag }
  ];

  const actionTypes = [
    { value: 'send_template_message', label: '💬 Send Template', icon: FaCommentDots },
    { value: 'send_text_message', label: '✍️ Send Text (24h window)', icon: FaCommentDots },
    { value: 'assign_conversation', label: '👤 Assign to Agent/Team', icon: FaUserPlus },
    { value: 'add_tag', label: '🏷️ Add Tag', icon: FaTag },
    { value: 'remove_tag', label: '❌ Remove Tag', icon: FaTag },
    { value: 'add_note', label: '📝 Add Internal Note', icon: FaSave },
    { value: 'mark_as_resolved', label: '✅ Mark Resolved', icon: FaCheckCircle },
    { value: 'notify_webhook', label: '🔗 External Webhook', icon: FaLink },
    { value: 'delay', label: '⏱️ Delay Next Action', icon: FaClock }
  ];

  const conditionFields = [
    { value: 'message.content', label: 'Message Content' },
    { value: 'contact.tags', label: 'Contact Tags' },
    { value: 'contact.name', label: 'Contact Name' },
    { value: 'conversation.status', label: 'Conversation Status' },
    { value: 'conversation.assignedTo', label: 'Assigned Agent' },
    { value: 'message.type', label: 'Message Type' }
  ];

  const conditionOperators = [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' }
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const addCondition = () => {
    setForm({
      ...form,
      conditions: [...form.conditions, { field: 'message.content', operator: 'contains', value: '', logicalOperator: 'AND' }]
    });
  };

  const removeCondition = (idx) => {
    setForm({
      ...form,
      conditions: form.conditions.filter((_, i) => i !== idx)
    });
  };

  const updateCondition = (idx, field, value) => {
    const newConditions = [...form.conditions];
    newConditions[idx][field] = value;
    setForm({ ...form, conditions: newConditions });
  };

  const addAction = (type) => {
    const newAction = {
      type,
      config: {},
      order: form.actions.length,
      continueOnFailure: true
    };

    // Set default configs
    if (type === 'send_template_message') {
      newAction.config = { templateId: '', templateLanguage: 'en', templateVariables: {} };
    } else if (type === 'send_text_message') {
      newAction.config = { messageContent: '' };
    } else if (type === 'assign_conversation') {
      newAction.config = { assignTo: { type: 'round_robin' } };
    } else if (type === 'add_tag' || type === 'remove_tag') {
      newAction.config = { tagName: '' };
    } else if (type === 'add_note') {
      newAction.config = { noteContent: '' };
    } else if (type === 'delay') {
      newAction.config = { delayMinutes: 5 };
    } else if (type === 'notify_webhook') {
      newAction.config = { webhookUrl: '', method: 'POST' };
    }

    setForm({
      ...form,
      actions: [...form.actions, newAction]
    });
  };

  const removeAction = (idx) => {
    setForm({
      ...form,
      actions: form.actions.filter((_, i) => i !== idx).map((a, i) => ({ ...a, order: i }))
    });
  };

  const updateActionConfig = (idx, configUpdates) => {
    const newActions = [...form.actions];
    newActions[idx].config = { ...newActions[idx].config, ...configUpdates };
    setForm({ ...form, actions: newActions });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Workflow name is required');
    if (form.actions.length === 0) return setError('At least one action is required');

    setLoading(true);
    try {
      await post('/automation/rules', form);
      toast.success('Workflow created successfully');
      router.push('/automation/workflows');
    } catch (err) {
      setError(err.message || 'Error creating workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border mb-8">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/automation/workflows" className="p-2 hover:bg-muted rounded-full transition-colors">
              <FaArrowLeft className="text-muted-foreground" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Create New Workflow</h1>
              <p className="text-xs text-muted-foreground">Automate business logic and replies</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/automation/workflows')}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary flex items-center gap-2 py-2 text-sm shadow-lg shadow-primary/20"
            >
              {loading ? <FaRobot className="animate-spin" /> : <FaSave />}
              {loading ? 'Saving...' : 'Save Workflow'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 space-y-8">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-3 animate-shake">
            <FaExclamationTriangle className="text-destructive" />
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Configuration */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Step 1: Trigger */}
            <section className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
              <div className="px-6 py-4 bg-muted/30 border-b border-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <FaBolt />
                </div>
                <h2 className="font-bold text-foreground">1. When this happens...</h2>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block">Trigger Event</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {triggerEvents.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm({ ...form, trigger: { ...form.trigger, event: t.value } })}
                        className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                          form.trigger.event === t.value 
                            ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <t.icon className={`h-5 w-5 ${form.trigger.event === t.value ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-medium ${form.trigger.event === t.value ? 'text-primary' : 'text-foreground'}`}>
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FaFilter className="text-muted-foreground text-xs" />
                      <h3 className="text-sm font-semibold text-foreground">Trigger Filters</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Channel</label>
                      <select 
                        className="input-premium py-2 text-sm"
                        value={form.trigger.filters.channel}
                        onChange={(e) => setForm({ ...form, trigger: { ...form.trigger, filters: { ...form.trigger.filters, channel: e.target.value } } })}
                      >
                        <option value="all">All Channels</option>
                        <option value="whatsapp">WhatsApp Only</option>
                        <option value="instagram">Instagram Only</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Source</label>
                      <select 
                        className="input-premium py-2 text-sm"
                        value={form.trigger.filters.source}
                        onChange={(e) => setForm({ ...form, trigger: { ...form.trigger, filters: { ...form.trigger.filters, source: e.target.value } } })}
                      >
                        <option value="all">Any Source</option>
                        <option value="organic">Organic Only</option>
                        <option value="campaign">Campaign Replies</option>
                        <option value="ads">Ad Leads</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Step 2: Conditions */}
            <section className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
              <div className="px-6 py-4 bg-muted/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500">
                    <FaFilter />
                  </div>
                  <h2 className="font-bold text-foreground">2. And these conditions are met...</h2>
                </div>
                <button 
                  type="button" onClick={addCondition}
                  className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <FaPlusCircle /> Add Condition
                </button>
              </div>
              <div className="p-6">
                {form.conditions.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-border rounded-2xl bg-muted/20">
                    <p className="text-sm text-muted-foreground mb-2">No conditions added</p>
                    <p className="text-xs text-muted-foreground/60">This workflow will trigger for every event.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {form.conditions.map((cond, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-muted/30 rounded-xl border border-border/50 relative group">
                        <div className="flex-1 w-full space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Field</label>
                              <select 
                                className="input-premium py-1.5 text-xs"
                                value={cond.field}
                                onChange={(e) => updateCondition(idx, 'field', e.target.value)}
                              >
                                {conditionFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Operator</label>
                              <select 
                                className="input-premium py-1.5 text-xs"
                                value={cond.operator}
                                onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                              >
                                {conditionOperators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </div>
                          </div>
                          {!['is_empty', 'is_not_empty'].includes(cond.operator) && (
                            <div>
                              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Value</label>
                              <input 
                                type="text" className="input-premium py-1.5 text-xs"
                                placeholder="Enter value..."
                                value={cond.value}
                                onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => removeCondition(idx)}
                          className="p-2.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors sm:mb-0.5"
                        >
                          <FaTrash size={12} />
                        </button>
                        {idx < form.conditions.length - 1 && (
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 bg-violet-500 text-[10px] font-bold text-white rounded-md shadow-sm">
                            AND
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Step 3: Actions */}
            <section className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
              <div className="px-6 py-4 bg-muted/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <FaBolt />
                  </div>
                  <h2 className="font-bold text-foreground">3. Then execute these actions...</h2>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {actionTypes.map(a => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => addAction(a.value)}
                      className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                    >
                      <a.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-[10px] font-bold uppercase text-center text-muted-foreground group-hover:text-primary transition-colors leading-tight">
                        {a.label.split(' (')[0]}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="space-y-4 pt-4 border-t border-border/50">
                  {form.actions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No actions added yet.</p>
                    </div>
                  ) : (
                    form.actions.map((action, idx) => (
                      <div key={idx} className="p-5 bg-card border border-border rounded-2xl shadow-sm relative">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </div>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                              {actionTypes.find(a => a.value === action.type)?.label.split(' (')[0]}
                            </h3>
                          </div>
                          <button onClick={() => removeAction(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <FaTrash size={14} />
                          </button>
                        </div>

                        <div className="space-y-4">
                          {action.type === 'send_template_message' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Template</label>
                                <select 
                                  className="input-premium py-2 text-sm"
                                  value={action.config.templateId}
                                  onChange={(e) => updateActionConfig(idx, { templateId: e.target.value })}
                                >
                                  <option value="">Select a template...</option>
                                  {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Language</label>
                                <input 
                                  type="text" className="input-premium py-2 text-sm"
                                  value={action.config.templateLanguage}
                                  onChange={(e) => updateActionConfig(idx, { templateLanguage: e.target.value })}
                                  placeholder="e.g., en"
                                />
                              </div>
                            </div>
                          )}

                          {action.type === 'send_text_message' && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Message Body</label>
                              <textarea 
                                className="input-premium py-2 text-sm" rows="3"
                                value={action.config.messageContent}
                                onChange={(e) => updateActionConfig(idx, { messageContent: e.target.value })}
                                placeholder="Hi! How can we help you today?"
                              />
                              <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                                <FaExclamationTriangle /> This will only send if the 24-hour service window is open.
                              </p>
                            </div>
                          )}

                          {action.type === 'assign_conversation' && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Assignment Method</label>
                              <select 
                                className="input-premium py-2 text-sm"
                                value={action.config.assignTo?.type}
                                onChange={(e) => updateActionConfig(idx, { assignTo: { ...action.config.assignTo, type: e.target.value } })}
                              >
                                <option value="round_robin">Round Robin</option>
                                <option value="least_busy">Least Busy Agent</option>
                                <option value="agent">Specific Agent</option>
                              </select>
                            </div>
                          )}

                          {(action.type === 'add_tag' || action.type === 'remove_tag') && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tag Name</label>
                              <input 
                                type="text" className="input-premium py-2 text-sm"
                                value={action.config.tagName}
                                onChange={(e) => updateActionConfig(idx, { tagName: e.target.value })}
                                placeholder="e.g., Lead, Support, Urgent"
                              />
                            </div>
                          )}

                          {action.type === 'delay' && (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">Wait for</span>
                              <input 
                                type="number" className="input-premium py-1.5 px-3 text-xs w-24"
                                value={action.config.delayMinutes}
                                onChange={(e) => updateActionConfig(idx, { delayMinutes: parseInt(e.target.value) })}
                              />
                              <span className="text-xs text-muted-foreground">minutes before next action</span>
                            </div>
                          )}

                          {action.type === 'notify_webhook' && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook URL</label>
                              <input 
                                type="url" className="input-premium py-2 text-sm"
                                value={action.config.webhookUrl}
                                onChange={(e) => updateActionConfig(idx, { webhookUrl: e.target.value })}
                                placeholder="https://your-api.com/webhook"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar Settings */}
          <div className="space-y-8">
            <section className="bg-card rounded-2xl border border-border shadow-premium p-6">
              <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Workflow Info</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Workflow Name *</label>
                  <input 
                    type="text" className="input-premium py-2 text-sm"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Welcome New Leads"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
                  <textarea 
                    className="input-premium py-2 text-sm" rows="3"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Explain what this workflow does..."
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" id="enabled" 
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  <label htmlFor="enabled" className="text-sm font-medium text-foreground">Workflow Enabled</label>
                </div>
              </div>
            </section>

            <section className="bg-card rounded-2xl border border-border shadow-premium p-6">
              <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Safety & Limits</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Executions / Hour</label>
                  <input 
                    type="number" className="input-premium py-2 text-sm"
                    value={form.rateLimit.maxExecutions}
                    onChange={(e) => setForm({ ...form, rateLimit: { ...form.rateLimit, maxExecutions: parseInt(e.target.value) } })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Contact Cooldown (sec)</label>
                  <input 
                    type="number" className="input-premium py-2 text-sm"
                    value={form.rateLimit.perContactCooldown}
                    onChange={(e) => setForm({ ...form, rateLimit: { ...form.rateLimit, perContactCooldown: parseInt(e.target.value) } })}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Prevents same contact from triggering this rule too often.</p>
                </div>
              </div>
            </section>

            <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
              <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
                <FaRobot /> Automation Tip
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Use <b>Conditions</b> to segment your customers. For example, add a tag 'New Lead' only if they haven't contacted you in the last 30 days.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
