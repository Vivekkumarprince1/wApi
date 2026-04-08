'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FaArrowLeft, FaPlus, FaTrash, FaSave, FaRobot, FaFilter, FaBolt, FaPlusCircle,
  FaCheckCircle, FaExclamationTriangle, FaClock, FaTag, FaUserPlus, FaLink, FaCommentDots,
  FaSitemap, FaWpforms, FaDatabase, FaMagic
} from 'react-icons/fa';
import Link from 'next/link';
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import { post, get } from '@/lib/api';
import { toast } from '@/lib/toast';
import { FlowCanvas } from '@/components/features/automation/FlowCanvas';

// ─────────────────────────────────────────────────────────────────────────
// CONSTANTS & MAPPINGS
// ─────────────────────────────────────────────────────────────────────────

const TRIGGER_EVENTS = [
  { value: 'customer.message.received', label: '📨 Customer Message Received', icon: FaCommentDots },
  { value: 'conversation.created', label: '🆕 New Conversation Started', icon: FaBolt },
  { value: 'first.agent.reply', label: '👤 First Agent Reply', icon: FaUserPlus },
  { value: 'conversation.closed', label: '✅ Conversation Closed', icon: FaCheckCircle },
  { value: 'sla.breached', label: '⚠️ SLA Breached', icon: FaExclamationTriangle },
  { value: 'contact.tag.added', label: '🏷️ Tag Added to Contact', icon: FaTag },
  { value: 'deal.stage.changed', label: '📈 Deal Stage Changed', icon: FaBolt },
  { value: 'form.submitted', label: '📝 Form/Flow Submitted', icon: FaSave }
];

const ACTION_TYPES = [
  { value: 'send_template_message', label: '💬 Send Template', icon: FaCommentDots, category: 'message', nodeType: 'message' },
  { value: 'send_text_message', label: '✍️ Send Text (24h)', icon: FaCommentDots, category: 'message', nodeType: 'message' },
  { value: 'condition', label: '🔀 Branch / Condition', icon: FaFilter, category: 'logic', nodeType: 'condition' },
  { value: 'assign_conversation', label: '👤 Assign Agent', icon: FaUserPlus, category: 'assignment', nodeType: 'action' },
  { value: 'add_tag', label: '🏷️ Add Tag', icon: FaTag, category: 'crm', nodeType: 'action' },
  { value: 'remove_tag', label: '❌ Remove Tag', icon: FaTag, category: 'crm', nodeType: 'action' },
  { value: 'delay', label: '⏱️ Wait / Delay', icon: FaClock, category: 'logic', nodeType: 'action' },
  { value: 'notify_webhook', label: '🔗 Webhook', icon: FaLink, category: 'logic', nodeType: 'action' },
  { value: 'save_response', label: '💾 Save Input', icon: FaSave, category: 'logic', nodeType: 'action' },
  { value: 'mark_as_resolved', label: '✅ Resolve Chat', icon: FaCheckCircle, category: 'crm', nodeType: 'action' }
];

const CONDITION_FIELDS = [
  { value: 'message.content', label: 'Message Content' },
  { value: 'contact.tags', label: 'Contact Tags' },
  { value: 'contact.name', label: 'Contact Name' },
  { value: 'conversation.status', label: 'Conversation Status' },
  { value: 'message.type', label: 'Message Type' }
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'is_not_empty', label: 'Has value' }
];

// ─────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────

