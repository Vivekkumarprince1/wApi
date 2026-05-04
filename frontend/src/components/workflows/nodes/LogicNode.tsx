import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertCircle } from 'lucide-react';

export default function LogicNode({ data, selected }: { data: any, selected: boolean }) {
  return (
    <div className={`shadow-md rounded-2xl bg-white border-2 min-w-[250px] transition-all ${selected ? 'border-amber-500 shadow-amber-500/20' : 'border-slate-200'} overflow-hidden`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500 border-2 border-white pointer-events-auto" />
      <div className="bg-amber-50 p-3 border-b border-amber-100 flex items-center gap-2">
        <div className="p-1.5 bg-amber-200 rounded-lg text-amber-700">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div className="font-bold text-sm text-slate-800">
          {data.label || 'Condition'}
        </div>
      </div>
      <div className="p-4 text-xs text-slate-500 flex flex-col gap-2">
         <div className="bg-slate-100 p-2 rounded flex justify-between items-center">
            <span>IF</span>
            <span className="font-bold text-slate-700">{data.conditionField || 'Select field'}</span>
         </div>
         <div className="flex justify-between items-center px-1">
            <span className="text-amber-600 font-bold">Matches (True)</span>
            <span className="text-slate-400 font-bold">Else (False)</span>
         </div>
      </div>
      
      {/* Two outputs for branching logic */}
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '25%' }} className="w-3 h-3 bg-emerald-500 border-2 border-white pointer-events-auto" />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '75%' }} className="w-3 h-3 bg-slate-300 border-2 border-white pointer-events-auto" />
    </div>
  );
}
