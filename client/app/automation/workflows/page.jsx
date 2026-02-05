'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaRobot, FaPlus, FaSearch, FaEllipsisV, FaWhatsapp, FaInstagram, FaCog, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaEye, FaChevronDown } from 'react-icons/fa';
import Link from 'next/link';
import { get, post, del } from '../../../lib/api';

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    enabled: 'all',
    trigger: 'all',
    search: ''
  });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadWorkflows();
  }, [filters]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.enabled !== 'all') params.append('enabled', filters.enabled);
      if (filters.trigger !== 'all') params.append('trigger', filters.trigger);

      const data = await get(`/automation/rules?${params.toString()}`);
      
      // Ensure data is an array
      let workflowList = Array.isArray(data) ? data : (Array.isArray(data?.rules) ? data.rules : []);
      
      // Filter by search term
      if (filters.search) {
        workflowList = workflowList.filter(w => 
          w.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
          w.description?.toLowerCase().includes(filters.search.toLowerCase())
        );
      }

      setWorkflows(workflowList);
      setError('');
    } catch (err) {
      setError('Error loading workflows');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflow = async (id, e) => {
    e.stopPropagation();
    try {
      await post(`/automation/rules/${id}/enable`);
      setWorkflows(workflows.map(w => 
        w._id === id ? { ...w, enabled: !w.enabled } : w
      ));
    } catch (err) {
      console.error('Error toggling workflow:', err);
    }
  };

  const deleteWorkflow = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await del(`/automation/rules/${id}`);
      setWorkflows(workflows.filter(w => w._id !== id));
    } catch (err) {
      console.error('Error deleting workflow:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="text-teal-600">⚙️</span> Workflows
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Automate your WhatsApp business processes</p>
            </div>
            <button
              onClick={() => router.push('/automation/workflows/create')}
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
            >
              <FaPlus /> New Workflow
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search
              </label>
              <input
                type="text"
                placeholder="Search workflows..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Trigger Type
              </label>
              <select
                value={filters.trigger}
                onChange={(e) => setFilters({ ...filters, trigger: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Triggers</option>
                <option value="message_received">Message Received</option>
                <option value="status_updated">Status Updated</option>
                <option value="keyword">Keyword Match</option>
                <option value="tag_added">Tag Added</option>
                <option value="campaign_completed">Campaign Completed</option>
                <option value="ad_lead">Ad Lead</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filters.enabled}
                onChange={(e) => setFilters({ ...filters, enabled: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                &nbsp;
              </label>
              <button
                onClick={() => setFilters({ enabled: 'all', trigger: 'all', search: '' })}
                className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Workflows List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">Loading workflows...</p>
            </div>
          ) : workflows.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">No workflows found</p>
              <button
                onClick={() => router.push('/automation/workflows/create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg"
              >
                <FaPlus /> Create First Workflow
              </button>
            </div>
          ) : (
            workflows.map((workflow) => (
              <div key={workflow._id} className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
                <div 
                  className="p-6 cursor-pointer flex items-center justify-between"
                  onClick={() => setExpandedId(expandedId === workflow._id ? null : workflow._id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {workflow.name}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        workflow.enabled 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {workflow.enabled ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        {workflow.trigger === 'message_received' ? '📨 Message' : 
                         workflow.trigger === 'status_updated' ? '📊 Status' :
                         workflow.trigger === 'keyword' ? '🔑 Keyword' :
                         workflow.trigger === 'tag_added' ? '🏷️ Tag' :
                         workflow.trigger === 'campaign_completed' ? '🎯 Campaign' :
                         '📱 Ad Lead'}
                      </span>
                    </div>
                    {workflow.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm">{workflow.description}</p>
                    )}
                    <div className="flex gap-6 mt-3 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                      <span>Executions: <span className="font-semibold">{workflow.executionCount || 0}</span></span>
                      <span>Success: <span className="font-semibold text-green-600">{workflow.successCount || 0}</span></span>
                      <span>Failed: <span className="font-semibold text-red-600">{workflow.failureCount || 0}</span></span>
                      {workflow.lastExecutedAt && (
                        <span>Last run: {new Date(workflow.lastExecutedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <FaChevronDown className={`transition-transform ${expandedId === workflow._id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === workflow._id && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-700/50">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Trigger Type</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{workflow.trigger}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Daily Limit</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {workflow.dailyExecutionLimit || 'Unlimited'}
                        </p>
                      </div>
                    </div>

                    {workflow.condition && Object.keys(workflow.condition).length > 0 && (
                      <div className="mb-6">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Condition</p>
                        <div className="bg-white dark:bg-gray-800 rounded p-3 text-sm overflow-auto max-h-40">
                          <pre className="font-mono text-xs text-gray-700 dark:text-gray-300">
                            {JSON.stringify(workflow.condition, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {workflow.actions && workflow.actions.length > 0 && (
                      <div className="mb-6">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Actions ({workflow.actions.length})</p>
                        <div className="space-y-2">
                          {workflow.actions.map((action, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-800 rounded p-3 text-sm">
                              <p className="font-semibold text-gray-900 dark:text-white mb-1">
                                {idx + 1}. {action.type}
                              </p>
                              <pre className="font-mono text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-20">
                                {JSON.stringify(action, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={(e) => toggleWorkflow(workflow._id, e)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                          workflow.enabled
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                        }`}
                      >
                        {workflow.enabled ? <FaToggleOff /> : <FaToggleOn />}
                        {workflow.enabled ? 'Disable' : 'Enable'}
                      </button>

                      <Link
                        href={`/automation/workflows/view/${workflow._id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 rounded-lg font-medium transition-colors"
                      >
                        <FaEye /> View
                      </Link>

                      <Link
                        href={`/automation/workflows/edit/${workflow._id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 rounded-lg font-medium transition-colors"
                      >
                        <FaEdit /> Edit
                      </Link>

                      <button
                        onClick={(e) => deleteWorkflow(workflow._id, e)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 rounded-lg font-medium transition-colors"
                      >
                        <FaTrash /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
