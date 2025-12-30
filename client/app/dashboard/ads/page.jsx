'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaPause, FaPlay, FaTrash, FaEye } from 'react-icons/fa';
import { checkAdsEligibility, listAds, pauseAd, resumeAd, deleteAd } from '../../../lib/api';

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
      draft: 'bg-gray-100 text-gray-800',
      pending_review: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading ads...</p>
        </div>
      </div>
    );
  }

  if (!eligibility) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Failed to load ads eligibility. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Ads</h1>
            <p className="text-gray-600 mt-1">Click-to-Chat campaigns</p>
          </div>
          <button
            onClick={handleCreateAd}
            disabled={!eligibility.enabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              eligibility.enabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <FaPlus /> Create Ad
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
            <button
              className="ml-4 underline"
              onClick={() => setError('')}
            >
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {success}
            <button
              className="ml-4 underline"
              onClick={() => setSuccess('')}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Eligibility Checks */}
        {!eligibility.enabled && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="font-semibold text-yellow-900 mb-3">
              Why WhatsApp Ads is not available:
            </h3>
            <ul className="space-y-2">
              {eligibility.errors.map((error) => {
                const check = eligibility.checks[error.replace('_LIMIT', '').toLowerCase()];
                return (
                  <li key={error} className="text-yellow-800">
                    <span className="font-medium">❌ {error}</span>
                    {check?.reason && <p className="text-sm ml-4">{check.reason}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Ads List */}
        {eligibility.enabled && ads.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600 mb-4">No ads created yet.</p>
            <button
              onClick={handleCreateAd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              <FaPlus /> Create Your First Ad
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Budget</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Spent</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Impressions</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr key={ad._id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{ad.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(ad.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(ad.status)}`}>
                        {ad.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {ad.pausedReason && (
                        <p className="text-xs text-gray-600 mt-1">{ad.pausedReason}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      ${(ad.budget / 100).toFixed(2)}/day
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      ${(ad.spentAmount / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
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
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded transition"
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
        )}

        {/* Plan Limits Info */}
        {eligibility.enabled && eligibility.limits && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-2">Your Plan Limits</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-blue-700">Max Active Ads</p>
                <p className="text-lg font-bold text-blue-900">
                  {eligibility.limits.maxActiveAds === -1 ? 'Unlimited' : eligibility.limits.maxActiveAds}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Monthly Budget Limit</p>
                <p className="text-lg font-bold text-blue-900">
                  {eligibility.limits.maxMonthlySpend === -1 
                    ? 'Unlimited' 
                    : `$${(eligibility.limits.maxMonthlySpend / 100).toFixed(0)}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Concurrent Campaigns</p>
                <p className="text-lg font-bold text-blue-900">
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
