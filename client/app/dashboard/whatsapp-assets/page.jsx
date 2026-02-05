'use client';

import { useEffect, useState } from 'react';
import { FaWhatsapp, FaSignal, FaShieldAlt, FaBolt, FaExclamationTriangle } from 'react-icons/fa';
import { getWhatsAppAssetStatus } from '@/lib/api';
import { useWorkspace } from '@/lib/useWorkspace';

export default function WhatsAppAssetsPage() {
  const workspace = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await getWhatsAppAssetStatus();
        setStatus(response?.stage1 || null);
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to load WhatsApp asset status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const details = status?.details || {};
  const degradation = status?.degradation || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <FaWhatsapp className="text-white text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WhatsApp Asset Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Parent WABA managed assets and compliance status.</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="animate-pulse text-gray-500">Loading status...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FaSignal /> Phone Status
              </div>
              <div className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">
                {details.phoneStatus || 'unknown'}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {details.phoneNumber || 'Phone number pending'}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FaShieldAlt /> Quality Rating
              </div>
              <div className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">
                {details.qualityRating || 'UNKNOWN'}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {details.verifiedName || 'Display name pending'}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FaBolt /> Messaging Tier
              </div>
              <div className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">
                {details.messagingTier || 'TIER_NOT_SET'}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Tier is enforced by Meta based on quality.
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <FaExclamationTriangle /> Safety & Compliance
          </div>
          <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            {workspace.degradation?.degraded
              ? (workspace.degradation.message || 'Messaging is restricted due to account health.')
              : 'Account health is stable. Messaging allowed within policy limits.'}
          </div>
          {!workspace.canSendMessages && (
            <div className="mt-3 text-xs text-amber-600">
              Outbound actions are blocked until the phone status is active and quality is healthy.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
