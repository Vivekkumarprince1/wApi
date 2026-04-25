'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ReactFlow, ReactFlowProvider, addEdge, applyNodeChanges, applyEdgeChanges, Controls, Background, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, ArrowLeft, Play, Settings, AlertCircle, X } from 'lucide-react';
import { get, post, put } from '@/lib/api';
import { toast } from '@/lib/toast';

// Custom Nodes 
import TriggerNode from './nodes/TriggerNode';
import MessageNode from './nodes/MessageNode';
import TemplateNode from './nodes/TemplateNode';
import LogicNode from './nodes/LogicNode';

const initialNodes = [
  {
    id: 'trigger-1',
    type: 'triggerNode',
    position: { x: 250, y: 100 },
    data: { label: 'Keyword Trigger', event: 'customer.message.received', keywordSettings: { keywords: [], matchMode: 'contains' } },
  },
];

const initialEdges = [];

export default function WorkflowBuilder() {
  const router = useRouter();
  const params = useParams();
  const isNew = params.id === 'create';
  
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [name, setName] = useState(isNew ? 'Untitled Workflow' : '');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const nodeTypes = useMemo(() => ({ 
    triggerNode: TriggerNode, 
    messageNode: MessageNode,
    templateNode: TemplateNode,
    logicNode: LogicNode 
  }), []);

  useEffect(() => {
    if (!isNew) {
      loadWorkflow();
    }
  }, [params.id]);

  const loadWorkflow = async () => {
    try {
      const res = await get(`/automation/engine/rules/${params.id}`);
      if (res.success && res.data) {
        const rule = res.data;
        setName(rule.name || 'Untitled');
        
        if (rule.flowConfig && rule.flowConfig.nodes?.length > 0) {
          setNodes(rule.flowConfig.nodes);
          setEdges(rule.flowConfig.edges || []);
        } else {
          // Fallback if legacy/no flowConfig exists
          setNodes(initialNodes);
        }
      }
    } catch (err) {
      toast?.error?.('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    []
  );

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const handleSave = async () => {
    if (!name.trim()) return toast?.error?.('Please name your workflow');
    
    // We need at least a trigger and one action
    if (nodes.length < 2) return toast?.error?.('Workflow needs at least a trigger and one action node');
    
    setSaving(true);
    
    const triggerNode = nodes.find(n => n.type === 'triggerNode');
    const dbTrigger = triggerNode ? {
      event: triggerNode.data.event || 'customer.message.received',
      filters: {
        keywords: triggerNode.data.keywordSettings?.keywords || [],
        keywordMatchMode: triggerNode.data.keywordSettings?.matchMode || 'contains',
      }
    } : { event: 'customer.message.received' };

    // Compile node sequence to linear actions for execution engine
    const compileToActions = () => {
      const actions = [];
      let currentEdge = edges.find(e => e.source === triggerNode?.id);
      
      let order = 0;
      while (currentEdge) {
        const nextNode = nodes.find(n => n.id === currentEdge.target);
        if (!nextNode) break;

        if (nextNode.type === 'messageNode') {
          actions.push({
            type: 'send_text_message',
            config: { messageContent: nextNode.data.messageContent || '' },
            order: order++
          });
        }
        
        if (nextNode.type === 'templateNode') {
          actions.push({
            type: 'send_template_message',
            config: { templateName: nextNode.data.templateName || '' },
            order: order++
          });
        }
        
        // Note: Full branching (LogicNode) needs an advanced executor which we will implement next
        
        currentEdge = edges.find(e => e.source === nextNode.id);
      }
      return actions;
    };

    const compiledActions = compileToActions();

    const payload = {
      name,
      category: 'workflow',
      trigger: dbTrigger,
      actions: compiledActions,
      flowConfig: {
        nodes,
        edges,
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      enabled: true
    };

    try {
      let res;
      if (isNew) {
        res = await post('/automation/engine/rules', payload);
      } else {
        res = await put(`/automation/engine/rules/${params.id}`, payload);
      }

      if (res.success) {
        toast?.success?.('Workflow saved successfully!');
        if (isNew) {
          router.replace(`/automation/workflows/builder/${res.data._id}`);
        }
      }
    } catch (err) {
      toast?.error?.(err.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const addNode = (type) => {
    const newNodeId = `${type}-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: type,
      position: { x: nodes[0].position.x, y: nodes[nodes.length - 1].position.y + 150 },
      data: { label: `New ${type.replace('Node', '')}` },
    };
    setNodes([...nodes, newNode]);
    
    // Auto-connect to prior node if it's not the first extra node
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      setEdges([...edges, { id: `e-${lastNode.id}-${newNodeId}`, source: lastNode.id, target: newNodeId, animated: true }]);
    }
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500">Loading builder...</div>;

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Navbar */}
      <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/automation/workflows')} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)}
            className="text-lg font-bold text-slate-900 border-none outline-none bg-transparent hover:bg-slate-50 focus:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 w-64"
            placeholder="Workflow Name"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => {}} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-slate-900 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Node Toolbar (Left) */}
        <div className="w-64 bg-white border-r border-slate-200 p-4 shrink-0 flex flex-col gap-4 overflow-y-auto z-10 shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Available Actions</h3>
          
          <button onClick={() => addNode('messageNode')} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left text-sm font-bold text-slate-700 hover:text-emerald-700">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><Play className="w-4 h-4" /></div>
            Send Message
          </button>
          
          <button onClick={() => addNode('templateNode')} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left text-sm font-bold text-slate-700 hover:text-blue-700">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Settings className="w-4 h-4" /></div>
            Send Template
          </button>
          
          <button onClick={() => addNode('logicNode')} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50 transition-all text-left text-sm font-bold text-slate-700 hover:text-amber-700">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><AlertCircle className="w-4 h-4" /></div>
            Condition (If/Else)
          </button>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 h-full relative">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              fitView
              className="bg-slate-50"
            >
              <Background color="#ccc" gap={16} />
              <Controls />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {/* Right Properties Drawer */}
        {selectedNode && (
          <div className="w-80 bg-white border-l border-slate-200 shrink-0 shadow-2xl flex flex-col animate-in slide-in-from-right relative z-20">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Node Settings</h3>
              <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
               <p className="text-sm text-slate-500 mb-4">Editing <span className="font-bold text-slate-900">{selectedNode.data.label}</span></p>
               
               {/* Quick label edit */}
               <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Node Label</label>
               <input 
                  type="text"
                  value={selectedNode.data.label}
                  onChange={e => {
                    const newLabel = e.target.value;
                    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: newLabel } } : n));
                    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, label: newLabel } });
                  }}
                  className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-primary outline-none"
               />
               
               {/* Dynamic Node Editor Forms */}
               <div className="mt-8 space-y-4">
                 
                 {selectedNode.type === 'triggerNode' && (
                   <div className="space-y-4 animate-in fade-in">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Trigger Settings</p>
                     <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1">Trigger Event</label>
                       <select 
                         value={selectedNode.data.event || 'customer.message.received'}
                         onChange={e => {
                           setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, event: e.target.value } } : n));
                           setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, event: e.target.value } });
                         }}
                         className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-primary outline-none"
                       >
                         <option value="customer.message.received">Customer Message Received</option>
                         <option value="api">External API Trigger</option>
                       </select>
                     </div>
                     {selectedNode.data.event === 'customer.message.received' && (
                       <div>
                         <label className="block text-xs font-bold text-slate-700 mb-1">Target Keyword</label>
                         <input 
                           type="text"
                           placeholder="Type a exact keyword..."
                           value={selectedNode.data.keywordSettings?.keywords?.[0] || ''}
                           onChange={e => {
                             const ks = { ...selectedNode.data.keywordSettings, keywords: [e.target.value] };
                             setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, keywordSettings: ks } } : n));
                             setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, keywordSettings: ks } });
                           }}
                           className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-primary outline-none"
                         />
                         <p className="text-[10px] text-slate-400 mt-1">Leave empty to always trigger.</p>
                       </div>
                     )}
                   </div>
                 )}

                 {selectedNode.type === 'messageNode' && (
                   <div className="space-y-4 animate-in fade-in">
                     <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest border-b pb-2">Text Message</p>
                     <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1">Message Body</label>
                       <textarea 
                         rows={4}
                         placeholder="Hi there! How can we help?"
                         value={selectedNode.data.messageContent || ''}
                         onChange={e => {
                           const val = e.target.value;
                           setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, messageContent: val } } : n));
                           setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, messageContent: val } });
                         }}
                         className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-emerald-500 outline-none resize-none"
                       />
                     </div>
                   </div>
                 )}

                 {selectedNode.type === 'templateNode' && (
                   <div className="space-y-4 animate-in fade-in">
                     <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest border-b pb-2">Send Template</p>
                     <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1">Template Name</label>
                       <input 
                         type="text"
                         placeholder="e.g. welcome_msg_v1"
                         value={selectedNode.data.templateName || ''}
                         onChange={e => {
                           const val = e.target.value;
                           setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, templateName: val } } : n));
                           setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, templateName: val } });
                         }}
                         className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-blue-500 outline-none"
                       />
                       <p className="text-[10px] text-slate-400 mt-1">Must exactly match your approved WhatsApp template name.</p>
                     </div>
                   </div>
                 )}

                 {selectedNode.type === 'logicNode' && (
                   <div className="space-y-4 animate-in fade-in">
                     <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest border-b pb-2">Conditional Logic (If/Else)</p>
                     <div>
                       <label className="block text-xs font-bold text-slate-700 mb-1">Condition Field</label>
                       <input 
                         type="text"
                         placeholder="e.g. contact.tags"
                         value={selectedNode.data.conditionField || ''}
                         onChange={e => {
                           const val = e.target.value;
                           setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, conditionField: val } } : n));
                           setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, conditionField: val } });
                         }}
                         className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-amber-500 outline-none"
                       />
                     </div>
                   </div>
                 )}

               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