export default function CreateWorkflowPage() {
  const router = useRouter();
  
  // -- Basic State --
  const [workflowName, setWorkflowName] = useState('New Automation Workflow');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [agents, setAgents] = useState([]);
  const [tags, setTags] = useState([]);

  // -- Flow State --
  const initialNodes = [
    {
      id: 'node_trigger',
      type: 'trigger',
      position: { x: 250, y: 50 },
      data: { 
        event: 'customer.message.received', 
        label: 'Customer Message Received',
        filters: { channel: 'all', source: 'all' }
      }
    }
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('node_trigger');

  // -- Memoized Selected Node --
  const selectedNode = useMemo(() => 
    nodes.find(n => n.id === selectedNodeId), 
    [nodes, selectedNodeId]
  );

  // -- Load Data --
  useEffect(() => {
    const loadAppData = async () => {
      try {
        const [tplData, agentData, tagData] = await Promise.all([
          get('/templates'),
          get('/team/members'),
          get('/tags')
        ]);
        setTemplates(tplData.templates || []);
        setAgents(agentData.members || []);
        setTags(tagData.data || []);
      } catch (err) {
        console.error('Initial Load Error:', err);
      }
    };
    loadAppData();
  }, []);

  // -- Handlers --
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const addNode = (actionType) => {
    const actionInfo = ACTION_TYPES.find(a => a.value === actionType);
    const newNodeId = `node_${Date.now()}`;
    
    const newNode = {
      id: newNodeId,
      type: actionInfo.nodeType,
      position: { 
        x: selectedNode ? selectedNode.position.x : 250, 
        y: selectedNode ? selectedNode.position.y + 150 : 200 
      },
      data: { 
        type: actionType,
        label: actionInfo.label,
        config: {} 
      }
    };

    setNodes((nds) => nds.concat(newNode));
    
    // Auto-connect if a node was selected
    if (selectedNodeId) {
      setEdges((eds) => addEdge({ 
        source: selectedNodeId, 
        target: newNodeId,
        sourceHandle: selectedNode.type === 'condition' ? 'true' : null 
      }, eds));
    }
    
    setSelectedNodeId(newNodeId);
  };

  const removeSelectedNode = () => {
    if (!selectedNodeId || selectedNodeId === 'node_trigger') return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId('node_trigger');
  };

  const updateNodeData = (updates) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNodeId) {
          return { ...node, data: { ...node.data, ...updates } };
        }
        return node;
      })
    );
  };

  const updateNodeConfig = (configUpdates) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNodeId) {
          return { 
            ...node, 
            data: { 
              ...node.data, 
              config: { ...node.data.config, ...configUpdates } 
            } 
          };
        }
        return node;
      })
    );
  };

  // -- Save logic --
  const handleSubmit = async () => {
    if (!workflowName.trim()) return setError('Workflow name is required');
    
    setLoading(true);
    try {
      const triggerNode = nodes.find(n => n.type === 'trigger');
      
      const payload = {
        name: workflowName,
        category: 'workflow',
        enabled: true,
        trigger: triggerNode.data,
        flowConfig: { nodes, edges },
        // Legacy fields for backward compat with engine
        actions: nodes.filter(n => n.type !== 'trigger').map((n, i) => ({
          type: n.data.type,
          config: n.data.config,
          order: i
        }))
      };

      await post('/automation/engine/rules', payload);
      toast.success('Visual Workflow published successfully!');
      router.push('/automation/workflows');
    } catch (err) {
      setError(err.message || 'Error publishing workflow');
      toast.error('Failed to publish workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10 flex flex-col">
      {/* Designer Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/automation/workflows" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
              <FaArrowLeft size={18} />
            </Link>
            <div className="h-8 w-px bg-slate-200 mx-1" />
            <div>
              <input 
                type="text" 
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="text-lg font-bold text-slate-900 bg-transparent border-none focus:ring-0 p-0 w-80"
                placeholder="Name your automation..."
              />
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Stage 6 Visual Designer</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? <FaRobot className="animate-spin" /> : <FaSave />}
              {loading ? 'Publishing...' : 'Save & Publish'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Component Library Sidebar */}
        <div className="w-72 bg-white border-r border-slate-200 overflow-y-auto p-4 space-y-6">
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Add Steps</h4>
            <div className="space-y-2">
              {Object.entries(
                ACTION_TYPES.reduce((acc, action) => {
                  acc[action.category] = acc[action.category] || [];
                  acc[action.category].push(action);
                  return acc;
                }, {})
              ).map(([category, items]) => (
                <div key={category} className="space-y-1">
                  <p className="text-[9px] font-extrabold text-slate-300 uppercase ml-1 mt-3 mb-1">{category}</p>
                  {items.map(item => (
                    <button
                      key={item.value}
                      onClick={() => addNode(item.value)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-900 group transition-all border border-transparent hover:border-slate-100"
                    >
                      <div className="p-1.5 rounded bg-slate-50 group-hover:bg-white text-slate-400 group-hover:text-primary transition-colors">
                        <item.icon size={12} />
                      </div>
                      <span className="text-xs font-semibold">{item.label}</span>
                      <FaPlusCircle className="ml-auto opacity-0 group-hover:opacity-100 text-slate-300" size={10} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <FaMagic size={12} />
                <span className="text-[10px] font-bold uppercase">Pro Tip</span>
              </div>
              <p className="text-[11px] text-blue-600 leading-relaxed font-medium">
                Connect the YES/NO outlets of a branching node to create sophisticated logic.
              </p>
            </div>
          </div>
        </div>

        {/* Center: Canvas Area */}
        <div className="flex-1 bg-slate-50 relative">
          <FlowCanvas 
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
          />
          
          {error && (
            <div className="absolute bottom-6 left-6 right-6 bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-3 text-red-700 text-xs font-medium animate-bounce shadow-lg">
              <FaExclamationTriangle />
              {error}
            </div>
          )}
        </div>

        {/* Right: Node Configuration Sidebar */}
        <div className="w-96 bg-white border-l border-slate-200 overflow-y-auto flex flex-col">
          {!selectedNode ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-4">
                <FaSitemap size={24} className="opacity-20" />
              </div>
              <p className="text-sm font-medium">Select a node on the canvas to configure its settings</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-slate-900 text-white`}>
                    {ACTION_TYPES.find(a => a.value === selectedNode.data.type)?.icon({ size: 14 }) || <FaBolt size={14} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{selectedNode.data.label || 'Node Preview'}</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{selectedNode.type} NODE</p>
                  </div>
                </div>
                {selectedNode.id !== 'node_trigger' && (
                  <button 
                    onClick={removeSelectedNode}
                    className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <FaTrash size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-6">
                {/* NODE SPECIFIC FORM */}
                {selectedNode.type === 'trigger' && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Event</label>
                      <select 
                        value={selectedNode.data.event}
                        onChange={(e) => updateNodeData({ 
                          event: e.target.value,
                          label: TRIGGER_EVENTS.find(t => t.value === e.target.value)?.label.split(' ').slice(1).join(' ') 
                        })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 ring-primary/10"
                      >
                        {TRIGGER_EVENTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-900 uppercase mb-3">Trigger Filters</p>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Channel Source</label>
                          <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                            <option value="all">All Channels</option>
                            <option value="whatsapp">WhatsApp Official</option>
                            <option value="instagram">Instagram DM</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.data.type === 'send_text_message' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Message Body</label>
                      <textarea 
                        rows={5}
                        placeholder="Type your WhatsApp message here..."
                        value={selectedNode.data.config.messageContent || ''}
                        onChange={(e) => updateNodeConfig({ messageContent: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none resize-none focus:bg-white focus:ring-2 ring-primary/10"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === 'send_template_message' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Select Template</label>
                      <select 
                        value={selectedNode.data.config.templateId || ''}
                        onChange={(e) => {
                          const tpl = templates.find(t => t._id === e.target.value);
                          updateNodeConfig({ 
                            templateId: e.target.value,
                            templateName: tpl?.name 
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                      >
                        <option value="">-- Choose Template --</option>
                        {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'condition' && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Field to Check</label>
                      <select 
                        value={selectedNode.data.field || ''}
                        onChange={(e) => updateNodeData({ field: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                      >
                        {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Operator</label>
                      <select 
                        value={selectedNode.data.operator || ''}
                        onChange={(e) => updateNodeData({ operator: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                      >
                        {CONDITION_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Match Value</label>
                      <input 
                        type="text" 
                        value={selectedNode.data.value || ''}
                        onChange={(e) => updateNodeData({ value: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                        placeholder="e.g. support, help, high"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.data.type === 'assign_conversation' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Assign To</label>
                      <select 
                        value={selectedNode.data.config.assignTo?.type || 'round_robin'}
                        onChange={(e) => updateNodeConfig({ assignTo: { type: e.target.value } })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                      >
                        <option value="round_robin">Round Robin (Available Agents)</option>
                        <option value="specific_agent">Specific Agent</option>
                        <option value="team_inbox">Team Inbox (Unassigned)</option>
                      </select>
                    </div>
                    {selectedNode.data.config.assignTo?.type === 'specific_agent' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Select Agent</label>
                        <select 
                          value={selectedNode.data.config.assignTo?.agentId || ''}
                          onChange={(e) => updateNodeConfig({ assignTo: { ...selectedNode.data.config.assignTo, agentId: e.target.value } })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                        >
                          <option value="">-- Choose Agent --</option>
                          {agents.map(a => <option key={a._id} value={a._id}>{a.name} ({a.email})</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {selectedNode.data.type === 'delay' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Wait Duration (Minutes)</label>
                      <input 
                        type="number" 
                        min="1"
                        value={selectedNode.data.config.delayMinutes || 5}
                        onChange={(e) => updateNodeConfig({ delayMinutes: parseInt(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">The flow will pause here before continuing to the next step.</p>
                  </div>
                )}

                {selectedNode.data.type === 'save_response' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Store As</label>
                      <select 
                        value={selectedNode.data.config.saveAsType || 'trait'}
                        onChange={(e) => updateNodeConfig({ saveAsType: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                      >
                        <option value="trait">User Trait (Across all chats)</option>
                        <option value="variable">Conversation Variable (Current chat only)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Identifier / Key Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. user_preference, last_order_id"
                        value={selectedNode.data.config.saveAsKey || ''}
                        onChange={(e) => updateNodeConfig({ saveAsKey: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* tag actions */}
                {(selectedNode.data.type === 'add_tag' || selectedNode.data.type === 'remove_tag') && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Tag Name</label>
                    <select 
                      value={selectedNode.data.config.tagName || ''}
                      onChange={(e) => updateNodeConfig({ tagName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none"
                    >
                      <option value="">-- Select Tag --</option>
                      {tags.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                )}

                {/* generic Action placeholder if not customized above */}
                {['notify_webhook', 'mark_as_resolved'].includes(selectedNode.data.type) && (
                  <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                    <p className="text-xs text-slate-400 italic">Settings for {selectedNode.data.label} coming soon</p>
                  </div>
                )}
              </div>
              
              <div className="mt-auto pt-10 border-t border-slate-100">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                  <span>Node ID</span>
                  <span className="text-slate-300 font-mono">{selectedNode.id}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
