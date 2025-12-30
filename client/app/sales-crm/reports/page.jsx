'use client';

import { useState, useEffect } from 'react';
import { Calendar, Download, X } from 'lucide-react';
import {
  getPipelinePerformanceReport,
  getFunnelReport,
  getAgentPerformanceReport,
  getDealVelocityReport,
  getStageDurationReport,
  getPipelines,
  listDeals,
} from '@/lib/api';

export default function SalesCRMReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [agents, setAgents] = useState([]);

  // Filter states - Left Panel (Agent Performance)
  const [agentFilter, setAgentFilter] = useState('');
  const [agentDateRange, setAgentDateRange] = useState('last7days');
  const [agentMetric, setAgentMetric] = useState('');

  // Filter states - Right Panel (Sales Funnel)
  const [funnelAgent, setFunnelAgent] = useState('all');
  const [funnelPipeline, setFunnelPipeline] = useState('');
  const [funnelDateRange, setFunnelDateRange] = useState('last7days');

  // Report data
  const [agentPerf, setAgentPerf] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [pipelinePerf, setPipelinePerf] = useState(null);

  // Load pipelines and agents on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [pipelinesRes, dealsRes] = await Promise.all([
        getPipelines(),
        listDeals({ limit: 1000 }),
      ]);

      setPipelines(pipelinesRes || []);
      if (pipelinesRes?.length > 0) {
        setFunnelPipeline(pipelinesRes[0]._id);
      }

      // Extract deals array - handle both direct array and wrapped response
      const dealsArray = Array.isArray(dealsRes) ? dealsRes : (dealsRes?.data || []);
      const uniqueAgents = [...new Set(dealsArray?.map((d) => d.agent).filter(Boolean))];
      setAgents(uniqueAgents || []);

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load reports when filters change
  useEffect(() => {
    loadReports();
  }, [agentFilter, agentDateRange, funnelAgent, funnelPipeline, funnelDateRange]);

  const getDateRange = (rangeType) => {
    const endDate = new Date();
    const startDate = new Date();

    switch (rangeType) {
      case 'last7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  const loadReports = async () => {
    // Skip loading if funnelPipeline is not set yet
    if (!funnelPipeline) return;

    try {
      setLoading(true);
      
      const agentDates = getDateRange(agentDateRange);
      const funnelDates = getDateRange(funnelDateRange);

      const [agentRes, funnelRes, perfRes] = await Promise.all([
        getAgentPerformanceReport({
          startDate: agentDates.startDate,
          endDate: agentDates.endDate,
          ...(agentFilter && { agent: agentFilter }),
        }),
        getFunnelReport(funnelPipeline, {
          startDate: funnelDates.startDate,
          endDate: funnelDates.endDate,
          ...(funnelAgent !== 'all' && { agent: funnelAgent }),
        }),
        getPipelinePerformanceReport({
          startDate: agentDates.startDate,
          endDate: agentDates.endDate,
        }),
      ]);

      setAgentPerf(agentRes);
      setFunnel(funnelRes);
      setPipelinePerf(perfRes);
      setError(null);
    } catch (err) {
      console.error('Error loading reports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = (panel) => {
    if (panel === 'agent') {
      setAgentFilter('');
      setAgentDateRange('last7days');
      setAgentMetric('');
    } else {
      setFunnelAgent('all');
      setFunnelDateRange('last7days');
    }
  };

  const downloadReport = (type, panel) => {
    // Placeholder for download functionality
    alert(`Downloading ${type} for ${panel} panel`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">✓</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales CRM Reports</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Track your Sales Agent Performance and Sales Funnel in one place</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600 dark:text-gray-400">Loading reports...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">Error: {error}</p>
        </div>
      )}

      {/* Main Content - Two Panel Layout */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT PANEL - Agent Performance Report */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Panel Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Performance Report</h2>

              {/* Filters */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <select
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">All Agents</option>
                    {agents.map((agent) => (
                      <option key={agent} value={agent}>
                        {agent}
                      </option>
                    ))}
                  </select>

                  <select
                    value={agentDateRange}
                    onChange={(e) => setAgentDateRange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="last7days">Last 7 days</option>
                    <option value="last30days">Last 30 days</option>
                    <option value="last90days">Last 90 days</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <select
                    value={agentMetric}
                    onChange={(e) => setAgentMetric(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">Select Option</option>
                    <option value="deals">Total Deals</option>
                    <option value="won">Won Deals</option>
                    <option value="winrate">Win Rate</option>
                  </select>

                  <button
                    onClick={() => clearFilters('agent')}
                    className="px-4 py-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:text-blue-700"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="p-6 h-64 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center">
              {agentPerf?.agents?.length > 0 ? (
                <div className="w-full h-full flex flex-col space-y-4">
                  {agentPerf.agents.slice(0, 5).map((agent, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-24 truncate">
                        {agent.agentName}
                      </span>
                      <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 dark:bg-blue-600 flex items-center justify-end pr-2"
                          style={{ width: `${Math.min((agent.totalDeals / 20) * 100, 100)}%` }}
                        >
                          <span className="text-xs text-white font-medium">{agent.totalDeals}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <p className="text-sm">No data available</p>
                </div>
              )}
            </div>

            {/* Tabular Summary */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Tabular Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Agent</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Deals</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentPerf?.agents?.length > 0 ? (
                      agentPerf.agents.map((agent, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{agent.agentName}</td>
                          <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{agent.totalDeals}</td>
                          <td className="py-2 px-2 text-right">
                            <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              {Math.round(agent.winRate)}%
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="py-4 text-center text-gray-400 text-sm">
                          No result found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Download Buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => downloadReport('Summary', 'Agent')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Download Summary
                </button>
                <button
                  onClick={() => downloadReport('Detailed', 'Agent')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Download Detailed
                </button>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-600 dark:text-gray-400">
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">‹</button>
                <span>{agentPerf?.agents?.length || 0} / {agentPerf?.agents?.length || 0}</span>
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">›</button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - Sales Funnel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Panel Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sales Funnel</h2>

              {/* Filters */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <select
                    value={funnelAgent}
                    onChange={(e) => setFunnelAgent(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="all">All Agents</option>
                    {agents.map((agent) => (
                      <option key={agent} value={agent}>
                        {agent}
                      </option>
                    ))}
                  </select>

                  <select
                    value={funnelPipeline}
                    onChange={(e) => setFunnelPipeline(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">Select Pipeline</option>
                    {Array.isArray(pipelines) && pipelines.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <select
                    value={funnelDateRange}
                    onChange={(e) => setFunnelDateRange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="last7days">Last 7 days</option>
                    <option value="last30days">Last 30 days</option>
                    <option value="last90days">Last 90 days</option>
                  </select>

                  <button
                    onClick={() => clearFilters('funnel')}
                    className="px-4 py-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:text-blue-700"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="p-6 h-64 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center">
              {funnel?.stages?.length > 0 ? (
                <div className="w-full space-y-4">
                  {funnel.stages.map((stage, idx) => {
                    const maxWidth = Math.max(...funnel.stages.map(s => s.dealCount || 1));
                    const width = (stage.dealCount / maxWidth) * 100;
                    return (
                      <div key={idx} className="flex flex-col">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{stage.stageName}</span>
                          <span className="text-gray-600 dark:text-gray-400">{stage.dealCount} deals</span>
                        </div>
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 flex items-center justify-center text-white text-xs font-medium"
                            style={{ width: `${width}%` }}
                          >
                            {width > 20 && `${stage.dealCount}`}
                          </div>
                        </div>
                        {idx < funnel.stages.length - 1 && (
                          <div className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                            ↓ {stage.dropoff}% drop-off
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <p className="text-sm">No data available</p>
                </div>
              )}
            </div>

            {/* Tabular Summary */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Tabular Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Stage</th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnel?.stages?.length > 0 ? (
                      funnel.stages.map((stage, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{stage.stageName}</td>
                          <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{stage.dealCount}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className="py-4 text-center text-gray-400 text-sm">
                          No result found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Download Buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => downloadReport('Summary', 'Funnel')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Download Summary
                </button>
                <button
                  onClick={() => downloadReport('Detailed', 'Funnel')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Download Detailed
                </button>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-600 dark:text-gray-400">
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">‹</button>
                <span>{funnel?.stages?.length || 0} / {funnel?.stages?.length || 0}</span>
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">›</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
