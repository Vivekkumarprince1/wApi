'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaCheckCircle, FaTimesCircle, FaClock } from 'react-icons/fa';
import Link from 'next/link';
import { get } from '../../../../../lib/api';

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
      const [workflow, executions] = await Promise.all([
        get(`/automation/${workflowId}`),
        get(`/automation/${workflowId}/executions`)
      ]);

      setWorkflow(workflow);
      setExecutions(executions);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/automation/workflows"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground dark:hover:text-white"
            >
              <FaArrowLeft /> Back
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{workflow.name}</h1>
              <p className="text-muted-foreground mt-2">{workflow.description}</p>
            </div>
            <div className="text-right">
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${workflow.enabled ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                {workflow.enabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'details' ? 'border-teal-600 text-primary' : 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-white'}`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('executions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'executions' ? 'border-teal-600 text-primary' : 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-white'}`}
            >
              Execution History ({executions.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-card rounded-xl shadow p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Executions</p>
                <p className="text-2xl font-bold text-foreground">{workflow.totalExecutions || 0}</p>
              </div>
              <div className="bg-card rounded-xl shadow p-4">
                <p className="text-sm text-muted-foreground mb-1">Successful</p>
                <p className="text-2xl font-bold text-primary">{workflow.successfulExecutions || 0}</p>
              </div>
              <div className="bg-card rounded-xl shadow p-4">
                <p className="text-sm text-muted-foreground mb-1">Failed</p>
                <p className="text-2xl font-bold text-red-600">{workflow.failedExecutions || 0}</p>
              </div>
              <div className="bg-card rounded-xl shadow p-4">
                <p className="text-sm text-muted-foreground mb-1">Success Rate</p>
                <p className="text-2xl font-bold text-blue-600">
                  {workflow.totalExecutions > 0 
                    ? Math.round((workflow.successfulExecutions / workflow.totalExecutions) * 100) 
                    : 0}%
                </p>
              </div>
            </div>

            {/* Configuration */}
            <div className="bg-card rounded-xl shadow p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Trigger Type</p>
                  <p className="text-lg font-medium text-foreground">{workflow.trigger}</p>
                </div>

                {Object.keys(workflow.condition || {}).length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Conditions</p>
                    <pre className="bg-muted p-4 rounded-xl overflow-x-auto text-sm text-foreground dark:text-foreground">
                      {JSON.stringify(workflow.condition, null, 2)}
                    </pre>
                  </div>
                )}

                {workflow.actions && workflow.actions.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Actions ({workflow.actions.length})</p>
                    <div className="space-y-2">
                      {workflow.actions.map((action, idx) => (
                        <div key={idx} className="bg-muted p-3 rounded-xl">
                          <p className="font-medium text-foreground">Action {idx + 1}: {action.type}</p>
                          <pre className="mt-2 text-xs text-foreground overflow-x-auto">
                            {JSON.stringify(action, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workflow.dailyExecutionLimit && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Daily Limit</p>
                    <p className="text-lg font-medium text-foreground">{workflow.dailyExecutionLimit} executions/day</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Link
                href={`/automation/workflows/edit/${workflow._id}`}
                className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium text-center transition-colors"
              >
                Edit Workflow
              </Link>
              <button className="flex-1 px-6 py-3 border border-border rounded-xl font-medium text-foreground hover:bg-accent transition-colors">
                Delete
              </button>
            </div>
          </div>
        )}

        {activeTab === 'executions' && (
          <div>
            {executions.length === 0 ? (
              <div className="text-center py-12">
                <FaClock className="mx-auto text-4xl text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No executions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted border-b border-border dark:border-border">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Time</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Duration</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Trigger</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {executions.map((exec) => (
                      <tr key={exec._id} className="hover:bg-accent">
                        <td className="px-6 py-4 text-sm text-foreground">
                          {new Date(exec.executedAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {exec.status === 'success' ? (
                              <>
                                <FaCheckCircle className="text-primary" />
                                <span className="text-sm text-primary font-medium">Success</span>
                              </>
                            ) : (
                              <>
                                <FaTimesCircle className="text-red-600" />
                                <span className="text-sm text-red-600 font-medium">Failed</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {exec.duration ? `${exec.duration}ms` : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">{exec.triggerData?.type || '-'}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">
                          {exec.errorMessage || exec.triggerData?.message || '-'}
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
