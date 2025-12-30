'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaChevronDown, FaComments, FaInstagram, FaGift, FaHashtag } from 'react-icons/fa';
import Link from 'next/link';

const PRESET_TEMPLATES = [
  {
    id: 'price_please',
    name: 'Price Please',
    description: 'Respond to price inquiries automatically',
    icon: '💰',
    keywords: ['price', 'cost', 'how much', '$'],
    triggerType: 'comment'
  },
  {
    id: 'giveaway',
    name: 'Giveaway',
    description: 'Auto-reply to giveaway entries',
    icon: '🎁',
    keywords: ['giveaway', 'contest', 'free'],
    triggerType: 'comment'
  },
  {
    id: 'lead_gen',
    name: 'Lead Generation',
    description: 'Capture leads and redirect to WhatsApp',
    icon: '📋',
    keywords: ['info', 'interested', 'tell me'],
    triggerType: 'dm'
  },
  {
    id: 'story_auto_reply',
    name: 'Story Auto Reply',
    description: 'Reply to story mentions and replies',
    icon: '📖',
    keywords: [],
    triggerType: 'story_reply'
  }
];

export default function InstagramQuickflowsPage() {
  const router = useRouter();
  const [quickflows, setQuickflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [filters, setFilters] = useState({
    enabled: 'all',
    type: 'all',
    triggerType: 'all',
    search: ''
  });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadQuickflows();
  }, [filters]);

  const loadQuickflows = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();

      if (filters.enabled !== 'all') params.append('enabled', filters.enabled);
      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.triggerType !== 'all') params.append('triggerType', filters.triggerType);

      const response = await fetch(`/api/v1/instagram-quickflows?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        let data = await response.json();

        // Filter by search term
        if (filters.search) {
          data = data.filter(qf =>
            qf.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
            qf.keywords?.some(k => k.includes(filters.search.toLowerCase()))
          );
        }

        setQuickflows(data);
        setError('');
      } else {
        setError('Failed to load quickflows');
      }
    } catch (err) {
      setError('Error: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id, enabled) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/instagram-quickflows/${id}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const updated = await response.json();
        setQuickflows(quickflows.map(qf => qf._id === id ? updated : qf));
      }
    } catch (err) {
      console.error('Error toggling quickflow:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this quickflow?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/instagram-quickflows/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setQuickflows(quickflows.filter(qf => qf._id !== id));
      }
    } catch (err) {
      console.error('Error deleting quickflow:', err);
    }
  };

  const handleCreateFromPreset = (preset) => {
    router.push(`/automation/instagram-quickflows/create?preset=${preset.id}`);
  };

  const resetFilters = () => {
    setFilters({ enabled: 'all', type: 'all', triggerType: 'all', search: '' });
  };

  const getTriggerTypeIcon = (triggerType) => {
    switch (triggerType) {
      case 'comment':
        return <FaComments className="text-blue-500" />;
      case 'dm':
        return <FaInstagram className="text-purple-500" />;
      case 'story_reply':
        return <FaHashtag className="text-pink-500" />;
      case 'mention':
        return <FaGift className="text-yellow-500" />;
      default:
        return <FaComments className="text-gray-500" />;
    }
  };

  const getTriggerTypeLabel = (triggerType) => {
    return {
      'comment': 'Comments',
      'dm': 'Direct Messages',
      'story_reply': 'Story Replies',
      'mention': 'Mentions'
    }[triggerType] || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Instagram Quickflows</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Automatically reply to Instagram comments, DMs, and story mentions</p>
            </div>
            <button
              onClick={() => setShowPresetModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
            >
              <FaPlus /> Create Quickflow
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Preset Modal */}
        {showPresetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Quickflow Type</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Start with a preset or create a custom quickflow</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {PRESET_TEMPLATES.map((preset) => (
                    <div
                      key={preset.id}
                      className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-teal-500 dark:hover:border-teal-400 cursor-pointer transition-all hover:shadow-lg"
                      onClick={() => handleCreateFromPreset(preset)}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <span className="text-3xl">{preset.icon}</span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{preset.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{preset.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-3">
                        {getTriggerTypeIcon(preset.triggerType)}
                        <span>{getTriggerTypeLabel(preset.triggerType)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <button
                    onClick={() => router.push('/automation/instagram-quickflows/create')}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                  >
                    + Create Custom Quickflow
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setShowPresetModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by name..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Trigger Type
              </label>
              <select
                value={filters.triggerType}
                onChange={(e) => setFilters({ ...filters, triggerType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Triggers</option>
                <option value="comment">Comments</option>
                <option value="dm">Direct Messages</option>
                <option value="story_reply">Story Replies</option>
                <option value="mention">Mentions</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filters.enabled}
                onChange={(e) => setFilters({ ...filters, enabled: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="true">Enabled Only</option>
                <option value="false">Disabled Only</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Quickflows List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading quickflows...</p>
          </div>
        ) : quickflows.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🚀</div>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">No quickflows yet</p>
            <button
              onClick={() => setShowPresetModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium"
            >
              <FaPlus /> Create Your First Quickflow
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {quickflows.map((qf) => (
              <div
                key={qf._id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedId(expandedId === qf._id ? null : qf._id)}
                  className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{qf.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        qf.enabled
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {qf.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-2">
                        {getTriggerTypeIcon(qf.triggerType)}
                        {getTriggerTypeLabel(qf.triggerType)}
                      </span>
                      {qf.statistics?.totalTriggered > 0 && (
                        <span>
                          Triggered: <span className="font-medium text-gray-900 dark:text-white">{qf.statistics.totalTriggered}</span> times
                        </span>
                      )}
                    </div>
                  </div>
                  <FaChevronDown
                    className={`text-gray-400 transition-transform ${expandedId === qf._id ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Expanded Details */}
                {expandedId === qf._id && (
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    {qf.keywords && qf.keywords.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Keywords</p>
                        <div className="flex flex-wrap gap-2">
                          {qf.keywords.map((keyword) => (
                            <span key={keyword} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trigger Type</p>
                        <p className="font-medium text-gray-900 dark:text-white">{getTriggerTypeLabel(qf.triggerType)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Type</p>
                        <p className="font-medium text-gray-900 dark:text-white capitalize">{qf.type?.replace('_', ' ')}</p>
                      </div>
                    </div>

                    {qf.response && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Response</p>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 text-sm text-gray-900 dark:text-gray-100">
                          {qf.response.message || qf.response.template}
                        </div>
                      </div>
                    )}

                    {qf.response?.redirectToWhatsApp && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-400">
                        ✓ This quickflow redirects to WhatsApp
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Times Triggered</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{qf.statistics?.totalTriggered || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Replies Sent</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{qf.statistics?.totalRepliesSent || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Success Rate</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {qf.statistics?.totalTriggered ? Math.round((qf.statistics.totalRepliesSent / qf.statistics.totalTriggered) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    onClick={() => handleToggle(qf._id, !qf.enabled)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      qf.enabled
                        ? 'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {qf.enabled ? <FaToggleOn /> : <FaToggleOff />}
                    {qf.enabled ? 'Disable' : 'Enable'}
                  </button>

                  <Link
                    href={`/automation/instagram-quickflows/edit/${qf._id}`}
                    className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium transition-colors"
                  >
                    <FaEdit /> Edit
                  </Link>

                  <button
                    onClick={() => handleDelete(qf._id)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors"
                  >
                    <FaTrash /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
