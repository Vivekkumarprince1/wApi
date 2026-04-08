'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus } from 'react-icons/fa';
import { checkAdsEligibility, listAds, pauseAd, resumeAd, deleteAd } from '@/lib/api';
import FlashLoader from '@/components/ui/FlashLoader';
import AdsHeader from '@/components/dashboard/ads/AdsHeader';
import EligibilityBanner from '@/components/dashboard/ads/EligibilityBanner';
import AdsTable from '@/components/dashboard/ads/AdsTable';
import PlanLimitsInfo from '@/components/dashboard/ads/PlanLimitsInfo';

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
      <AdsHeader 
        onCreateAd={handleCreateAd} 
        eligibilityEnabled={eligibility.enabled} 
      />

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

        <EligibilityBanner eligibility={eligibility} />

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
          <AdsTable 
            ads={ads}
            onPauseAd={handlePauseAd}
            onResumeAd={handleResumeAd}
            onViewAd={(id) => router.push(`/dashboard/ads/${id}`)}
            onDeleteAd={handleDeleteAd}
            getStatusBadgeColor={getStatusBadgeColor}
          />
        )}

        <PlanLimitsInfo eligibility={eligibility} />
      </div>
    </div>
  );
}
