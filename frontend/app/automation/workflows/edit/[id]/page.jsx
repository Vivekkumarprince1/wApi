'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  FaArrowLeft, FaPlus, FaTrash, FaSave, FaRobot, FaFilter, FaBolt, FaPlusCircle,
  FaCheckCircle, FaExclamationTriangle, FaClock, FaTag, FaUserPlus, FaLink, FaCommentDots,
  FaSitemap, FaWpforms, FaDatabase, FaMagic
} from 'react-icons/fa';
import Link from 'next/link';
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import { put, get } from '@/lib/api';
import { toast } from '@/lib/toast';
import { FlowCanvas } from '@/components/features/automation/FlowCanvas';
import { validateWorkflow } from '@/utils/automationValidator';
import { WorkflowInspector } from '@/components/features/automation/WorkflowInspector';
import { Panel } from '@xyflow/react';

// ─────────────────────────────────────────────────────────────────────────
// CONSTANTS
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
  { value: 'ask_ai', label: '🧠 Ask AI (Intent)', icon: FaRobot, category: 'logic', nodeType: 'condition' },
  { value: 'notify_webhook', label: '🔗 Webhook', icon: FaLink, category: 'logic', nodeType: 'action' },
  { value: 'save_response', label: '💾 Save Input', icon: FaSave, category: 'logic', nodeType: 'action' },
  { value: 'mark_as_resolved', label: '✅ Resolve Chat', icon: FaCheckCircle, category: 'crm', nodeType: 'action' },
  { value: 'create_deal', label: '📈 Create CRM Deal', icon: FaBolt, category: 'crm', nodeType: 'action' }
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

