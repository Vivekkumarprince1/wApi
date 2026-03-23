'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FaArrowLeft, FaDownload, FaFilter, FaChevronDown } from 'react-icons/fa';
import Link from 'next/link';

export default function FormResponsesPage() {
  const params = useParams();
  const formId = params.id;

  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all'
  });

  useEffect(() => {
    loadData();
  }, [formId, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Load form details
      const formRes = await fetch(`/api/v1/whatsapp-forms/${formId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (formRes.ok) {
        setForm(await formRes.json());
      }

      // Load responses
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);

      const respRes = await fetch(
        `/api/v1/whatsapp-forms/${formId}/responses?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (respRes.ok) {
        const data = await respRes.json();
        setResponses(data.responses || data);
        setError('');
      }
    } catch (err) {
      setError('Error: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (responses.length === 0) {
      alert('No responses to export');
      return;
    }

    // Get all unique question titles
    const questionTitles = new Set();
    responses.forEach(resp => {
      Object.keys(resp.responses || {}).forEach(key => {
        const question = form?.questions.find(q => q.id === key);
        if (question) questionTitles.add(question.title);
      });
    });

    // Create CSV header
    const headers = ['Phone', 'Status', 'Completed At', ...Array.from(questionTitles)];
    const csv = [headers.join(',')];

    // Add rows
    responses.forEach(resp => {
      const row = [
        resp.userPhone || '',
        resp.status || '',
        resp.completedAt ? new Date(resp.completedAt).toLocaleDateString() : '',
        ...Array.from(questionTitles).map(title => {
          const question = form?.questions.find(q => q.title === title);
          return resp.responses?.[question?.id] || '';
        })
      ];
      csv.push(row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    });

    // Download
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form?.name || 'form'}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
            <p className="text-muted-foreground">Loading responses...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/automation/whatsapp-forms"
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <FaArrowLeft className="text-muted-foreground" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Form Responses</h1>
              <p className="text-muted-foreground mt-1">{form?.name}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <FaFilter className="text-muted-foreground" />
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-4 py-2 border border-border rounded-xl dark:bg-muted dark:text-foreground text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              <FaDownload /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl shadow p-6">
            <p className="text-muted-foreground text-sm font-medium">Total Responses</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {form?.statistics?.totalResponses || 0}
            </p>
          </div>

          <div className="bg-card rounded-xl shadow p-6">
            <p className="text-muted-foreground text-sm font-medium">Completed</p>
            <p className="text-3xl font-bold text-primary dark:text-green-400 mt-2">
              {form?.statistics?.completedResponses || 0}
            </p>
          </div>

          <div className="bg-card rounded-xl shadow p-6">
            <p className="text-muted-foreground text-sm font-medium">Completion Rate</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
              {form?.statistics?.completionRate || 0}%
            </p>
          </div>

          <div className="bg-card rounded-xl shadow p-6">
            <p className="text-muted-foreground text-sm font-medium">Avg Time (min)</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
              {Math.round((form?.statistics?.avgTimeSpent || 0) / 60) || 0}
            </p>
          </div>
        </div>

        {/* Responses List */}
        {responses.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-muted-foreground text-lg">No responses yet</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Phone</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Completed</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Progress</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {responses.map((response) => (
                    <tr key={response._id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{response.userPhone || 'Unknown'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          response.status === 'completed'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : response.status === 'in_progress'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-muted text-foreground dark:text-muted-foreground'
                        }`}>
                          {response.status?.replace('_', ' ').charAt(0).toUpperCase() + response.status?.slice(1).replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-muted-foreground">
                          {response.completedAt ? new Date(response.completedAt).toLocaleDateString() : '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-muted-foreground">
                          {response.currentStep}/{form?.questions?.length || 0}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setExpandedId(expandedId === response._id ? null : response._id)}
                          className="p-2 text-muted-foreground hover:bg-accent rounded-xl transition-colors"
                        >
                          <FaChevronDown className={`transition-transform ${expandedId === response._id ? 'rotate-180' : ''}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Expanded Response Details */}
            {expandedId && responses.find(r => r._id === expandedId) && (
              <div className="border-t border-border bg-muted/30 p-6">
                <div className="mb-6">
                  <h3 className="font-semibold text-foreground mb-4">
                    Response Details
                  </h3>
                  {Object.entries(responses.find(r => r._id === expandedId).responses || {}).map(([qId, answer]) => {
                    const question = form?.questions.find(q => q.id === qId);
                    return (
                      <div key={qId} className="mb-4">
                        <p className="text-sm font-medium text-muted-foreground">{question?.title}</p>
                        <p className="mt-1 text-foreground">{answer}</p>
                      </div>
                    );
                  })}
                </div>

                {responses.find(r => r._id === expandedId).convertedToLead && (
                  <div className="pt-4 border-t border-border">
                    <span className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                      ✓ Converted to Lead
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}