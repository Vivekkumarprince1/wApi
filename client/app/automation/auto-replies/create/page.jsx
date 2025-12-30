'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaPlus, FaTrash } from 'react-icons/fa';
import Link from 'next/link';

export default function CreateAutoReplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    keywords: [''],
    template: '',
    matchMode: 'contains',
    enabled: true
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/templates?status=APPROVED', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data || []);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleKeywordChange = (index, value) => {
    const newKeywords = [...formData.keywords];
    newKeywords[index] = value.toLowerCase();
    setFormData({ ...formData, keywords: newKeywords });
  };

  const addKeyword = () => {
    if (formData.keywords.length < 10) {
      setFormData({ ...formData, keywords: [...formData.keywords, ''] });
    }
  };

  const removeKeyword = (index) => {
    const newKeywords = formData.keywords.filter((_, i) => i !== index);
    setFormData({ ...formData, keywords: newKeywords });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    const validKeywords = formData.keywords.filter(k => k.trim());
    if (validKeywords.length === 0) {
      setError('Please add at least one keyword');
      return;
    }

    if (validKeywords.length > 10) {
      setError('Maximum 10 keywords allowed');
      return;
    }

    if (!formData.template) {
      setError('Please select a template');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/auto-replies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keywords: validKeywords,
          template: formData.template,
          matchMode: formData.matchMode,
          enabled: formData.enabled
        })
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/automation/auto-replies');
      } else {
        setError(data.message || 'Failed to create auto-reply');
      }
    } catch (err) {
      setError('Error: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/automation/auto-replies"
            className="inline-flex items-center gap-2 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 mb-4"
          >
            <FaArrowLeft /> Back to Auto-Replies
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Auto-Reply</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Set up automatic responses for specific keywords</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Keywords */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Keywords</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add keywords that will trigger this auto-reply (maximum 10)
            </p>

            <div className="space-y-3 mb-4">
              {formData.keywords.map((keyword, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => handleKeywordChange(index, e.target.value)}
                    placeholder={`Keyword ${index + 1}`}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {formData.keywords.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeKeyword(index)}
                      className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {formData.keywords.length < 10 && (
              <button
                type="button"
                onClick={addKeyword}
                className="flex items-center gap-2 px-4 py-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg font-medium"
              >
                <FaPlus /> Add Keyword
              </button>
            )}
          </div>

          {/* Match Mode */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Match Mode</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose how incoming messages should match your keywords
            </p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <input
                  type="radio"
                  name="matchMode"
                  value="contains"
                  checked={formData.matchMode === 'contains'}
                  onChange={(e) => setFormData({ ...formData, matchMode: e.target.value })}
                  className="w-4 h-4 text-teal-600"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Contains</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Keyword can be anywhere in the message</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <input
                  type="radio"
                  name="matchMode"
                  value="exact"
                  checked={formData.matchMode === 'exact'}
                  onChange={(e) => setFormData({ ...formData, matchMode: e.target.value })}
                  className="w-4 h-4 text-teal-600"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Exact Match</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Message must match keyword exactly</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <input
                  type="radio"
                  name="matchMode"
                  value="starts_with"
                  checked={formData.matchMode === 'starts_with'}
                  onChange={(e) => setFormData({ ...formData, matchMode: e.target.value })}
                  className="w-4 h-4 text-teal-600"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Starts With</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Message must start with the keyword</p>
                </div>
              </label>
            </div>
          </div>

          {/* Template */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reply Template</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select an approved template to use as the auto-reply
            </p>

            {templatesLoading ? (
              <p className="text-gray-600 dark:text-gray-400">Loading templates...</p>
            ) : templates.length === 0 ? (
              <p className="text-red-600 dark:text-red-400">No approved templates found. Create a template first.</p>
            ) : (
              <select
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status</h2>
            
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-teal-600 rounded"
              />
              <span className="text-gray-900 dark:text-white font-medium">
                Enable this auto-reply immediately
              </span>
            </label>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">How Auto-Replies Work</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
              <li>Auto-replies are evaluated before workflows</li>
              <li>Each contact receives a maximum of one auto-reply per 24-hour period</li>
              <li>Only approved templates can be used for auto-replies</li>
              <li>You can create up to {formData.template ? 'multiple' : 'several'} auto-replies per workspace</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || templatesLoading}
              className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create Auto-Reply'}
            </button>
            <Link
              href="/automation/auto-replies"
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
