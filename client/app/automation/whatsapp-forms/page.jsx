'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaDownload, FaChevronDown, FaEye } from 'react-icons/fa';
import Link from 'next/link';
import { get, post, del } from '@/lib/api';
import { toast } from 'react-toastify';

export default function WhatsAppFormsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    search: ''
  });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadForms();
  }, [filters, activeTab]);

  const loadForms = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (activeTab === 'draft') params.append('status', 'draft');
      if (activeTab === 'published') params.append('status', 'published');
      if (filters.search) params.append('search', filters.search);

      const data = await get(`/whatsapp-forms${params.toString() ? '?' + params : ''}`);
      setForms(data || []);
      setError('');
    } catch (err) {
      setError('Error: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (id) => {
    try {
      await post(`/whatsapp-forms/${id}/publish`);
      setForms(forms.map(f => f._id === id ? { ...f, status: 'published' } : f));
      toast?.success?.('Form published');
    } catch (err) {
      console.error('Error publishing form:', err);
      toast?.error?.('Failed to publish form');
    }
  };

  const handleUnpublish = async (id) => {
    try {
      await post(`/whatsapp-forms/${id}/unpublish`);
      setForms(forms.map(f => f._id === id ? { ...f, status: 'draft' } : f));
      toast?.success?.('Form unpublished');
    } catch (err) {
      console.error('Error unpublishing form:', err);
      toast?.error?.('Failed to unpublish form');
    }
  };

  const handleSync = async (id) => {
    try {
      await post(`/whatsapp-forms/${id}/sync`);
      loadForms();
      toast?.success?.('Form synced');
    } catch (err) {
      console.error('Error syncing form:', err);
      toast?.error?.('Failed to sync form');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this form and all its responses?')) return;

    try {
      await del(`/whatsapp-forms/${id}`);
      setForms(forms.filter(f => f._id !== id));
      toast?.success?.('Form deleted');
    } catch (err) {
      console.error('Error deleting form:', err);
      toast?.error?.('Failed to delete form');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">WhatsApp Forms</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Create interactive forms to collect customer information</p>
            </div>
            <Link
              href="/automation/whatsapp-forms/create"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <FaPlus /> Create Form
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-green-600 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            All Forms
          </button>
          <button
            onClick={() => setActiveTab('draft')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'draft'
                ? 'border-green-600 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Draft
          </button>
          <button
            onClick={() => setActiveTab('published')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'published'
                ? 'border-green-600 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Published
          </button>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search forms by name..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Forms Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading forms...</p>
          </div>
        ) : forms.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">No forms yet</p>
            <Link
              href="/automation/whatsapp-forms/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              <FaPlus /> Create Your First Form
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Form Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Responses</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Completion</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {forms.map((form) => (
                  <tr key={form._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{form.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{form.description}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        form.status === 'published'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      }`}>
                        {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {form.statistics?.totalResponses || 0}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {form.statistics?.completedResponses || 0} completed
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {form.statistics?.completionRate || 0}%
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/automation/whatsapp-forms/edit/${form._id}`}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FaEdit />
                        </Link>

                        <button
                          onClick={() => handleSync(form._id)}
                          className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                          title="Sync Data"
                        >
                          <FaDownload />
                        </button>

                        {form.status === 'draft' ? (
                          <button
                            onClick={() => handlePublish(form._id)}
                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Publish"
                          >
                            <FaToggleOff className="rotate-180" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnpublish(form._id)}
                            className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                            title="Unpublish"
                          >
                            <FaToggleOn />
                          </button>
                        )}

                        <Link
                          href={`/automation/whatsapp-forms/${form._id}/responses`}
                          className="p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                          title="View Responses"
                        >
                          <FaEye />
                        </Link>

                        <button
                          onClick={() => handleDelete(form._id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
