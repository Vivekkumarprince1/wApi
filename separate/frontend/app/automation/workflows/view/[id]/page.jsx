'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  FaArrowLeft, FaCheckCircle, FaTimesCircle, FaClock, FaBolt, FaFilter, 
  FaCommentDots, FaUserPlus, FaTag, FaSave, FaLink, FaRobot, FaDatabase, FaHistory, FaInfoCircle,
  FaArrowRight, FaExclamationTriangle
} from 'react-icons/fa';
import Link from 'next/link';
import { get } from '@/lib/api';
import { WorkflowCanvas, FlowNode, NodeConnector } from '@/components/features/automation/FlowComponents';

const triggerEvents = [
  { value: 'customer.message.received', label: '📨 Customer Message Received', icon: FaCommentDots },
  { value: 'conversation.created', label: '🆕 New Conversation Started', icon: FaBolt },
  { value: 'first.agent.reply', label: '👤 First Agent Reply', icon: FaUserPlus },
  { value: 'conversation.closed', label: '✅ Conversation Closed', icon: FaCheckCircle },
  { value: 'sla.breached', label: '⚠️ SLA Breached', icon: FaExclamationTriangle },
  { value: 'contact.created', label: '👤 New Contact Created', icon: FaUserPlus },
  { value: 'contact.tag.added', label: '🏷️ Tag Added to Contact', icon: FaTag },
  { value: 'deal.stage.changed', label: '📈 Deal Stage Changed', icon: FaBolt },
  { value: 'campaign.message.sent', label: '📣 Campaign Message Sent', icon: FaLink },
  { value: 'form.submitted', label: '📝 Form/Flow Submitted', icon: FaSave }
];

const actionTypes = [
  { value: 'send_template_message', label: '💬 Send Template', icon: FaCommentDots },
  { value: 'send_text_message', label: '✍️ Send Text (24h)', icon: FaCommentDots },
  { value: 'send_interactive_message', label: '🔘 Send Buttons/List', icon: FaFilter },
  { value: 'send_form', label: '📝 Send WhatsApp Form', icon: FaSave },
  { value: 'save_response', label: '💾 Save User Response', icon: FaSave },
  { value: 'assign_conversation', label: '👤 Assign to Agent/Team', icon: FaUserPlus },
  { value: 'add_tag', label: '🏷️ Add Tag', icon: FaTag },
  { value: 'remove_tag', label: '❌ Remove Tag', icon: FaTag },
  { value: 'create_deal', label: '💰 Create New Deal', icon: FaBolt },
  { value: 'move_pipeline_stage', label: '➡️ Move Deal Stage', icon: FaBolt },
  { value: 'notify_agent', label: '🔔 Internal Notification', icon: FaBolt },
  { value: 'add_note', label: '📝 Add Internal Note', icon: FaSave },
  { value: 'mark_as_resolved', label: '✅ Mark Resolved', icon: FaCheckCircle },
  { value: 'notify_webhook', label: '🔗 External Webhook', icon: FaLink },
  { value: 'delay', label: '⏱️ Delay Next Action', icon: FaClock }
];


