import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Settings } from 'lucide-react';

export default function TemplateNode({ data, selected }: { data: any, selected: boolean }) {
  return (
    <div className={`shadow-md rounded-2xl bg-white border-2 min-w-[250px] transition-all ${selected ? 'border-blue-500 shadow-blue-500/20' : 'border-slate-200'} overflow-hidden`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-white pointer-events-auto" />
      <div className="bg-blue-50 p-3 border-b border-blue-100 flex items-center gap-2">
        <div className="p-1.5 bg-blue-200 rounded-lg text-blue-700">
          <Settings className="w-4 h-4" />
        </div>
        <div className="font-bold text-sm text-slate-800">
          {data.label || 'Send Template'}
        </div>
      </div>
      <div className="p-4 text-xs text-slate-500">
         <p className="font-medium text-blue-600 truncate">
           {data.templateName ? data.templateName : 'Select a template...'}
         </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 border-2 border-white pointer-events-auto" />
    </div>
  );
}
