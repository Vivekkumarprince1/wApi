"use client";

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Zap, Play, AlertCircle, MessageSquare } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

/**
 * TRIGGER NODE
 * The starting point of every workflow
 */
export function TriggerNode({ data, selected }: any) {
  return (
    <div className={`shadow-xl rounded-2xl bg-white dark:bg-slate-900 border-2 min-w-[260px] transition-all duration-300 ${selected ? 'border-primary ring-4 ring-primary/10' : 'border-slate-200 dark:border-slate-800'} overflow-hidden`}>
      <div className="bg-primary/5 p-3.5 border-b border-primary/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/20 rounded-lg text-primary">
            <Zap className="w-4 h-4 fill-primary" />
          </div>
          <div className="font-bold text-sm tracking-tight text-slate-800 dark:text-slate-100">
            {data.label || 'Trigger'}
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase font-black tracking-tighter bg-primary/10 text-primary border-none">START</Badge>
      </div>
      <div className="p-4 text-xs text-slate-500">
        <div className="font-bold text-slate-400 mb-1.5 uppercase tracking-widest text-[9px]">Event Trigger</div>
        {data.event === 'customer.message.received' ? (
           <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
             <MessageSquare className="w-3.5 h-3.5 text-primary/60" />
             <span className="text-slate-700 dark:text-slate-300 font-bold truncate">
                {data.keywordSettings?.keywords?.length > 0 ? `Keyword: "${data.keywordSettings.keywords[0]}"` : 'Incoming Message'}
             </span>
           </div>
        ) : (
          <p className="font-bold text-slate-700">{data.event}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 ring-4 ring-primary/20" />
    </div>
  );
}

/**
 * MESSAGE NODE (TEXT)
 * Action: Send a text reply
 */
export function MessageNode({ data, selected }: any) {
  return (
    <div className={`shadow-xl rounded-2xl bg-white dark:bg-slate-900 border-2 min-w-[260px] transition-all duration-300 ${selected ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200 dark:border-slate-800'} overflow-hidden`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900" />
      <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3.5 border-b border-emerald-100 dark:border-emerald-900/20 flex items-center gap-2.5">
        <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-600">
          <Play className="w-4 h-4 fill-emerald-500" />
        </div>
        <div className="font-bold text-sm tracking-tight text-slate-800 dark:text-slate-100">
          {data.label || 'Send Message'}
        </div>
      </div>
      <div className="p-4">
        <div className="font-bold text-emerald-600/60 mb-1.5 uppercase tracking-widest text-[9px]">Text Payload</div>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 italic font-medium leading-relaxed">
          {data.messageContent ? `"${data.messageContent}"` : 'Configure message payload...'}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-900" />
    </div>
  );
}

/**
 * LOGIC NODE (BRANCHING)
 */
export function LogicNode({ data, selected }: any) {
  return (
    <div className={`shadow-xl rounded-2xl bg-white dark:bg-slate-900 border-1.5 min-w-[260px] transition-all duration-300 ${selected ? 'border-amber-500 ring-4 ring-amber-500/10 shadow-amber-500/10' : 'border-slate-200 dark:border-slate-800'} overflow-hidden`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500 border-2 border-white dark:border-slate-900" />
      <div className="bg-amber-50 dark:bg-amber-900/10 p-3.5 border-b border-amber-100 dark:border-amber-900/20 flex items-center gap-2.5">
        <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-600">
          <AlertCircle className="w-4 h-4 fill-amber-500" />
        </div>
        <div className="font-bold text-sm tracking-tight text-slate-800 dark:text-slate-100">
          {data.label || 'Condition'}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3">
         <div className="bg-amber-500/5 dark:bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/10 flex justify-between items-center">
            <span className="text-[10px] font-black text-amber-600 uppercase">If Case</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{data.conditionField || 'Attribute match'}</span>
         </div>
         <div className="flex justify-between items-center px-1">
            <Badge variant="outline" className="text-[9px] font-bold border-emerald-500/20 bg-emerald-500/5 text-emerald-600">TRUE</Badge>
            <Badge variant="outline" className="text-[9px] font-bold border-slate-300 text-slate-400">FALSE</Badge>
         </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '25%' }} className="w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 ring-4 ring-emerald-500/10" />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '75%' }} className="w-3.5 h-3.5 bg-slate-300 dark:bg-slate-700 border-2 border-white dark:border-slate-900" />
    </div>
  );
}
