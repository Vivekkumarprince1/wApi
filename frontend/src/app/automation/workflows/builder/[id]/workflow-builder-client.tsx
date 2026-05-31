"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Settings, Play, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import TriggerNode from '@/components/workflows/nodes/TriggerNode';
import LogicNode from '@/components/workflows/nodes/LogicNode';
import MessageNode from '@/components/workflows/nodes/MessageNode';
import TemplateNode from '@/components/workflows/nodes/TemplateNode';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const nodeTypes = {
  triggerNode: TriggerNode,
  trigger: TriggerNode,
  logicNode: LogicNode,
  condition: LogicNode,
  messageNode: MessageNode,
  send_message: MessageNode,
  send_text: MessageNode,
  addTagNode: MessageNode,
  add_tag: MessageNode,
  assignConversationNode: MessageNode,
  assign_conversation: MessageNode,
  createDealNode: MessageNode,
  create_deal: MessageNode,
  templateNode: TemplateNode,
  send_template: TemplateNode,
};

const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 11)}`;

const defaultNodes: Node[] = [
  {
    id: 'trigger_1',
    type: 'triggerNode',
    position: { x: 280, y: 100 },
    data: {
      label: 'Incoming Message',
      event: 'customer.message.received',
      keywordSettings: { keywords: [], matchMode: 'contains' }
    },
  },
];

const defaultEdges: Edge[] = [];

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const ruleId = (params?.id as string) || 'create';
  const isCreateMode = ruleId === 'create';

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [isEnabled, setIsEnabled] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!isCreateMode);

  const openTriggerSettings = () => {
    const trigger = nodes.find((n) => ['triggerNode', 'trigger'].includes(String(n.type)));
    if (!trigger) {
      toast.error('No trigger node found in this workflow');
      return;
    }
    setSelectedNode(trigger);
  };

  const runTestPreview = () => {
    toast.info('Workflow test runner is not configured yet. Save and trigger from real inbound message for now.');
  };

  const normalizeLoadedNode = (node: any): Node => {
    const typeMap: Record<string, string> = {
      trigger: 'triggerNode',
      triggernode: 'triggerNode',
      condition: 'logicNode',
      logic: 'logicNode',
      logicnode: 'logicNode',
      message: 'messageNode',
      messagenode: 'messageNode',
      send_message: 'messageNode',
      send_text: 'messageNode',
      template: 'templateNode',
      templatenode: 'templateNode',
      send_template: 'templateNode',
      add_tag: 'addTagNode',
      assign_conversation: 'assignConversationNode',
      create_deal: 'createDealNode',
    };

    const originalType = String(node?.type || 'messageNode');
    const dataActionType = String(node?.data?.type || node?.data?.actionType || node?.data?.config?.type || '').toLowerCase();
    const normalizedTypeFromData = typeMap[dataActionType];
    const normalizedType = normalizedTypeFromData || typeMap[originalType.toLowerCase()] || originalType;
    const data = node?.data || {};
    const cfg = data?.config || {};

    const normalizedData: any = {
      ...data,
      continueOnFailure: data.continueOnFailure ?? true,
    };

    if (normalizedType === 'messageNode') {
      normalizedData.label = normalizedData.label || 'Send Message';
      normalizedData.messageContent = normalizedData.messageContent || cfg.messageContent || cfg.body || cfg.message || '';
      normalizedData.type = 'send_text';
    }

    if (normalizedType === 'templateNode') {
      normalizedData.label = normalizedData.label || 'Send Template';
      normalizedData.templateName = normalizedData.templateName || cfg.templateName || '';
      normalizedData.languageCode = normalizedData.languageCode || cfg.languageCode || 'en_US';
      normalizedData.templateParams = normalizedData.templateParams || cfg.templateParams || cfg.components || [];
      normalizedData.type = 'send_template';
    }

    if (normalizedType === 'logicNode') {
      normalizedData.label = normalizedData.label || 'Condition';
      normalizedData.conditionField = normalizedData.conditionField || data.field || cfg.conditionField || cfg.field || 'messageBody';
      normalizedData.operator = normalizedData.operator || cfg.operator || 'contains';
      normalizedData.value = normalizedData.value ?? data.conditionValue ?? cfg.value ?? '';
    }

    if (normalizedType === 'addTagNode') {
      normalizedData.label = normalizedData.label || 'Add Tag';
      normalizedData.tag = normalizedData.tag || cfg.tag || cfg.tagName || '';
      normalizedData.type = 'add_tag';
    }

    if (normalizedType === 'assignConversationNode') {
      normalizedData.label = normalizedData.label || 'Assign Conversation';
      normalizedData.assignedTo = normalizedData.assignedTo || cfg.assignedTo || cfg.assignedAgentId || cfg.agentId || '';
      normalizedData.type = 'assign_conversation';
    }

    if (normalizedType === 'createDealNode') {
      normalizedData.label = normalizedData.label || 'Create Deal';
      normalizedData.title = normalizedData.title || cfg.title || cfg.dealTitle || '';
      normalizedData.pipelineId = normalizedData.pipelineId || cfg.pipelineId || '';
      normalizedData.stageId = normalizedData.stageId || cfg.stageId || '';
      normalizedData.value = normalizedData.value || cfg.value || cfg.dealValue || '';
      normalizedData.type = 'create_deal';
    }

    return {
      ...node,
      type: normalizedType,
      data: normalizedData,
      position: node?.position || { x: 300, y: 200 },
    } as Node;
  };

  useEffect(() => {
    const loadRule = async () => {
      if (isCreateMode) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const res = await fetch(`/api/automation/engine/rules/${ruleId}`);
        const json = await res.json();

        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load workflow');
        }

        const rule = json.data;
        setWorkflowName(rule?.name || 'Untitled Workflow');
        setIsEnabled(rule?.enabled ?? true);

        const loadedNodes = rule?.flowConfig?.nodes?.length
          ? rule.flowConfig.nodes.map((n: any) => normalizeLoadedNode(n))
          : defaultNodes;
        const loadedEdges = rule?.flowConfig?.edges?.length ? rule.flowConfig.edges : defaultEdges;

        setNodes(loadedNodes);
        setEdges(loadedEdges);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load workflow');
        router.push('/automation/workflows');
      } finally {
        setIsLoading(false);
      }
    };

    loadRule();
  }, [isCreateMode, ruleId, router, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const updateNodeData = (id: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          const updatedNode = { ...node, data: { ...node.data, ...newData } };
          if (selectedNode?.id === id) {
            setSelectedNode(updatedNode);
          }
          return updatedNode;
        }
        return node;
      })
    );
  };

  const deleteNode = (id: string) => {
    if (id === 'trigger_1') return;
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let newNodeData: any = { label: 'New Node', continueOnFailure: true };

      if (type === 'messageNode') {
        newNodeData = { label: 'Send Message', messageContent: '', type: 'send_text', continueOnFailure: true };
      }
      if (type === 'logicNode') {
        newNodeData = {
          label: 'Condition',
          conditionField: 'messageBody',
          operator: 'contains',
          value: '',
          continueOnFailure: true
        };
      }
      if (type === 'templateNode') {
        newNodeData = {
          label: 'Send Template',
          templateName: '',
          languageCode: 'en_US',
          templateParams: [],
          type: 'send_template',
          continueOnFailure: true
        };
      }
      if (type === 'addTagNode') {
        newNodeData = {
          label: 'Add Tag',
          tag: '',
          type: 'add_tag',
          continueOnFailure: true
        };
      }
      if (type === 'assignConversationNode') {
        newNodeData = {
          label: 'Assign Conversation',
          assignedTo: '',
          type: 'assign_conversation',
          continueOnFailure: true
        };
      }
      if (type === 'createDealNode') {
        newNodeData = {
          label: 'Create Deal',
          title: '',
          pipelineId: '',
          stageId: '',
          value: '',
          type: 'create_deal',
          continueOnFailure: true
        };
      }

      const newNode: Node = {
        id: generateId('node'),
        type,
        position,
        data: newNodeData,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const saveWorkflow = async () => {
    try {
      setIsSaving(true);
      if (!reactFlowInstance) return;

      const triggerNode = nodes.find((n) => ['triggerNode', 'trigger'].includes(String(n.type)));
      if (!triggerNode) {
        throw new Error('Workflow must include a trigger node');
      }

      const flow = reactFlowInstance.toObject();
      const keywords = (triggerNode?.data as any)?.keywordSettings?.keywords || [];

      const payload = {
        name: workflowName,
        category: 'workflow',
        enabled: isEnabled,
        trigger: {
          event: triggerNode?.data?.event || 'customer.message.received',
          filters: {
            keywords,
            keywordMatchMode: (triggerNode?.data as any)?.keywordSettings?.matchMode || 'contains'
          }
        },
        rateLimit: {
          maxExecutions: 0,
          windowSeconds: 0,
          perContactCooldown: 0,
          perConversationCooldown: 0,
          maxPerContactPerDay: 0
        },
        actions: [],
        flowConfig: {
          nodes: flow.nodes,
          edges: flow.edges,
          viewport: flow.viewport,
        },
      };

      const endpoint = isCreateMode
        ? '/api/automation/engine/rules'
        : `/api/automation/engine/rules/${ruleId}`;

      const method = isCreateMode ? 'POST' : 'PUT';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      let data: any = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = { error: `Unexpected response from server (${response.status})` };
        }
      }

      if (!response.ok) {
        const serverMessage = data?.error || data?.message || `Failed to save workflow (${response.status})`;
        throw new Error(serverMessage);
      }

      if (!data) {
        throw new Error('Empty response from server while saving workflow');
      }

      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success(isCreateMode ? 'Workflow created!' : 'Workflow updated!');
      router.push('/automation/workflows');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-sm font-semibold text-slate-600">Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50">
      <div className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/automation/workflows">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="h-6 w-[2px] bg-slate-200" />
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="w-80 border-transparent hover:border-slate-200 focus:border-primary font-semibold text-lg bg-transparent"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEnabled((prev) => !prev)}
            className={isEnabled ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : ''}
          >
            {isEnabled ? 'Active' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" onClick={openTriggerSettings}>
            <Settings className="w-4 h-4 mr-2" /> Settings
          </Button>
          <Button variant="outline" size="sm" onClick={runTestPreview}>
            <Play className="w-4 h-4 mr-2" /> Test
          </Button>
          <Button onClick={saveWorkflow} disabled={isSaving} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Saving...' : 'Save & Publish'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col gap-4 shadow-sm z-10">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Available Actions</h3>

          <div
            className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab hover:border-emerald-500 hover:shadow-emerald-500/20 transition-all flex items-center gap-3"
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow', 'messageNode');
            }}
            draggable
          >
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded"><Play className="w-4 h-4" /></div>
            <span className="font-medium text-sm text-slate-700">Send Message</span>
          </div>

          <div
            className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab hover:border-blue-500 hover:shadow-blue-500/20 transition-all flex items-center gap-3"
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow', 'templateNode');
            }}
            draggable
          >
            <div className="p-2 bg-blue-100 text-blue-600 rounded"><Settings className="w-4 h-4" /></div>
            <span className="font-medium text-sm text-slate-700">Send Template</span>
          </div>

          <div
            className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab hover:border-amber-500 hover:shadow-amber-500/20 transition-all flex items-center gap-3"
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow', 'logicNode');
            }}
            draggable
          >
            <div className="p-2 bg-amber-100 text-amber-600 rounded"><AlertCircle className="w-4 h-4" /></div>
            <span className="font-medium text-sm text-slate-700">Condition</span>
          </div>

          <div
            className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab hover:border-indigo-500 hover:shadow-indigo-500/20 transition-all flex items-center gap-3"
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow', 'addTagNode');
            }}
            draggable
          >
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded"><Settings className="w-4 h-4" /></div>
            <span className="font-medium text-sm text-slate-700">Add Tag</span>
          </div>

          <div
            className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab hover:border-cyan-500 hover:shadow-cyan-500/20 transition-all flex items-center gap-3"
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow', 'assignConversationNode');
            }}
            draggable
          >
            <div className="p-2 bg-cyan-100 text-cyan-600 rounded"><Settings className="w-4 h-4" /></div>
            <span className="font-medium text-sm text-slate-700">Assign Conversation</span>
          </div>

          <div
            className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab hover:border-rose-500 hover:shadow-rose-500/20 transition-all flex items-center gap-3"
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow', 'createDealNode');
            }}
            draggable
          >
            <div className="p-2 bg-rose-100 text-rose-600 rounded"><Settings className="w-4 h-4" /></div>
            <span className="font-medium text-sm text-slate-700">Create Deal</span>
          </div>

          <div className="mt-auto p-4 bg-primary/5 border border-primary/10 rounded-lg">
            <p className="text-xs text-primary/80 font-medium">Drag and drop actions onto the canvas. Use Condition for true/false branching.</p>
          </div>
        </div>

        <div className="flex-1 h-full" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <div className="w-full h-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                fitView
              >
                <Controls />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#e2e8f0" />
              </ReactFlow>
            </div>
          </ReactFlowProvider>
        </div>

        {selectedNode && (
          <div className="w-80 bg-white border-l border-slate-200 shadow-xl z-20 flex flex-col h-full absolute right-0 top-0">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-slate-800">Node Settings</h3>
              {selectedNode.type !== 'triggerNode' && (
                <Button variant="ghost" size="icon" onClick={() => deleteNode(selectedNode.id)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Node Name</Label>
                <Input
                  value={(selectedNode.data.label as string) || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                />
              </div>

              {selectedNode.type === 'triggerNode' && (
                <>
                  <div className="space-y-2">
                    <Label>Trigger Event</Label>
                    <select
                      className="w-full border border-slate-200 rounded-md text-sm p-2 bg-slate-50"
                      value={(selectedNode.data.event as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { event: e.target.value })}
                    >
                      <option value="customer.message.received">New Incoming Message</option>
                      <option value="message_received">Message Received (Legacy)</option>
                      <option value="form_submitted">Form Submitted</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Keywords (comma separated)</Label>
                    <Input
                      placeholder="price, plan, support"
                      value={((selectedNode.data as any).keywordSettings?.keywords || []).join(', ')}
                      onChange={(e) => {
                        const keywords = e.target.value
                          .split(',')
                          .map((k) => k.trim())
                          .filter(Boolean);
                        updateNodeData(selectedNode.id, {
                          keywordSettings: {
                            ...((selectedNode.data as any).keywordSettings || {}),
                            keywords,
                          },
                        });
                      }}
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'messageNode' && (
                <div className="space-y-2">
                  <Label>Message Content</Label>
                  <textarea
                    className="w-full min-h-[120px] border border-slate-200 rounded-md text-sm p-3 focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    placeholder="Type message here..."
                    value={(selectedNode.data.messageContent as string) || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { messageContent: e.target.value })}
                  />
                </div>
              )}

              {selectedNode.type === 'templateNode' && (
                <>
                  <div className="space-y-2">
                    <Label>Template Name</Label>
                    <Input
                      placeholder="Enter exact template name"
                      value={(selectedNode.data.templateName as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { templateName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Language Code</Label>
                    <Input
                      placeholder="en_US"
                      value={(selectedNode.data.languageCode as string) || 'en_US'}
                      onChange={(e) => updateNodeData(selectedNode.id, { languageCode: e.target.value })}
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'logicNode' && (
                <>
                  <div className="space-y-2">
                    <Label>Condition Field</Label>
                    <Input
                      placeholder="messageBody or contact.name"
                      value={(selectedNode.data.conditionField as string) || 'messageBody'}
                      onChange={(e) => updateNodeData(selectedNode.id, { conditionField: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Operator</Label>
                    <select
                      className="w-full border border-slate-200 rounded-md text-sm p-2 bg-slate-50"
                      value={(selectedNode.data.operator as string) || 'contains'}
                      onChange={(e) => updateNodeData(selectedNode.id, { operator: e.target.value })}
                    >
                      <option value="contains">contains</option>
                      <option value="equals">equals</option>
                      <option value="startsWith">starts with</option>
                      <option value="exists">exists</option>
                    </select>
                  </div>
                  {(selectedNode.data.operator as string) !== 'exists' && (
                    <div className="space-y-2">
                      <Label>Value</Label>
                      <Input
                        placeholder="Expected value"
                        value={(selectedNode.data.value as string) || ''}
                        onChange={(e) => updateNodeData(selectedNode.id, { value: e.target.value })}
                      />
                    </div>
                  )}
                </>
              )}

              {selectedNode.type === 'addTagNode' && (
                <div className="space-y-2">
                  <Label>Tag Name</Label>
                  <Input
                    placeholder="vip, hot_lead"
                    value={(selectedNode.data.tag as string) || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { tag: e.target.value })}
                  />
                </div>
              )}

              {selectedNode.type === 'assignConversationNode' && (
                <div className="space-y-2">
                  <Label>Assign To User ID</Label>
                  <Input
                    placeholder="Mongo user id"
                    value={(selectedNode.data.assignedTo as string) || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { assignedTo: e.target.value })}
                  />
                </div>
              )}

              {selectedNode.type === 'createDealNode' && (
                <>
                  <div className="space-y-2">
                    <Label>Deal Title</Label>
                    <Input
                      placeholder="New sales opportunity"
                      value={(selectedNode.data.title as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pipeline ID (optional)</Label>
                    <Input
                      placeholder="Pipeline id"
                      value={(selectedNode.data.pipelineId as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { pipelineId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stage ID (optional)</Label>
                    <Input
                      placeholder="Stage id"
                      value={(selectedNode.data.stageId as string) || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { stageId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deal Value</Label>
                    <Input
                      placeholder="0"
                      value={String(selectedNode.data.value || '')}
                      onChange={(e) => updateNodeData(selectedNode.id, { value: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
