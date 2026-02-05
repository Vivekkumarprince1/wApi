'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/api';

interface QuotaWarningProps {
  resourceType: 'messages' | 'templates' | 'campaigns' | 'contacts' | 'automations';
  onLimitExceeded?: () => void;
}

export default function QuotaWarning({ resourceType, onLimitExceeded }: QuotaWarningProps) {
  const [warning, setWarning] = useState<string | null>(null);
  const [limitExceeded, setLimitExceeded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkQuota();
  }, [resourceType]);

  const checkQuota = async () => {
    try {
      const data = await get('/usage');
      const { usage, limits, percentages, warnings } = data;

      // For messages, check daily limit
      const limitKey = resourceType === 'messages' ? 'messagesDaily' : resourceType;
      const usageKey = resourceType === 'messages' ? 'messagesDaily' : resourceType;
      
      const currentUsage = usage[usageKey] || 0;
      const limit = limits[limitKey];
      const percentage = percentages[limitKey] || 0;
      const hasWarning = warnings[limitKey];

      // Check if limit is exceeded
      if (limit !== -1 && currentUsage >= limit) {
        setLimitExceeded(true);
        setWarning(`You've reached your ${getResourceLabel(resourceType)} limit (${limit}). Upgrade your plan to continue.`);
        onLimitExceeded?.();
      }
      // Check if approaching limit (80%+)
      else if (hasWarning && limit !== -1) {
        setWarning(`You're using ${percentage}% of your ${getResourceLabel(resourceType)} limit. ${limit - currentUsage} remaining.`);
        setLimitExceeded(false);
      }
      // All good
      else {
        setWarning(null);
        setLimitExceeded(false);
      }
    } catch (err) {
      console.error('Failed to check quota:', err);
    } finally {
      setLoading(false);
    }
  };

  const getResourceLabel = (type: string) => {
    const labels: Record<string, string> = {
      messages: 'daily message',
      templates: 'template',
      campaigns: 'campaign',
      contacts: 'contact',
      automations: 'automation'
    };
    return labels[type] || type;
  };

  if (loading || !warning) return null;

  return (
    <div
      className={`mb-4 p-4 rounded-lg border ${
        limitExceeded
          ? 'bg-red-50 border-red-300 text-red-800'
          : 'bg-yellow-50 border-yellow-300 text-yellow-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{limitExceeded ? '⛔' : '⚠️'}</span>
        <div className="flex-1">
          <p className="font-medium">{warning}</p>
          {limitExceeded && (
            <button
              onClick={() => window.location.href = '/dashboard/settings?tab=billing'}
              className="mt-2 text-sm underline font-semibold hover:no-underline"
            >
              Upgrade Now →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
