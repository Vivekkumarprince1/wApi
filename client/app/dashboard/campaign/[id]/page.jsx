'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaPause, FaPlay, FaSync, FaTrash } from 'react-icons/fa';
import { get, post, del } from '../../../../lib/api';
import { toast } from 'react-toastify';

export default function CampaignDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params?.id;

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [campaign, setCampaign] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [messages, setMessages] = useState([]);

  const loadData = async () => {
    if (!campaignId) return;

    try {
      setLoading(true);
      setError('');

      const [campaignRes, progressRes, summaryRes, messagesRes] = await Promise.all([
        get(`/campaigns/${campaignId}`).catch(() => null),
        get(`/campaigns/${campaignId}/progress`).catch(() => null),
        get(`/campaigns/${campaignId}/summary`).catch(() => null),
        get(`/campaigns/${campaignId}/messages?limit=25`).catch(() => null)
      ]);

      setCampaign(campaignRes?.campaign || null);
      setProgressData(progressRes || null);
      setSummaryData(summaryRes || null);
      setMessages(messagesRes?.messages || []);
    } catch (err) {
      console.error('Failed to load campaign details:', err);
      setError(err.message || 'Failed to load campaign details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [campaignId]);

  const status = (campaign?.status || '').toLowerCase();

  const statusChip = useMemo(() => {
    const map = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
      queued: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      sending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      paused: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return map[status] || 'bg-muted text-muted-foreground';
  }, [status]);

  const handleAction = async (action) => {
    try {
      setActionLoading(true);
      const endpoint = action === 'start' ? 'enqueue' : action;
      await post(`/campaigns/${campaignId}/${endpoint}`, {});
      toast.success(`Campaign ${action} successful`);
      await loadData();
    } catch (err) {
      toast.error(err.message || `Failed to ${action} campaign`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this campaign?')) return;
    try {
      setActionLoading(true);
      await del(`/campaigns/${campaignId}`);
      toast.success('Campaign deleted successfully');
      router.push('/dashboard/campaign/campaigns-list');
    } catch (err) {
      toast.error(err.message || 'Failed to delete campaign');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading campaign details...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/dashboard/campaign/campaigns-list')}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to campaigns
        </button>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-700 dark:text-red-300">{error || 'Campaign not found'}</p>
        </div>
      </div>
    );
  }

  const progress = progressData?.progress;
  const totals = progressData?.totals || summaryData?.summary;
  const rates = progressData?.rates || summaryData?.rates;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/campaign/campaigns-list')}
            className="p-2 rounded-lg border border-border hover:bg-accent"
          >
            <FaArrowLeft />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${statusChip}`}>
                {campaign.status}
              </span>
              <span className="text-xs text-muted-foreground">Template: {campaign.template?.name || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'draft' && (
            <button
              onClick={() => handleAction('start')}
              disabled={actionLoading}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <FaPlay /> Start
            </button>
          )}
          {(status === 'queued' || status === 'sending' || status === 'running') && (
            <button
              onClick={() => handleAction('pause')}
              disabled={actionLoading}
              className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <FaPause /> Pause
            </button>
          )}
          {status === 'paused' && (
            <button
              onClick={() => handleAction('resume')}
              disabled={actionLoading}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <FaPlay /> Resume
            </button>
          )}
          <button
            onClick={loadData}
            disabled={actionLoading}
            className="px-3 py-2 rounded-lg border border-border hover:bg-accent text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <FaSync /> Refresh
          </button>
          {['draft', 'completed', 'failed'].includes(status) && (
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <FaTrash /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric title="Recipients" value={progress?.totalRecipients ?? totals?.totalRecipients ?? 0} />
        <Metric title="Sent" value={totals?.sent ?? 0} />
        <Metric title="Delivered" value={totals?.delivered ?? 0} />
        <Metric title="Read" value={totals?.read ?? 0} />
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-3">Progress</h2>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600"
            style={{ width: `${progress?.progressPercent ?? 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
          <span>{progress?.processed ?? 0} processed</span>
          <span>{progress?.progressPercent ?? 0}% complete</span>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Delivery: {rates?.deliveryRate ?? 0}% • Read: {rates?.readRate ?? 0}% • Failure: {rates?.failureRate ?? 0}%
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-3">Recent Messages</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaign messages yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Last Update</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message._id} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground">{message.contact?.name || 'Unknown'}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{message.contact?.phone || '-'}</td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-foreground uppercase">{message.status}</span>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{new Date(message.updatedAt || message.createdAt).toLocaleString()}</td>
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

function Metric({ title, value }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground uppercase">{title}</p>
      <p className="text-xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}
