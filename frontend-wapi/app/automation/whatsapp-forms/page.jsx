'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaDownload, FaChevronDown, FaEye } from 'react-icons/fa';
import Link from 'next/link';
import { get, post, del } from '@/lib/api';
import FlashLoader from '@/components/ui/FlashLoader';
import { toast } from '@/lib/toast';

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
    <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950 animate-in fade-in duration-700">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">WhatsApp Forms</h1>
              <p className="text-muted-foreground mt-1">Create interactive forms to collect customer information</p>
            </div>
            <Link
              href="/automation/whatsapp-forms/create"
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors"
            >
              <FaPlus /> Create Form
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors transition-all relative ${
              activeTab === 'all'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            All Forms
            {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#00a884] rounded-t-full" />}
          </button>
          <button
            onClick={() => setActiveTab('draft')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors transition-all relative ${
              activeTab === 'draft'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Draft
            {activeTab === 'draft' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#00a884] rounded-t-full" />}
          </button>
          <button
            onClick={() => setActiveTab('published')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors transition-all relative ${
              activeTab === 'published'
                ? 'border-[#00a884] text-[#00a884]'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Published
            {activeTab === 'published' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#00a884] rounded-t-full" />}
          </button>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 mb-6">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search forms by name..."
            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-[#00a884] outline-none"
          />
        </div>

        {/* Forms Table */}
        {loading ? (
          <FlashLoader />
        ) : forms.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-muted-foreground mb-6 text-lg">No forms yet</p>
            <Link
              href="/automation/whatsapp-forms/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium"
            >
              <FaPlus /> Create Your First Form
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Form Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Responses</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Completion</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {forms.map((form) => (
                  <tr key={form._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{form.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{form.description}</p>
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
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {form.statistics?.totalResponses || 0}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          {form.statistics?.completedResponses || 0} completed
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {form.statistics?.completionRate || 0}%
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {form.status === 'draft' ? (
                          <Link
                            href={`/automation/whatsapp-forms/edit/${form._id}`}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                            title="Edit Draft"
                          >
                            <FaEdit />
                          </Link>
                        ) : (
                          <button
                            disabled
                            className="p-2 text-slate-300 dark:text-slate-600 cursor-not-allowed rounded-xl"
                            title="Published Flows are locked by Meta"
                          >
                            <FaEdit />
                          </button>
                        )}

                        <button
                          onClick={() => handleSync(form._id)}
                          className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl transition-colors"
                          title="Sync Data"
                        >
                          <FaDownload />
                        </button>

                        {form.status === 'draft' ? (
                          <button
                            onClick={() => handlePublish(form._id)}
                            className="px-3 py-1.5 flex items-center gap-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold transition-colors uppercase"
                            title="Publish to Meta"
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnpublish(form._id)}
                            className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-colors"
                            title="Deprecate Flow"
                          >
                            <FaToggleOn />
                          </button>
                        )}

                        <Link
                          href={`/automation/whatsapp-forms/${form._id}/responses`}
                          className="p-2 text-primary hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl transition-colors"
                          title="View Responses"
                        >
                          <FaEye />
                        </Link>

                        <button
                          onClick={() => handleDelete(form._id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
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
