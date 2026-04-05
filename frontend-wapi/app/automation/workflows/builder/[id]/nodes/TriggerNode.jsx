import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Zap } from 'lucide-react';

export default function TriggerNode({ data, selected }) {
  return (
    <div className={`shadow-md rounded-2xl bg-white border-2 min-w-[250px] transition-all ${selected ? 'border-primary shadow-primary/20' : 'border-slate-200'} overflow-hidden`}>
      <div className="bg-primary/5 p-3 border-b border-primary/10 flex items-center gap-2">
        <div className="p-1.5 bg-primary/20 rounded-lg text-primary">
          <Zap className="w-4 h-4" />
        </div>
        <div className="font-bold text-sm text-slate-800">
          {data.label || 'Trigger'}
        </div>
      </div>
      <div className="p-4 text-xs text-slate-500">
        <div className="font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">When</div>
        {data.event === 'customer.message.received' ? (
           <p className="flex items-center gap-2">
             <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-medium truncate">
                {data.keywordSettings?.keywords?.length > 0 ? `Says: "${data.keywordSettings.keywords[0]}"` : 'Any Message'}
             </span>
           </p>
        ) : (
          <p>{data.event}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary border-2 border-white pointer-events-auto" />
    </div>
  );
}
