'use client';

import { useEffect, useState } from 'react';

interface UsageData {
  plan: string;
  limits: Record<string, number>;
  usage: Record<string, number>;
  percentages: Record<string, number>;
  warnings: Record<string, boolean>;
}

export function useQuota() {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Use centralized API URL resolution
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:5001/api/v1';
      const baseUrl = apiUrl.endsWith('/api/v1') ? apiUrl : `${apiUrl}/api/v1`;
      
      const res = await fetch(`${baseUrl}/usage`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const data = await res.json();
      setUsageData(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch usage:', err);
      setError(err.response?.data?.message || 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, []);

  const canPerformAction = (resourceType: string): { allowed: boolean; reason?: string } => {
    if (!usageData) return { allowed: true };

    const limitKey = resourceType === 'messages' ? 'messagesDaily' : resourceType;
    const usageKey = resourceType === 'messages' ? 'messagesDaily' : resourceType;

    const limit = usageData.limits[limitKey];
    const current = usageData.usage[usageKey] || 0;

    // Unlimited
    if (limit === -1) {
      return { allowed: true };
    }

    // Check if at limit
    if (current >= limit) {
      return {
        allowed: false,
        reason: `You've reached your ${resourceType} limit (${limit}). Please upgrade your plan.`
      };
    }

    return { allowed: true };
  };

  const getRemainingQuota = (resourceType: string): number => {
    if (!usageData) return 0;

    const limitKey = resourceType === 'messages' ? 'messagesDaily' : resourceType;
    const usageKey = resourceType === 'messages' ? 'messagesDaily' : resourceType;

    const limit = usageData.limits[limitKey];
    const current = usageData.usage[usageKey] || 0;

    if (limit === -1) return Infinity;
    return Math.max(0, limit - current);
  };

  const isApproachingLimit = (resourceType: string, threshold = 80): boolean => {
    if (!usageData) return false;

    const limitKey = resourceType === 'messages' ? 'messagesDaily' : resourceType;
    const percentage = usageData.percentages[limitKey] || 0;

    return percentage >= threshold;
  };

  return {
    usageData,
    loading,
    error,
    refetch: fetchUsage,
    canPerformAction,
    getRemainingQuota,
    isApproachingLimit
  };
}
