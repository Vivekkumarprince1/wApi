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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/automation/workflows"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <FaArrowLeft /> Back
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{workflow.name}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">{workflow.description}</p>
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'details' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('executions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'executions' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
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
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Executions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{workflow.totalExecutions || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Successful</p>
                <p className="text-2xl font-bold text-green-600">{workflow.successfulExecutions || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Failed</p>
                <p className="text-2xl font-bold text-red-600">{workflow.failedExecutions || 0}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Success Rate</p>
                <p className="text-2xl font-bold text-blue-600">
                  {workflow.totalExecutions > 0 
                    ? Math.round((workflow.successfulExecutions / workflow.totalExecutions) * 100) 
                    : 0}%
                </p>
              </div>
            </div>

            {/* Configuration */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trigger Type</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{workflow.trigger}</p>
                </div>

                {Object.keys(workflow.condition || {}).length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Conditions</p>
                    <pre className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 dark:text-gray-200">
                      {JSON.stringify(workflow.condition, null, 2)}
                    </pre>
                  </div>
                )}

                {workflow.actions && workflow.actions.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Actions ({workflow.actions.length})</p>
                    <div className="space-y-2">
                      {workflow.actions.map((action, idx) => (
                        <div key={idx} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          <p className="font-medium text-gray-900 dark:text-white">Action {idx + 1}: {action.type}</p>
                          <pre className="mt-2 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                            {JSON.stringify(action, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workflow.dailyExecutionLimit && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Daily Limit</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">{workflow.dailyExecutionLimit} executions/day</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Link
                href={`/automation/workflows/edit/${workflow._id}`}
                className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-center transition-colors"
              >
                Edit Workflow
              </Link>
              <button className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        )}

        {activeTab === 'executions' && (
          <div>
            {executions.length === 0 ? (
              <div className="text-center py-12">
                <FaClock className="mx-auto text-4xl text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No executions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Time</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Duration</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Trigger</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {executions.map((exec) => (
                      <tr key={exec._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {new Date(exec.executedAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {exec.status === 'success' ? (
                              <>
                                <FaCheckCircle className="text-green-600" />
                                <span className="text-sm text-green-600 font-medium">Success</span>
                              </>
                            ) : (
                              <>
                                <FaTimesCircle className="text-red-600" />
                                <span className="text-sm text-red-600 font-medium">Failed</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {exec.duration ? `${exec.duration}ms` : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{exec.triggerData?.type || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
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
