import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

export default function MessageNode({ data, selected }) {
  return (
    <div className={`shadow-md rounded-2xl bg-white border-2 min-w-[250px] transition-all ${selected ? 'border-emerald-500 shadow-emerald-500/20' : 'border-slate-200'} overflow-hidden`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500 border-2 border-white pointer-events-auto" />
      <div className="bg-emerald-50 p-3 border-b border-emerald-100 flex items-center gap-2">
        <div className="p-1.5 bg-emerald-200 rounded-lg text-emerald-700">
          <Play className="w-4 h-4" />
        </div>
        <div className="font-bold text-sm text-slate-800">
          {data.label || 'Send Message'}
        </div>
      </div>
      <div className="p-4 text-xs text-slate-500">
         <p className="line-clamp-2 italic">
           {data.messageContent ? `"${data.messageContent}"` : 'Configure message payload...'}
         </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 border-2 border-white pointer-events-auto" />
    </div>
  );
}