export default function EditWorkflowPage() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.id;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [agents, setAgents] = useState([]);
  const [tags, setTags] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  
  const [workflowName, setWorkflowName] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [inspectorMode, setInspectorMode] = useState(false);
  const [inspectedActions, setInspectedActions] = useState([]);

  const selectedNode = useMemo(() => 
    nodes.find(n => n.id === selectedNodeId), 
    [nodes, selectedNodeId]
  );

  // -- Load Data --
  useEffect(() => {
    if (!workflowId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [workflowRes, tplData, agentData, tagData, pipeData] = await Promise.all([
          get(`/automation/engine/rules/${workflowId}`),
          get('/templates'),
          get('/team/members'),
          get('/tags'),
          get('/commerce/pipelines')
        ]);

        setTemplates(tplData.templates || []);
        setAgents(agentData.members || []);
        setTags(tagData.data || []);
        setPipelines(pipeData.data || pipeData.pipelines || []);

        if (workflowRes.success && workflowRes.data.rule) {
          const rule = workflowRes.data.rule;
          setWorkflowName(rule.name);
          
          if (rule.flowConfig && rule.flowConfig.nodes?.length > 0) {
            setNodes(rule.flowConfig.nodes);
            setEdges(rule.flowConfig.edges || []);
          } else {
            // BACKWARD COMPATIBILITY: Generate a linear flow from legacy actions
            console.log('[Workflow] Legacy rule detected. Generating linear flow.');
            const generatedNodes = [{
              id: 'node_trigger',
              type: 'trigger',
              position: { x: 250, y: 50 },
              data: { 
                event: rule.trigger?.event || 'customer.message.received', 
                label: TRIGGER_EVENTS.find(t => t.value === rule.trigger?.event)?.label.split(' ').slice(1).join(' ') || 'Condition Met',
                filters: rule.trigger?.filters || { channel: 'all', source: 'all' }
              }
            }];

            const generatedEdges = [];
            let lastId = 'node_trigger';

            rule.actions?.forEach((action, idx) => {
              const nid = `node_${idx}_${Date.now()}`;
              const actionInfo = ACTION_TYPES.find(a => a.value === action.type);
              
              generatedNodes.push({
                id: nid,
                type: actionInfo?.nodeType || 'action',
                position: { x: 250, y: 150 + (idx * 150) },
                data: { 
                  type: action.type, 
                  label: actionInfo?.label || action.type,
                  config: action.config 
                }
              });

              generatedEdges.push({ id: `e-${lastId}-${nid}`, source: lastId, target: nid });
              lastId = nid;
            });

            setNodes(generatedNodes);
            setEdges(generatedEdges);
          }
        }
      } catch (err) {
        console.error('Initial Load Error:', err);
        setError('Failed to load workflow data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [workflowId, setNodes, setEdges]);

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
    setSelectedNodeId(null);
  };

  const handleValidate = useCallback(() => {
    const { errors, warnings } = validateWorkflow(nodes, edges);
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, error: null, warning: null } })));
    
    if (errors.length === 0 && warnings.length === 0) {
      toast.success('Workflow is perfectly structured!');
      return true;
    }

    setNodes(nds => nds.map(n => {
      const nodeError = errors.find(e => e.id === n.id);
      const nodeWarning = warnings.find(w => w.id === n.id);
      return { 
        ...n, 
        data: { 
          ...n.data, 
          error: nodeError?.message || null,
          warning: nodeWarning?.message || null
        } 
      };
    }));

    if (errors.length > 0) {
      setError(`Found ${errors.length} validation errors.`);
      toast.error('Workflow has structural errors');
      return false;
    }
    return true;
  }, [nodes, edges]);

  const onInspectPath = useCallback((executedActions) => {
    // 1. Identify nodes that were executed
    // We assume the sequence matches the linear flow for simple cases, 
    // or we match by node types/config if stored precisely.
    // For now, we highlight nodes that match the executed action types in order.
    
    setNodes(nds => nds.map(node => {
      const isExecuted = executedActions.some(a => a.type === node.data.type);
      return {
        ...node,
        animated: isExecuted,
        style: isExecuted ? { border: '2px solid #3b82f6', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' } : {}
      };
    }));

    setEdges(eds => eds.map(edge => {
      // Find if source and target nodes were both executed in sequence
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      const isPath = executedActions.some(a => a.type === sourceNode?.data.type) && 
                     executedActions.some(a => a.type === targetNode?.data.type);
      
      return {
        ...edge,
        animated: isPath,
        style: isPath ? { stroke: '#3b82f6', strokeWidth: 4 } : { stroke: '#cbd5e1', strokeWidth: 1 }
      };
    }));

    toast.info(`Tracing path: ${executedActions.length} steps executed`);
  }, [nodes, setNodes, setEdges]);

  // Clear highlight when inspector mode is toggled off
  useEffect(() => {
    if (!inspectorMode) {
      setNodes(nds => nds.map(n => ({ ...n, style: {}, animated: false })));
      setEdges(eds => eds.map(e => ({ ...e, style: {}, animated: true })));
    }
  }, [inspectorMode, setNodes, setEdges]);

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

  const handleSubmit = async () => {
    if (!workflowName.trim()) return setError('Workflow name is required');
    if (!handleValidate()) return;

    setSaving(true);
    try {
      const triggerNode = nodes.find(n => n.type === 'trigger');
      
      const payload = {
        name: workflowName,
        category: 'workflow',
        trigger: triggerNode.data,
        flowConfig: { nodes, edges },
        actions: nodes.filter(n => n.type !== 'trigger').map((n, i) => ({
          type: n.data.type,
          config: n.data.config,
          order: i
        }))
      };

      await put(`/automation/engine/rules/${workflowId}`, payload);
      toast.success('Visual Workflow updated and published!');
      router.push('/automation/workflows');
    } catch (err) {
      setError(err.message || 'Error updating workflow');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <FaRobot className="text-4xl text-slate-300 animate-spin" />
      </div>
    );
  }

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
                placeholder="Workflow Name"
              />
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Editing Flow</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setInspectorMode(!inspectorMode)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                inspectorMode ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FaHistory /> {inspectorMode ? 'Hide Inspector' : 'Show Inspector'}
            </button>
            <button 
              onClick={handleValidate}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-2"
            >
              <FaCheckCircle className="text-emerald-500" /> Validate
            </button>
            <button 
              onClick={handleSubmit}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? <FaRobot className="animate-spin" /> : <FaSave />}
              {saving ? 'Saving...' : 'Update Flow'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Component Library */}
        <div className="w-72 bg-white border-r border-slate-200 overflow-y-auto p-4 space-y-6">
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Add Steps</h4>
            <div className="space-y-4">
              {Object.entries(
                ACTION_TYPES.reduce((acc, action) => {
                  acc[action.category] = acc[action.category] || [];
                  acc[action.category].push(action);
                  return acc;
                }, {})
              ).map(([category, items]) => (
                <div key={category} className="space-y-1">
                  <p className="text-[9px] font-extrabold text-slate-300 uppercase ml-1 mb-1">{category}</p>
                  {items.map(item => (
                    <button
                      key={item.value}
                      onClick={() => addNode(item.value)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-900 group transition-all"
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

          {inspectorMode && (
            <div className="absolute top-4 left-4 z-10">
              <div className="bg-white/90 backdrop-blur p-4 rounded-2xl border border-blue-200 shadow-xl max-w-xs animate-in slide-in-from-left duration-300">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase tracking-widest mb-2">
                  <FaHistory className="animate-pulse" /> Live Analysis Mode
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Select an execution from the sidebar to trace the contact's path through this workflow.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Switch between Library/Config and Inspector */}
        {inspectorMode ? (
          <WorkflowInspector workflowId={workflowId} onInspectPath={onInspectPath} />
        ) : (
          <div className="w-96 bg-white border-l border-slate-200 overflow-y-auto flex flex-col">
            {/* Library / Config Sidebar Content */}
            {!selectedNode ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <FaSitemap size={24} className="opacity-20 mb-4" />
                <p className="text-sm font-medium">Select a node to edit</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-900 text-white">
                      {ACTION_TYPES.find(a => a.value === selectedNode.data.type)?.icon({ size: 14 }) || <FaBolt size={14} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{selectedNode.data.label || 'Node Preview'}</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{selectedNode.type} NODE</p>
                    </div>
                  </div>
                  {selectedNode.id !== 'node_trigger' && (
                    <button onClick={removeSelectedNode} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg">
                      <FaTrash size={14} />
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {selectedNode.type === 'trigger' && (
                    <div className="space-y-5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Trigger Event</label>
                        <select 
                          value={selectedNode.data.event}
                          onChange={(e) => updateNodeData({ 
                            event: e.target.value,
                            label: TRIGGER_EVENTS.find(t => t.value === e.target.value)?.label.split(' ').slice(1).join(' ') 
                          })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                        >
                          {TRIGGER_EVENTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'send_text_message' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Message Content</label>
                      <textarea 
                        rows={5}
                        value={selectedNode.data.config.messageContent || ''}
                        onChange={(e) => updateNodeConfig({ messageContent: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                      />
                    </div>
                  )}

                  {selectedNode.data.type === 'send_template_message' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Template</label>
                      <select 
                        value={selectedNode.data.config.templateId || ''}
                        onChange={(e) => {
                          const tpl = templates.find(t => t._id === e.target.value);
                          updateNodeConfig({ templateId: e.target.value, templateName: tpl?.name });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                      >
                        <option value="">Choose Template...</option>
                        {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}

                  {selectedNode.type === 'condition' && selectedNode.data.type !== 'ask_ai' && (
                    <div className="space-y-5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Field</label>
                        <select value={selectedNode.data.field || ''} onChange={(e) => updateNodeData({ field: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm">
                          {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Operator</label>
                        <select value={selectedNode.data.operator || ''} onChange={(e) => updateNodeData({ operator: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm">
                          {CONDITION_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Value</label>
                        <input type="text" value={selectedNode.data.value || ''} onChange={(e) => updateNodeData({ value: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'ask_ai' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Confidence Threshold (%)</label>
                        <input 
                          type="range" min="10" max="95" step="5"
                          value={selectedNode.data.config.confidence || 75}
                          onChange={(e) => updateNodeConfig({ confidence: parseInt(e.target.value) })}
                          className="w-full"
                        />
                        <div className="text-right text-[10px] font-bold text-slate-400 mt-1">{selectedNode.data.config.confidence || 75}%</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Expected Intent</label>
                        <input 
                          type="text" placeholder="e.g. billing_issue, human_handover"
                          value={selectedNode.data.config.intent || ''}
                          onChange={(e) => updateNodeConfig({ intent: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.data.type === 'notify_webhook' && (
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Webhook URL</label>
                      <input 
                        type="url" placeholder="https://"
                        value={selectedNode.data.config.webhookUrl || ''}
                        onChange={(e) => updateNodeConfig({ webhookUrl: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                      />
                    </div>
                  )}

                  {(selectedNode.data.type === 'create_deal' || selectedNode.data.type === 'move_pipeline_stage') && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Pipeline</label>
                        <select 
                          value={selectedNode.data.config.pipelineId || ''}
                          onChange={(e) => updateNodeConfig({ pipelineId: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm"
                        >
                          <option value="">-- Choose Pipeline --</option>
                          {pipelines.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