export default function ViewWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id;

  const [workflow, setWorkflow] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    loadWorkflow();
  }, [workflowId]);

  const loadWorkflow = async () => {
    try {
      const [workflowRes, executionsRes] = await Promise.all([
        get(`/automation/engine/rules/${workflowId}`),
        get(`/automation/engine/logs?ruleId=${workflowId}`)
      ]);

      if (workflowRes && workflowRes.success && workflowRes.data) {
        setWorkflow(workflowRes.data.rule || workflowRes.data);
      } else {
        setWorkflow(workflowRes);
      }

      if (executionsRes && executionsRes.success && executionsRes.data) {
        setExecutions(executionsRes.data.logs || executionsRes.data);
      } else {
        setExecutions(executionsRes || []);
      }
    } catch (err) {
      setError('Error loading workflow: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          <p className="mt-4 text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Link href="/automation/workflows" className="text-red-600 dark:text-red-400 hover:underline mt-4 inline-block">
              Back to Workflows
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/automation/workflows"
              className="group flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium"
            >
              <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" /> Back to Workflows
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{workflow.name}</h1>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${workflow.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {workflow.enabled ? 'Active' : 'Paused'}
                </div>
              </div>
              <p className="text-slate-500 text-sm">{workflow.description || 'No description provided.'}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/automation/workflows/edit/${workflow._id}`}
                className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 transition-all active:scale-95 shadow-sm flex items-center gap-2"
              >
                Edit Workflow
              </Link>
              <button className="px-6 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl font-bold transition-all active:scale-95">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-[105px] z-40">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-2 flex items-center gap-2 font-bold text-sm transition-all relative ${activeTab === 'details' ? 'text-primary' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <FaInfoCircle size={14} /> Details & Flow
              {activeTab === 'details' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('executions')}
              className={`py-4 px-2 flex items-center gap-2 font-bold text-sm transition-all relative ${activeTab === 'executions' ? 'text-primary' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <FaHistory size={14} /> Execution History
              <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px]">{executions.length}</span>
              {activeTab === 'executions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Visual Side */}
            <div className="lg:col-span-3 space-y-8">
              <section className="bg-white rounded-[2rem] border border-slate-200 shadow-premium p-10">
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Visual Workflow</h3>
                    <p className="text-slate-500 text-sm mt-1">Live visualization of your automation logic.</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl">
                    <FaRobot className="text-emerald-500 text-xl" />
                  </div>
                </div>

                <WorkflowCanvas>
                  {/* 1. TRIGGER */}
                  <FlowNode 
                    type="trigger" 
                    title="TRIGGER" 
                    icon={triggerEvents.find(t => t.value === (workflow.trigger?.event || workflow.trigger))?.icon || FaBolt}
                    status="valid"
                  >
                    <div className="text-slate-700 font-medium">
                      {(() => {
                        const eventValue = workflow.trigger?.event || workflow.trigger;
                        const triggerObj = triggerEvents.find(t => t.value === eventValue);
                        return triggerObj?.label || (typeof eventValue === 'string' ? eventValue : 'Complex Trigger');
                      })()}
                    </div>
                  </FlowNode>

                  <NodeConnector />

                  {/* 2. CONDITIONS */}
                  {workflow.conditions?.map((cond, idx) => (
                    <React.Fragment key={`v-cond-${idx}`}>
                      <FlowNode type="condition" title={`CONDITION ${idx + 1}`} icon={FaFilter}>
                        <div className="text-slate-700 font-medium">
                          {cond.field} {cond.operator} "{cond.value}"
                        </div>
                      </FlowNode>
                      <NodeConnector />
                    </React.Fragment>
                  ))}

                  {/* 3. ACTIONS */}
                  {workflow.actions?.map((action, idx) => (
                    <React.Fragment key={`v-action-${idx}`}>
                      <FlowNode 
                        type="action" 
                        title={`STEP ${idx + 1}: ${action.type.replace(/_/g, ' ')}`} 
                        icon={actionTypes.find(a => a.value === action.type)?.icon || FaBolt}
                      >
                         <div className="text-slate-700 font-medium truncate">
                          {action.type === 'send_text_message' ? action.config?.messageContent : 
                           action.type === 'send_template_message' ? `Template: ${action.config?.templateId}` :
                           'Action configured'}
                        </div>
                      </FlowNode>
                      {idx < workflow.actions.length - 1 && <NodeConnector />}
                    </React.Fragment>
                  ))}
                </WorkflowCanvas>
              </section>
            </div>

            {/* Sidebar Stats & Info */}
            <div className="space-y-6">
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Performance Stats</h4>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                        <FaBolt />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Runs</p>
                        <p className="text-xl font-bold text-slate-900">{workflow.totalExecutions || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <FaCheckCircle />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Successful</p>
                        <p className="text-xl font-bold text-slate-900">{workflow.successfulExecutions || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                        <FaTimesCircle />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Failed</p>
                        <p className="text-xl font-bold text-slate-900">{workflow.failedExecutions || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 mt-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Success Rate</p>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${workflow.totalExecutions > 0 ? (workflow.successfulExecutions / workflow.totalExecutions) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-right text-xs font-bold text-emerald-600 mt-1">
                      {workflow.totalExecutions > 0 ? Math.round((workflow.successfulExecutions / workflow.totalExecutions) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </section>

              <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl">
                 <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
                  <FaInfoCircle /> Workflow Details
                </h4>
                <div className="space-y-3 mt-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Created On</p>
                    <p className="text-xs text-slate-700 font-medium">{new Date(workflow.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Daily Limit</p>
                    <p className="text-xs text-slate-700 font-medium">{workflow.rateLimit?.maxExecutions || workflow.dailyExecutionLimit || 100} runs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'executions' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-premium overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Recent Executions</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <FaClock className="text-primary" /> Real-time tracking enabled
              </div>
            </div>
            
            {executions.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaHistory className="text-3xl text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">No execution history found yet.</p>
                <p className="text-xs text-slate-400 mt-1">Runs will appear here once the workflow triggers.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Time</th>
                      <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duration</th>
                      <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trigger Data</th>
                      <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Details/Log</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {executions.map((exec) => (
                      <tr key={exec._id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-8 py-4 group-hover:pl-10 transition-all">
                          <p className="text-sm font-bold text-slate-700">{new Date(exec.executedAt).toLocaleTimeString()}</p>
                          <p className="text-[11px] text-slate-400">{new Date(exec.executedAt).toLocaleDateString()}</p>
                        </td>
                        <td className="px-8 py-4">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            exec.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 
                            exec.status === 'SKIPPED' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {exec.status === 'SUCCESS' ? <FaCheckCircle size={10} /> : 
                             exec.status === 'SKIPPED' ? <FaArrowRight size={10} /> : <FaTimesCircle size={10} />}
                            {exec.status}
                          </div>
                        </td>
                        <td className="px-8 py-4 text-sm font-medium text-slate-600">
                          {exec.duration ? <span className="flex items-center gap-1.5"><FaClock size={12} className="text-slate-300" /> {exec.duration}ms</span> : '-'}
                        </td>
                        <td className="px-8 py-4 text-sm text-slate-600">
                          <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                            {exec.triggerType ? exec.triggerType.split('.').pop() : 'Message'}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-sm text-slate-500 max-w-xs truncate italic">
                          {exec.errorMessage || exec.reason || (typeof exec.triggerMetadata === 'string' ? exec.triggerMetadata : 'Execution completed.')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

}
