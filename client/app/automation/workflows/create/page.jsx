'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaPlus, FaTrash } from 'react-icons/fa';
import Link from 'next/link';
import { post } from '../../../../lib/api';

export default function CreateWorkflowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger: 'message_received',
    condition: {},
    actions: [],
    dailyExecutionLimit: null,
    enabled: true
  });

  const [conditionType, setConditionType] = useState('none');
  const [conditionKeywords, setConditionKeywords] = useState('');
  const [selectedActionType, setSelectedActionType] = useState('');

  const triggers = [
    { value: 'message_received', label: '📨 Message Received' },
    { value: 'status_updated', label: '📊 Status Updated' },
    { value: 'keyword', label: '🔑 Keyword Match' },
    { value: 'tag_added', label: '🏷️ Tag Added' },
    { value: 'campaign_completed', label: '🎯 Campaign Completed' },
    { value: 'ad_lead', label: '📱 Ad Lead' }
  ];

  const actionTypes = [
    { value: 'send_template', label: '💬 Send Template' },
    { value: 'assign_agent', label: '👤 Assign to Agent' },
    { value: 'add_tag', label: '🏷️ Add Tag' },
    { value: 'remove_tag', label: '❌ Remove Tag' },
    { value: 'delay', label: '⏱️ Delay' },
    { value: 'webhook', label: '🔗 Webhook' }
  ];

  const updateCondition = () => {
    if (conditionType === 'keyword' && conditionKeywords) {
      setForm({
        ...form,
        condition: {
          type: 'keyword',
          keywords: conditionKeywords.split(',').map(k => k.trim()),
          matchMode: 'contains'
        }
      });
    } else if (conditionType === 'none') {
      setForm({ ...form, condition: {} });
    }
  };

  const addAction = () => {
    if (!selectedActionType) return;

    const newAction = {
      type: selectedActionType,
      // Add default fields based on type
      ...(selectedActionType === 'send_template' && { templateId: '', params: {} }),
      ...(selectedActionType === 'assign_agent' && { assignmentType: 'round-robin' }),
      ...(selectedActionType === 'add_tag' && { tag: '' }),
      ...(selectedActionType === 'remove_tag' && { tag: '' }),
      ...(selectedActionType === 'delay' && { duration: 3600 }),
      ...(selectedActionType === 'webhook' && { url: '', method: 'POST' })
    };

    setForm({
      ...form,
      actions: [...form.actions, newAction]
    });
    setSelectedActionType('');
  };

  const updateAction = (idx, field, value) => {
    const newActions = [...form.actions];
    newActions[idx][field] = value;
    setForm({ ...form, actions: newActions });
  };

  const removeAction = (idx) => {
    setForm({
      ...form,
      actions: form.actions.filter((_, i) => i !== idx)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      setError('Workflow name is required');
      return;
    }

    if (form.actions.length === 0) {
      setError('At least one action is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const newWorkflow = await post('/automation', form);
      router.push(`/automation/workflows/view/${newWorkflow._id}`);
    } catch (err) {
      setError('Error creating workflow: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/automation/workflows"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <FaArrowLeft /> Back
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Workflow</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Workflow Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Support Auto-Reply"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this workflow do?"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Trigger Type *
                  </label>
                  <select
                    value={form.trigger}
                    onChange={(e) => setForm({ ...form, trigger: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    {triggers.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Daily Execution Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.dailyExecutionLimit || ''}
                    onChange={(e) => setForm({ ...form, dailyExecutionLimit: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Leave empty for unlimited"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
                  Enable this workflow immediately
                </label>
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Conditions (Optional)</h2>
            
            <div className="space-y-4">
              <select
                value={conditionType}
                onChange={(e) => {
                  setConditionType(e.target.value);
                  if (e.target.value === 'none') updateCondition();
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="none">No Condition (Always Match)</option>
                <option value="keyword">Keyword Matching</option>
              </select>

              {conditionType === 'keyword' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Keywords (comma-separated)
                  </label>
                  <textarea
                    value={conditionKeywords}
                    onChange={(e) => setConditionKeywords(e.target.value)}
                    placeholder="e.g., help, support, urgent"
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={updateCondition}
                    className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Update Condition
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Actions *</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add Action
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedActionType}
                  onChange={(e) => setSelectedActionType(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select action type...</option>
                  {actionTypes.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addAction}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium"
                >
                  <FaPlus /> Add
                </button>
              </div>
            </div>

            {form.actions.length > 0 && (
              <div className="space-y-4">
                {form.actions.map((action, idx) => (
                  <div key={idx} className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Action {idx + 1}: {action.type}
                      </h3>
                      <button
                        type="button"
                        onClick={() => removeAction(idx)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <FaTrash />
                      </button>
                    </div>

                    {action.type === 'send_template' && (
                      <input
                        type="text"
                        placeholder="Template ID"
                        value={action.templateId}
                        onChange={(e) => updateAction(idx, 'templateId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
                      />
                    )}

                    {action.type === 'add_tag' && (
                      <input
                        type="text"
                        placeholder="Tag name"
                        value={action.tag}
                        onChange={(e) => updateAction(idx, 'tag', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
                      />
                    )}

                    {action.type === 'remove_tag' && (
                      <input
                        type="text"
                        placeholder="Tag name"
                        value={action.tag}
                        onChange={(e) => updateAction(idx, 'tag', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
                      />
                    )}

                    {action.type === 'delay' && (
                      <input
                        type="number"
                        placeholder="Duration in seconds"
                        value={action.duration}
                        onChange={(e) => updateAction(idx, 'duration', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
                      />
                    )}

                    {action.type === 'webhook' && (
                      <input
                        type="url"
                        placeholder="Webhook URL"
                        value={action.url}
                        onChange={(e) => updateAction(idx, 'url', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create Workflow'}
            </button>
            <Link
              href="/automation/workflows"
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
