'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaEye, FaChevronDown } from 'react-icons/fa';
import Link from 'next/link';

export default function AutoRepliesPage() {
  const router = useRouter();
  const [autoReplies, setAutoReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    enabled: 'all',
    search: ''
  });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadAutoReplies();
  }, [filters]);

  const loadAutoReplies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.enabled !== 'all') params.append('enabled', filters.enabled);

      const response = await fetch(`/api/v1/auto-replies?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        let data = await response.json();
        
        // Filter by search term
        if (filters.search) {
          data = data.filter(ar =>
            ar.keywords.some(k => k.includes(filters.search.toLowerCase())) ||
            ar.templateName?.toLowerCase().includes(filters.search.toLowerCase())
          );
        }

        setAutoReplies(data);
        setError('');
      } else {
        setError('Failed to load auto-replies');
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
      const response = await fetch(`/api/v1/auto-replies/${id}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const updated = await response.json();
        setAutoReplies(autoReplies.map(ar => ar._id === id ? updated : ar));
      }
    } catch (err) {
      console.error('Error toggling auto-reply:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this auto-reply?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/auto-replies/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setAutoReplies(autoReplies.filter(ar => ar._id !== id));
      }
    } catch (err) {
      console.error('Error deleting auto-reply:', err);
    }
  };

  const resetFilters = () => {
    setFilters({ enabled: 'all', search: '' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Auto Replies</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Automatically respond to incoming messages</p>
            </div>
            <Link
              href="/automation/auto-replies/create"
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
            >
              <FaPlus /> Create Auto-Reply
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Keywords
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by keyword..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
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
                <option value="all">All Auto-Replies</option>
                <option value="true">Enabled Only</option>
                <option value="false">Disabled Only</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Auto-Replies List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading auto-replies...</p>
          </div>
        ) : autoReplies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No auto-replies found</p>
            <Link
              href="/automation/auto-replies/create"
              className="inline-flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium"
            >
              <FaPlus /> Create Your First Auto-Reply
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {autoReplies.map((autoReply) => (
              <div
                key={autoReply._id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedId(expandedId === autoReply._id ? null : autoReply._id)}
                  className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Keywords: {autoReply.keywords.join(', ')}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        autoReply.enabled
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {autoReply.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Template: <span className="font-medium">{autoReply.templateName}</span> • 
                      Match Mode: <span className="font-medium">{autoReply.matchMode}</span> •
                      Replies Sent: <span className="font-medium">{autoReply.totalRepliesSent || 0}</span>
                    </p>
                  </div>
                  <FaChevronDown 
                    className={`text-gray-400 transition-transform ${expandedId === autoReply._id ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Expanded Details */}
                {expandedId === autoReply._id && (
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Keywords</p>
                        <div className="flex flex-wrap gap-2">
                          {autoReply.keywords.map((keyword) => (
                            <span key={keyword} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Template</p>
                          <p className="font-medium text-gray-900 dark:text-white">{autoReply.templateName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Match Mode</p>
                          <p className="font-medium text-gray-900 dark:text-white capitalize">{autoReply.matchMode}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Replies Sent</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{autoReply.totalRepliesSent || 0}</p>
                        </div>
                        {autoReply.lastSentAt && (
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Last Sent</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {new Date(autoReply.lastSentAt).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-400">
                        💡 This auto-reply will send once per contact in a 24-hour window
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                  <button
                    onClick={() => handleToggle(autoReply._id, !autoReply.enabled)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      autoReply.enabled
                        ? 'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {autoReply.enabled ? <FaToggleOn /> : <FaToggleOff />}
                    {autoReply.enabled ? 'Disable' : 'Enable'}
                  </button>

                  <Link
                    href={`/automation/auto-replies/edit/${autoReply._id}`}
                    className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium transition-colors"
                  >
                    <FaEdit /> Edit
                  </Link>

                  <button
                    onClick={() => handleDelete(autoReply._id)}
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

