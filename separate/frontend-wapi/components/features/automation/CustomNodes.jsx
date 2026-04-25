'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  FaBolt, FaCommentDots, FaFilter, FaTag, FaUserPlus, 
  FaClock, FaLink, FaSave, FaCheckCircle, FaRobot 
} from 'react-icons/fa';

/**
 * Base Node Styling
 */
const NodeContainer = ({ children, title, icon: Icon, color, selected, data }) => {
  const borderColor = selected ? `border-${color}-500 shadow-lg shadow-${color}-100` : `border-${color}-200`;
  const iconBg = `bg-${color}-50`;
  const iconText = `text-${color}-600`;
  const statusColor = data?.error ? 'border-red-500 bg-red-50/30' : data?.warning ? 'border-amber-400 bg-amber-50/30' : borderColor;

  return (
    <div className={`min-w-[220px] bg-white rounded-xl border-2 transition-all shadow-sm overflow-hidden ${statusColor}`}>
      {/* Node Header */}
      <div className={`px-4 py-2 flex items-center gap-3 border-b bg-slate-50/50`}>
        <div className={`p-1.5 rounded-lg ${iconBg} ${iconText}`}>
          {Icon && <Icon size={14} />}
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
          {title}
        </span>
      </div>
      
      {/* Node Content */}
      <div className="p-4">
        {children}
      </div>

      {/* Safety Guard: Show error or warning if invalid */}
      {data?.error && (
        <div className="px-4 py-1.5 bg-red-50 text-[9px] text-red-600 border-t border-red-100 italic font-bold">
          ⚠️ {data.error}
        </div>
      )}
      {data?.warning && !data?.error && (
        <div className="px-4 py-1.5 bg-amber-50 text-[9px] text-amber-700 border-t border-amber-100 italic font-bold">
          💡 {data.warning}
        </div>
      )}
    </div>
  );
};

/**
 * TRIGGER NODE - Always at the top
 */
export const TriggerNode = memo(({ data, selected }) => {
  return (
    <div className="relative">
      <NodeContainer 
        title="Trigger: Start" 
        icon={FaBolt} 
        color="emerald" 
        selected={selected}
        data={data}
      >
        <div className="text-sm font-semibold text-slate-800">
          {data.label || 'Select Event'}
        </div>
        <div className="mt-1 text-[10px] text-slate-400 italic">
          Starts the automation
        </div>
      </NodeContainer>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500 border-2 border-white" />
    </div>
  );
});

/**
 * MESSAGE NODE - For sending WhatsApp messages
 */
export const MessageNode = memo(({ data, selected }) => {
  const isTemplate = data.type === 'send_template_message';
  
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 border-2 border-white" />
      <NodeContainer 
        title="Action: Send Message" 
        icon={FaCommentDots} 
        color="blue" 
        selected={selected}
        data={data}
      >
        <div className="text-sm font-semibold text-slate-800 truncate">
          {isTemplate ? `Template: ${data.templateName || '...'}` : 'Text Message'}
        </div>
        <div className="mt-1 text-[10px] text-slate-400 line-clamp-2 italic">
          {data.content || 'Click to configure message...'}
        </div>
      </NodeContainer>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-white" />
    </div>
  );
});

/**
 * CONDITION NODE - Branching Logic
 */
export const ConditionNode = memo(({ data, selected }) => {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 border-2 border-white" />
      <NodeContainer 
        title="Logic: Condition" 
        icon={FaFilter} 
        color="amber" 
        selected={selected}
        data={data}
      >
        <div className="text-sm font-semibold text-slate-800">
          {data.type === 'ask_ai' ? (
            `Match Intent: ${data.config?.intent || '...'}`
          ) : (
            `If ${data.field || 'Field'} ${data.operator || 'equals'}...`
          )}
        </div>
        <div className="mt-1 text-[10px] text-slate-400 italic">
          {data.type === 'ask_ai' ? 'AI intent classification' : 'Split the flow based on data'}
        </div>
      </NodeContainer>
      
      {/* Multiple Outlets */}
      <div className="flex justify-between px-2 mt-[-4px] relative pb-2">
        <div className="flex flex-col items-center">
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="true" 
            className="w-3 h-3 bg-emerald-500 border-2 border-white" 
            style={{ left: '25%' }}
          />
          <span className="text-[8px] font-bold text-emerald-600 mt-5">YES</span>
        </div>
        <div className="flex flex-col items-center">
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="false" 
            className="w-3 h-3 bg-red-500 border-2 border-white" 
            style={{ left: '75%' }}
          />
          <span className="text-[8px] font-bold text-red-600 mt-5">NO</span>
        </div>
      </div>
    </div>
  );
});

/**
 * ACTION NODE - CRUD and CRM operations
 */
export const ActionNode = memo(({ data, selected }) => {
  const iconMap = {
    add_tag: FaTag,
    remove_tag: FaTag,
    assign_conversation: FaUserPlus,
    create_deal: FaBolt,
    mark_as_resolved: FaCheckCircle,
    delay: FaClock,
    notify_webhook: FaLink,
    save_response: FaSave
  };

  const labels = {
    add_tag: 'Add Tag',
    remove_tag: 'Remove Tag',
    assign_conversation: 'Assign Agent',
    create_deal: 'Create Deal',
    mark_as_resolved: 'Resolve Chat',
    delay: 'Wait / Delay',
    notify_webhook: 'External Webhook',
    save_response: 'Save Input'
  };

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 border-2 border-white" />
      <NodeContainer 
        title={`Action: ${labels[data.type] || 'Step'}`} 
        icon={iconMap[data.type] || FaBolt} 
        color="violet" 
        selected={selected}
        data={data}
      >
        <div className="text-sm font-semibold text-slate-800">
          {data.summary || 'Click to configure...'}
        </div>
      </NodeContainer>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-violet-500 border-2 border-white" />
    </div>
  );
});
