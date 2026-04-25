'use client';

import React, { useState, useEffect } from 'react';
import { FaHistory, FaCheckCircle, FaExclamationTriangle, FaClock, FaUser, FaPhone } from 'react-icons/fa';
import { get } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

/**
 * WorkflowInspector - A premium component to audit automation performance
 */
export const WorkflowInspector = ({ workflowId, onInspectPath }) => {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await get(`/automation/engine/logs?ruleId=${workflowId}`);
        setExecutions(response.data?.logs || []);
      } catch (err) {
        console.error('Failed to fetch execution history:', err);
      } finally {
        setLoading(false);
      }
    };
    if (workflowId) fetchHistory();
  }, [workflowId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 border-l border-slate-200 w-96">
      <div className="p-4 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaHistory className="text-slate-400" size={14} />
          <h3 className="font-bold text-slate-800 text-sm">Execution History</h3>
        </div>
        <span className="bg-slate-100 text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-500">
          Last 50 Runs
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {executions.length === 0 ? (
          <div className="py-20 text-center">
            <div className="p-4 bg-white rounded-2xl inline-block mb-3 border border-slate-100 shadow-sm">
              <FaClock className="text-slate-200" size={32} />
            </div>
            <p className="text-xs text-slate-400 font-medium">No executions yet</p>
          </div>
        ) : (
          executions.map((exec) => (
            <div 
              key={exec._id}
              onClick={() => onInspectPath?.(exec.actionsExecuted)}
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    exec.status === 'completed' ? 'bg-emerald-500' : 
                    exec.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                  <span className="text-[11px] font-bold text-slate-700 uppercase">
                    {exec.status}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {formatDistanceToNow(new Date(exec.createdAt), { addSuffix: true })}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <FaUser size={12} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {exec.triggerEvent?.contactId?.name || 'Unknown Contact'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {exec.triggerEvent?.contactId?.phoneNumber || 'No Phone'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {exec.actionsExecuted.map((action, idx) => (
                  <React.Fragment key={idx}>
                    <div className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-medium text-slate-600">
                      {action.type.split('_').join(' ')}
                    </div>
                    {idx < exec.actionsExecuted.length - 1 && (
                      <div className="w-2 h-px bg-slate-200" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t bg-white">
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-3">
          <FaPhone className="text-blue-500 mt-0.5" size={12} />
          <p className="text-[10px] text-blue-700 leading-relaxed">
            Click an execution to highlight the specific path taken by this user on the visual builder canvas.
          </p>
        </div>
      </div>
    </div>
  );
};
