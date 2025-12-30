'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UsageData {
  plan: string;
  limits: {
    messagesDaily: number;
    messagesMonthly: number;
    templates: number;
    campaigns: number;
    contacts: number;
    automations: number;
  };
  usage: {
    messages: number;
    messagesDaily: number;
    messagesThisMonth: number;
    templates: number;
    campaigns: number;
    contacts: number;
    automations: number;
  };
  percentages: {
    messagesDaily: number;
    messagesMonthly: number;
    templates: number;
    campaigns: number;
    contacts: number;
    automations: number;
  };
  warnings: {
    messagesDaily: boolean;
    messagesMonthly: boolean;
    templates: boolean;
    campaigns: boolean;
    contacts: boolean;
    automations: boolean;
  };
}

export default function UsageDashboard() {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsageData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsageData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsageData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/usage`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const data = await res.json();
      setUsageData(data);
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch usage data:', err);
      setError(err.response?.data?.message || 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  const formatLimit = (limit: number) => {
    if (limit === -1) return 'Unlimited';
    if (limit >= 1000000) return `${(limit / 1000000).toFixed(1)}M`;
    if (limit >= 1000) return `${(limit / 1000).toFixed(0)}K`;
    return limit.toString();
  };

  const getProgressColor = (percentage: number, warning: boolean) => {
    if (percentage >= 100) return 'bg-red-500';
    if (warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-red-50 border-red-200">
        <p className="text-red-800">{error}</p>
        <Button onClick={fetchUsageData} className="mt-4">
          Retry
        </Button>
      </Card>
    );
  }

  if (!usageData) return null;

  const resources = [
    { 
      key: 'messagesDaily', 
      label: 'Daily Messages', 
      current: usageData.usage.messagesDaily,
      limit: usageData.limits.messagesDaily 
    },
    { 
      key: 'messagesMonthly', 
      label: 'Monthly Messages', 
      current: usageData.usage.messagesThisMonth,
      limit: usageData.limits.messagesMonthly 
    },
    { 
      key: 'templates', 
      label: 'Templates', 
      current: usageData.usage.templates,
      limit: usageData.limits.templates 
    },
    { 
      key: 'campaigns', 
      label: 'Campaigns', 
      current: usageData.usage.campaigns,
      limit: usageData.limits.campaigns 
    },
    { 
      key: 'contacts', 
      label: 'Contacts', 
      current: usageData.usage.contacts,
      limit: usageData.limits.contacts 
    },
    { 
      key: 'automations', 
      label: 'Automations', 
      current: usageData.usage.automations,
      limit: usageData.limits.automations 
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usage & Limits</h2>
          <p className="text-sm text-gray-500 mt-1">
            Current Plan: <span className="font-semibold capitalize">{usageData.plan}</span>
          </p>
        </div>
        <Button onClick={fetchUsageData} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Usage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.map((resource) => {
          const percentage = usageData.percentages[resource.key as keyof typeof usageData.percentages];
          const warning = usageData.warnings[resource.key as keyof typeof usageData.warnings];
          const isUnlimited = resource.limit === -1;
          
          return (
            <Card key={resource.key} className="p-6">
              <div className="space-y-4">
                {/* Title & Warning */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{resource.label}</h3>
                  {warning && (
                    <span className="text-xs font-medium px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                      ⚠️ High
                    </span>
                  )}
                  {percentage >= 100 && (
                    <span className="text-xs font-medium px-2 py-1 bg-red-100 text-red-800 rounded">
                      ⛔ Limit Reached
                    </span>
                  )}
                </div>

                {/* Usage Numbers */}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatLimit(resource.current)}
                  </span>
                  <span className="text-sm text-gray-500">
                    / {formatLimit(resource.limit)}
                  </span>
                </div>

                {/* Progress Bar */}
                {!isUnlimited && (
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getProgressColor(percentage, warning)}`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 text-right">
                      {percentage}% used
                    </p>
                  </div>
                )}

                {isUnlimited && (
                  <p className="text-sm text-green-600 font-medium">✓ Unlimited</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Upgrade CTA if any limit is close */}
      {Object.values(usageData.warnings).some(w => w) && usageData.plan !== 'enterprise' && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Approaching Your Plan Limits
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Upgrade to a higher plan to increase your limits and unlock more features.
              </p>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Upgrade Plan
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
