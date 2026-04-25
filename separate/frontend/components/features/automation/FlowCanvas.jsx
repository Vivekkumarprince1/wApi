'use client';

import React, { useCallback, useMemo } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  MiniMap,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TriggerNode, MessageNode, ConditionNode, ActionNode } from './CustomNodes';

// Define custom node types
const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  condition: ConditionNode,
  action: ActionNode
};

/**
 * FlowCanvas - The interactive workspace for the visual builder
 */
export const FlowCanvas = ({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange, 
  onConnect,
  onNodeClick,
  onPaneClick
}) => {

  const defaultEdgeOptions = {
    animated: true,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  };

  return (
    <div className="w-full h-[700px] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-inner relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        className="bg-slate-50"
      >
        <Background color="#cbd5e1" variant="dots" gap={20} size={1} />
        <Controls showInteractive={false} className="bg-white border-slate-200 shadow-sm" />
        <MiniMap 
          nodeStrokeWidth={3} 
          zoomable 
          pannable 
          className="bg-white border-slate-200 shadow-sm opacity-50 hover:opacity-100 transition-opacity"
        />
        
        <Panel position="top-right" className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Workflow Canvas
        </Panel>
      </ReactFlow>
    </div>
  );
};
