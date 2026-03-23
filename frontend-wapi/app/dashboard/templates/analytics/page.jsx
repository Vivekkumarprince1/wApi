'use client';

import React, { useState, useEffect } from 'react';
import { BarChart4, TrendingUp, Send, MessageSquare, Download } from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  getWorkspaceAnalytics,
  getTopPerformingTemplates,
  getLowPerformingTemplates,
  exportAnalyticsReport
} from '@/lib/api';
import TemplateAnalyticsChart from '@/components/templates/TemplateAnalyticsChart';
import QualityScoreBadge from '@/components/templates/QualityScoreBadge';

export default function TemplateAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [topPerformers, setTopPerformers] = useState([]);
  const [lowPerformers, setLowPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // 30 days

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const days = parseInt(dateRange);
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const [analyticsData, topData, lowData] = await Promise.all([
        getWorkspaceAnalytics({ startDate, endDate }),
        getTopPerformingTemplates(10),
        getLowPerformingTemplates(10)
      ]);

      setAnalytics(analyticsData.analytics || {});
      setTopPerformers(topData.templates || []);
      setLowPerformers(lowData.templates || []);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await exportAnalyticsReport(format);
      toast.success(`Analytics exported as ${format.toUpperCase()}`);
      // Download logic here
    } catch (error) {
      toast.error('Failed to export analytics');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  // Prepare chart data
  const messagesTrendData = analytics?.messagesTrend || [];
  const qualityDistributionData = [
    { name: 'Green', value: analytics?.summary?.qualityGreen || 0 },
    { name: 'Yellow', value: analytics?.summary?.qualityYellow || 0 },
    { name: 'Red', value: analytics?.summary?.qualityRed || 0 }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart4 size={24} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Template Analytics</h1>
              <p className="text-gray-600">Workspace-wide performance metrics</p>
            </div>
          </div>
          <button
            onClick={() => handleExport('json')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download size={18} />
            Export Report
          </button>
        </div>

        {/* Date Range */}
        <div className="flex gap-2">
          {['7', '30', '90'].map(days => (
            <button
              key={days}
              onClick={() => setDateRange(days)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                dateRange === days
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Last {days} days
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {analytics?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <SummaryCard
            title="Total Templates"
            value={analytics.summary.totalTemplates}
            icon={<MessageSquare size={20} />}
            color="blue"
          />
          <SummaryCard
            title="Messages Sent"
            value={analytics.summary.totalMessages?.toLocaleString()}
            icon={<Send size={20} />}
            color="green"
          />
          <SummaryCard
            title="Delivery Rate"
            value={`${analytics.summary.deliveryRate?.toFixed(1)}%`}
            icon={<TrendingUp size={20} />}
            color="purple"
          />
          <SummaryCard
            title="Approved"
            value={analytics.summary.approvedTemplates}
            color="green"
          />
          <SummaryCard
            title="Rejected"
            value={analytics.summary.rejectedTemplates}
            color="red"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {messagesTrendData.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <TemplateAnalyticsChart
              data={messagesTrendData}
              type="line"
              title="Messages Trend"
              dataKey="count"
              xAxisKey="date"
            />
          </div>
        )}

        {qualityDistributionData.some(d => d.value > 0) && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <TemplateAnalyticsChart
              data={qualityDistributionData}
              type="pie"
              title="Quality Score Distribution"
              dataKey="value"
            />
          </div>
        )}
      </div>

      {/* Top vs Low Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Performers */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            🚀 Top Performing Templates
          </h2>
          {topPerformers.length > 0 ? (
            <div className="space-y-3">
              {topPerformers.map((template, idx) => (
                <div key={template._id?.toString() || template.id?.toString() || `top-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{idx + 1}. {template.name}</p>
                    <p className="text-sm text-gray-600">
                      {template.stats?.sentCount || 0} sent • {template.stats?.deliveryRate?.toFixed(1)}% delivery
                    </p>
                  </div>
                  {template.qualityScore?.score && (
                    <QualityScoreBadge score={template.qualityScore.score} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No data available</p>
          )}
        </div>

        {/* Low Performers */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            ⚠️ Low Performing Templates
          </h2>
          {lowPerformers.length > 0 ? (
            <div className="space-y-3">
              {lowPerformers.map((template, idx) => (
                <div key={template._id?.toString() || template.id?.toString() || `low-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{idx + 1}. {template.name}</p>
                    <p className="text-sm text-gray-600">
                      {template.stats?.sentCount || 0} sent • {template.stats?.failureRate?.toFixed(1)}% failure rate
                    </p>
                  </div>
                  {template.qualityScore?.score && (
                    <QualityScoreBadge score={template.qualityScore.score} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No data available</p>
          )}
        </div>
      </div>

      {/* Quality Breakdown */}
      {analytics?.qualityBreakdown && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quality Breakdown</h2>
          <div className="grid grid-cols-3 gap-4">
            <QualityBreakdownCard
              label="Excellent"
              value={analytics.qualityBreakdown.GREEN || 0}
              color="green"
            />
            <QualityBreakdownCard
              label="Good"
              value={analytics.qualityBreakdown.YELLOW || 0}
              color="yellow"
            />
            <QualityBreakdownCard
              label="Needs Review"
              value={analytics.qualityBreakdown.RED || 0}
              color="red"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]} mb-3`}>
        {icon}
      </div>
      <p className="text-gray-600 text-sm">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function QualityBreakdownCard({ label, value, color }) {
  const bgColors = {
    green: 'bg-green-100',
    yellow: 'bg-yellow-100',
    red: 'bg-red-100'
  };

  return (
    <div className={`p-4 rounded-lg ${bgColors[color]}`}>
      <p className="text-gray-600 text-sm">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  );
}
