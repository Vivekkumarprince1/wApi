'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FaArrowLeft, FaPlus, FaTrash, FaSave, FaRobot, FaFilter, FaBolt, FaPlusCircle,
  FaCheckCircle, FaExclamationTriangle, FaClock, FaTag, FaUserPlus, FaLink, FaCommentDots,
  FaSitemap, FaWpforms, FaDatabase
} from 'react-icons/fa';
import Link from 'next/link';
import { post, get } from '@/lib/api';
import { toast } from '@/lib/toast';
import { WorkflowCanvas, FlowNode, NodeConnector } from '@/components/features/automation/FlowComponents';

export default function CreateWorkflowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [agents, setAgents] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedNode, setSelectedNode] = useState({ type: 'trigger', index: null });
  
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
    loadAgents();
    loadTags();
  }, []);

  const loadAgents = async () => {
    try {
      const data = await get('/team/members');
      setAgents(data.members || []);
    } catch (err) {
      console.error('Error loading agents:', err);
    }
  };

  const loadTags = async () => {
    try {
      const data = await get('/tags');
      setTags(data.data || []);
    } catch (err) {
      console.error('Error loading tags:', err);
    }
  };


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
    { value: 'contact.tag.added', label: '🏷️ Tag Added to Contact', icon: FaTag },
    { value: 'deal.stage.changed', label: '📈 Deal Stage Changed', icon: FaBolt },
    { value: 'campaign.message.sent', label: '📣 Campaign Message Sent', icon: FaLink },
    { value: 'form.submitted', label: '📝 Form/Flow Submitted', icon: FaSave }
  ];

  const actionTypes = [
    { value: 'send_template_message', label: '💬 Send Template', icon: FaCommentDots, category: 'message' },
    { value: 'send_text_message', label: '✍️ Send Text (24h)', icon: FaCommentDots, category: 'message' },
    { value: 'send_interactive_message', label: '🔘 Send Buttons/List', icon: FaFilter, category: 'message' },
    { value: 'send_form', label: '📝 Send WhatsApp Form', icon: FaSave, category: 'message' },
    { value: 'save_response', label: '💾 Save User Response', icon: FaSave, category: 'logic' },
    { value: 'assign_conversation', label: '👤 Assign to Agent/Team', icon: FaUserPlus, category: 'assignment' },
    { value: 'add_tag', label: '🏷️ Add Tag', icon: FaTag, category: 'crm' },
    { value: 'remove_tag', label: '❌ Remove Tag', icon: FaTag, category: 'crm' },
    { value: 'create_deal', label: '💰 Create New Deal', icon: FaBolt, category: 'crm' },
    { value: 'move_pipeline_stage', label: '➡️ Move Deal Stage', icon: FaBolt, category: 'crm' },
    { value: 'notify_agent', label: '🔔 Internal Notification', icon: FaBolt, category: 'logic' },
    { value: 'add_note', label: '📝 Add Internal Note', icon: FaSave, category: 'crm' },
    { value: 'mark_as_resolved', label: '✅ Mark Resolved', icon: FaCheckCircle, category: 'crm' },
    { value: 'notify_webhook', label: '🔗 External Webhook', icon: FaLink, category: 'logic' },
    { value: 'delay', label: '⏱️ Delay Next Action', icon: FaClock, category: 'logic' }
  ];

  const conditionFields = [
    { value: 'message.content', label: 'Message Content' },
    { value: 'contact.tags', label: 'Contact Tags' },
    { value: 'contact.name', label: 'Contact Name' },
    { value: 'contact.email', label: 'Contact Email' },
    { value: 'conversation.status', label: 'Conversation Status' },
    { value: 'conversation.assignedTo', label: 'Assigned Agent' },
    { value: 'message.type', label: 'Message Type' },
    { value: 'current.day_of_week', label: 'Day of Week' },
    { value: 'current.time_of_day', label: 'Time of Day' }
  ];

  const conditionOperators = [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'matches_regex', label: 'Matches Regex' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'time_within', label: 'Within last N hours' }
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
    } else if (type === 'send_interactive_message') {
      newAction.config = { 
        interactiveConfig: { 
          type: 'buttons', 
          header: '', 
          body: 'Hello! Please select an option:', 
          buttons: [{ id: 'btn_1', text: 'Yes' }, { id: 'btn_2', text: 'No' }] 
        } 
      };
    } else if (type === 'send_form') {
      newAction.config = { formConfig: { flowId: '', screenId: 'START' } };
    } else if (type === 'save_response') {
      newAction.config = { saveAs: { type: 'trait', name: '' } };
    } else if (type === 'create_deal') {
      newAction.config = { pipelineId: '', stageId: '', dealTitle: 'New Deal' };
    } else if (type === 'move_pipeline_stage') {
      newAction.config = { pipelineId: '', stageId: '' };
    } else if (type === 'notify_agent') {
      newAction.config = { notificationTitle: 'Automation Alert', notificationBody: 'A rule was triggered.' };
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
      await post('/automation/engine/rules', form);
      toast.success('Workflow created successfully');
      router.push('/automation/workflows');
    } catch (err) {
      setError(err.message || 'Error creating workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 mb-0">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/automation/workflows" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <FaArrowLeft className="text-slate-500" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Visual Workflow Designer</h1>
              <p className="text-xs text-slate-500">Design your automation flow like Interakt</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
               onClick={handleSubmit}
               disabled={loading}
               className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? <FaRobot className="animate-spin" /> : <FaSave />}
              {loading ? 'Publishing...' : 'Save & Publish'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8 flex items-start gap-8">
        {/* Left: Visual Builder Canvas */}
        <div className="flex-1 flex flex-col gap-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 animate-shake">
              <FaExclamationTriangle className="text-red-500" />
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          <WorkflowCanvas>
            {/* 1. TRIGGER NODE */}
            <FlowNode 
              type="trigger" 
              title="START: TRIGGER" 
              icon={triggerEvents.find(t => t.value === form.trigger.event)?.icon || FaBolt}
              onClick={() => setSelectedNode({ type: 'trigger', index: null })}
              status={form.trigger.event ? 'valid' : 'incomplete'}
            >
              <div className="text-slate-700 font-medium">
                {triggerEvents.find(t => t.value === form.trigger.event)?.label}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Filters: {form.trigger.filters.channel} channel, {form.trigger.filters.source} source
              </div>
            </FlowNode>

            <NodeConnector />

            {/* 2. CONDITIONS (IF ANY) */}
            {form.conditions.map((cond, idx) => (
              <React.Fragment key={`cond-frag-${idx}`}>
                <FlowNode 
                  type="condition" 
                  title={`CONDITION ${idx + 1}`} 
                  icon={FaFilter}
                  onRemove={() => removeCondition(idx)}
                  onClick={() => setSelectedNode({ type: 'condition', index: idx })}
                >
                  <div className="text-slate-700 font-medium">
                    {conditionFields.find(f => f.value === cond.field)?.label} {cond.operator.replace('_', ' ')} "{cond.value}"
                  </div>
                </FlowNode>
                <NodeConnector />
              </React.Fragment>
            ))}

            {/* ADD CONDITION BUTTON */}
            <button 
              onClick={addCondition}
              className="group flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-dashed border-slate-300 rounded-lg text-slate-500 transition-all active:scale-95 mb-4"
            >
              <FaPlusCircle className="text-slate-400 group-hover:text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider">Add Condition</span>
            </button>

            {form.conditions.length > 0 && <NodeConnector />}

            {/* 3. ACTIONS */}
            {form.actions.map((action, idx) => (
              <React.Fragment key={`action-frag-${idx}`}>
                <FlowNode 
                  type="action" 
                  title={`STEP ${idx + 1}: ${actionTypes.find(a => a.value === action.type)?.label.split(' (')[0]}`} 
                  icon={actionTypes.find(a => a.value === action.type)?.icon || FaBolt}
                  onRemove={() => removeAction(idx)}
                  onClick={() => setSelectedNode({ type: 'action', index: idx })}
                >
                  <div className="text-slate-700 font-medium truncate">
                    {action.type === 'send_text_message' ? action.config.messageContent : 
                     action.type === 'send_template_message' ? `Template: ${templates.find(t => t._id === action.config.templateId)?.name || '... '}` :
                     action.type === 'assign_conversation' ? `Assign: ${action.config.assignTo?.type}` :
                     action.type === 'add_tag' ? `Tag: ${action.config.tagName}` :
                     action.type === 'save_response' ? `Save: ${action.config.saveAs?.name} (${action.config.saveAs?.type})` :
                     'Configured'}
                  </div>
                </FlowNode>
                {idx < form.actions.length - 1 && <NodeConnector />}
              </React.Fragment>
            ))}

            {/* ADD ACTION DROPDOWN */}
            <div className="mt-4 flex flex-wrap justify-center gap-2 p-4 bg-white/50 rounded-2xl border border-slate-200 shadow-sm">
              {actionTypes.map(a => (
                <button
                  key={a.value}
                  onClick={() => addAction(a.value)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-all active:scale-95 shadow-sm"
                >
                  <a.icon size={12} className="text-primary" />
                  {a.label.split(' (')[0]}
                </button>
              ))}
            </div>
          </WorkflowCanvas>
        </div>

        {/* Right: Configuration Panel */}
        <div className="w-96 sticky top-28 h-[calc(100vh-140px)] overflow-y-auto space-y-6 flex flex-col">
          <section className="bg-white rounded-2x border border-slate-200 shadow-premium p-6 flex-1">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FaRobot className="text-primary" /> 
                {selectedNode.type === 'trigger' ? 'Edit Trigger' : 
                 selectedNode.type === 'condition' ? `Edit Condition ${selectedNode.index + 1}` : 
                 `Edit Action ${selectedNode.index + 1}`}
              </h3>
            </div>

            {/* TRIGGER CONFIG */}
            {selectedNode.type === 'trigger' && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Workflow Name</label>
                  <input 
                    type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 ring-primary/20 outline-none"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Trigger Event</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    value={form.trigger.event}
                    onChange={(e) => setForm({ ...form, trigger: { ...form.trigger, event: e.target.value } })}
                  >
                    {triggerEvents.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="pt-4 border-t">
                  <h4 className="text-xs font-bold text-slate-900 mb-3">Trigger Filters</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Channel</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                        value={form.trigger.filters.channel}
                        onChange={(e) => setForm({ ...form, trigger: { ...form.trigger, filters: { ...form.trigger.filters, channel: e.target.value } } })}
                      >
                        <option value="all">All Channels</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="instagram">Instagram</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONDITION CONFIG */}
            {selectedNode.type === 'condition' && selectedNode.index !== null && (
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Field</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    value={form.conditions[selectedNode.index].field}
                    onChange={(e) => updateCondition(selectedNode.index, 'field', e.target.value)}
                  >
                    {conditionFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Operator</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    value={form.conditions[selectedNode.index].operator}
                    onChange={(e) => updateCondition(selectedNode.index, 'operator', e.target.value)}
                  >
                    {conditionOperators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {!['is_empty', 'is_not_empty'].includes(form.conditions[selectedNode.index].operator) && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Value</label>
                    <input 
                      type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                      value={form.conditions[selectedNode.index].value}
                      onChange={(e) => updateCondition(selectedNode.index, 'value', e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ACTION CONFIG */}
            {selectedNode.type === 'action' && selectedNode.index !== null && (
              <div className="space-y-6">
                <p className="text-xs text-slate-500 italic">Configure step behaviors below</p>
                
                {form.actions[selectedNode.index].type === 'send_text_message' && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Message Content</label>
                    <textarea 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                      rows="4"
                      value={form.actions[selectedNode.index].config.messageContent}
                      onChange={(e) => updateActionConfig(selectedNode.index, { messageContent: e.target.value })}
                    />
                  </div>
                )}

                {form.actions[selectedNode.index].type === 'send_template_message' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Template</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                        value={form.actions[selectedNode.index].config.templateId}
                        onChange={(e) => updateActionConfig(selectedNode.index, { templateId: e.target.value })}
                      >
                        <option value="">Select template...</option>
                        {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {form.actions[selectedNode.index].type === 'save_response' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Save As</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                        value={form.actions[selectedNode.index].config.saveAs?.type}
                        onChange={(e) => updateActionConfig(selectedNode.index, { saveAs: { ...form.actions[selectedNode.index].config.saveAs, type: e.target.value } })}
                      >
                        <option value="trait">User Trait (Persistent)</option>
                        <option value="variable">Variables (Temporary)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Name</label>
                      <input 
                        type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                        placeholder="e.g., favorite_color"
                        value={form.actions[selectedNode.index].config.saveAs?.name}
                        onChange={(e) => updateActionConfig(selectedNode.index, { saveAs: { ...form.actions[selectedNode.index].config.saveAs, name: e.target.value } })}
                      />
                    </div>
                  </div>
                )}
                
                {/* Fallback for other types */}
                {!['send_text_message', 'send_template_message', 'save_response'].includes(form.actions[selectedNode.index].type) && (
                  <div className="text-center py-8 text-slate-400 italic text-sm">
                    Additional settings for {form.actions[selectedNode.index].type} coming soon.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Rate Limit Settings (Always visible at bottom of sidebar) */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Limits & Safety</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-400 block mb-1">Max/Hr</label>
                <input 
                  type="number" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  value={form.rateLimit.maxExecutions}
                  onChange={(e) => setForm({ ...form, rateLimit: { ...form.rateLimit, maxExecutions: parseInt(e.target.value) }})}
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 block mb-1">Cooldown (s)</label>
                <input 
                  type="number" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  value={form.rateLimit.perContactCooldown}
                  onChange={(e) => setForm({ ...form, rateLimit: { ...form.rateLimit, perContactCooldown: parseInt(e.target.value) }})}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );

}
