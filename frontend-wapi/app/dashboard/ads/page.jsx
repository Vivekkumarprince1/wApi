'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaPause, FaPlay, FaTrash, FaEye } from 'react-icons/fa';
import { checkAdsEligibility, listAds, pauseAd, resumeAd, deleteAd } from '@/lib/api';
import FlashLoader from '@/components/ui/FlashLoader';

export default function AdsPage() {
  const router = useRouter();
  const [eligibility, setEligibility] = useState(null);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Check eligibility
      const eligData = await checkAdsEligibility();
      setEligibility(eligData);

      // If enabled, load ads
      if (eligData.enabled) {
        const adsData = await listAds(selectedStatus);
        setAds(adsData.ads || []);
      }
    } catch (err) {
      console.error('Error loading ads:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAd = () => {
    if (!eligibility?.enabled) {
      setError('Your plan does not support WhatsApp Ads. Upgrade to continue.');
      return;
    }
    router.push('/dashboard/ads/create');
  };

  const handlePauseAd = async (adId, name) => {
    try {
      await pauseAd(adId);
      setSuccess(`Paused ad: ${name}`);
      loadData();
    } catch (err) {
      setError(`Error pausing ad: ${err.message}`);
    }
  };

  const handleResumeAd = async (adId, name) => {
    try {
      await resumeAd(adId);
      setSuccess(`Resumed ad: ${name}`);
      loadData();
    } catch (err) {
      setError(`Cannot resume: ${err.message}`);
    }
  };

  const handleDeleteAd = async (adId, name) => {
    if (!confirm(`Delete ad "${name}"? This cannot be undone.`)) return;
    
    try {
      await deleteAd(adId);
      setSuccess(`Deleted ad: ${name}`);
      loadData();
    } catch (err) {
      setError(`Error deleting ad: ${err.message}`);
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      draft: 'bg-muted text-muted-foreground border-border',
      pending_review: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/30',
      active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/30',
      paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/30',
      rejected: 'bg-destructive/10 text-destructive border-destructive/20',
      completed: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200/30'
    };
    return `border ${colors[status] || 'bg-muted text-muted-foreground'}`;
  };

  if (loading) return <FlashLoader />;

  if (!eligibility) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl">
          <p>Failed to load ads eligibility. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">WhatsApp Ads</h1>
            <p className="text-muted-foreground mt-1">Click-to-Chat campaigns</p>
          </div>
          <button
            onClick={handleCreateAd}
            disabled={!eligibility.enabled}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 ${
              eligibility.enabled
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-lg'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            <FaPlus className="h-4 w-4" /> Create Ad
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive px-5 py-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <p className="font-medium">{error}</p>
            <button
              className="text-sm font-bold underline hover:no-underline px-2 py-1"
              onClick={() => setError('')}
            >
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-5 py-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <p className="font-medium">{success}</p>
            <button
              className="text-sm font-bold underline hover:no-underline px-2 py-1"
              onClick={() => setSuccess('')}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Eligibility Checks */}
        {!eligibility.enabled && (
          <div className="mb-8 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 sm:p-8">
            <h3 className="font-bold text-amber-600 dark:text-amber-400 text-lg mb-4 flex items-center gap-2">
              <span className="p-1.5 bg-amber-500/10 rounded-lg">⚠️</span>
              Why WhatsApp Ads is not available:
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eligibility.errors.map((error) => {
                const check = eligibility.checks[error.replace('_LIMIT', '').toLowerCase()];
                return (
                  <li key={error} className="bg-card/50 border border-border p-4 rounded-xl">
                    <span className="font-bold text-foreground block mb-1">❌ {error.replace(/_/g, ' ')}</span>
                    {check?.reason && <p className="text-sm text-muted-foreground">{check.reason}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Ads List */}
        {eligibility.enabled && ads.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border shadow-premium">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FaPlus className="text-muted-foreground h-6 w-6" />
            </div>
            <p className="text-muted-foreground mb-6 font-medium">No ads created yet. Start growing your audience.</p>
            <button
              onClick={handleCreateAd}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold shadow-lg transition-all"
            >
              <FaPlus /> Create Your First Ad
            </button>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Budget</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Spent</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Impressions</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr key={ad._id} className="border-b border-border hover:bg-muted">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">{ad.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(ad.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(ad.status)}`}>
                        {ad.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {ad.pausedReason && (
                        <p className="text-xs text-muted-foreground mt-1">{ad.pausedReason}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      ${(ad.budget / 100).toFixed(2)}/day
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      ${(ad.spentAmount / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {ad.impressions.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {ad.status === 'paused' ? (
                          <button
                            onClick={() => handleResumeAd(ad._id, ad.name)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded transition"
                            title="Resume"
                          >
                            <FaPlay size={16} />
                          </button>
                        ) : ad.status === 'active' ? (
                          <button
                            onClick={() => handlePauseAd(ad._id, ad.name)}
                            className="p-2 text-yellow-600 hover:bg-yellow-100 rounded transition"
                            title="Pause"
                          >
                            <FaPause size={16} />
                          </button>
                        ) : null}
                        
                        <button
                          onClick={() => router.push(`/dashboard/ads/${ad._id}`)}
                          className="p-2 text-muted-foreground hover:bg-accent rounded transition"
                          title="View"
                        >
                          <FaEye size={16} />
                        </button>
                        
                        {ad.status === 'draft' && (
                          <button
                            onClick={() => handleDeleteAd(ad._id, ad.name)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded transition"
                            title="Delete"
                          >
                            <FaTrash size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

        {/* Plan Limits Info */}
        {eligibility.enabled && eligibility.limits && (
          <div className="mt-8 bg-blue-500/5 border border-blue-200/20 rounded-2xl p-6 sm:p-8">
            <h3 className="font-bold text-blue-600 dark:text-blue-400 text-lg mb-4">Your Plan Limits</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-card/50 border border-border p-4 rounded-xl">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Max Active Ads</p>
                <p className="text-2xl font-extrabold text-foreground">
                  {eligibility.limits.maxActiveAds === -1 ? 'Unlimited' : eligibility.limits.maxActiveAds}
                </p>
              </div>
              <div className="bg-card/50 border border-border p-4 rounded-xl">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Monthly Budget Limit</p>
                <p className="text-2xl font-extrabold text-foreground">
                  {eligibility.limits.maxMonthlySpend === -1 
                    ? 'Unlimited' 
                    : `$${(eligibility.limits.maxMonthlySpend / 100).toFixed(0)}`}
                </p>
              </div>
              <div className="bg-card/50 border border-border p-4 rounded-xl">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Concurrent Campaigns</p>
                <p className="text-2xl font-extrabold text-foreground">
                  {eligibility.limits.maxConcurrentCampaigns === -1 ? 'Unlimited' : eligibility.limits.maxConcurrentCampaigns}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
