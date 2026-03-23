'use client';

import { BarChart3, MessageCircle, Clock, UserCheck, TrendingUp, TrendingDown, Download, AlertCircle, RefreshCw } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getAnalyticsDashboardOverview, getAnalyticsDashboardAgents } from '@/lib/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  AreaChart,
  Area
} from 'recharts';

export default function ChatAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [agentData, setAgentData] = useState([]);

  const days = useMemo(() => {
    switch (timeRange) {
      case '24hours': return 1;
      case '7days': return 7;
      case '30days': return 30;
      default: return 7;
    }
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResponse, agentsResponse] = await Promise.all([
        getAnalyticsDashboardOverview({ days }),
        getAnalyticsDashboardAgents({ days })
      ]);

      if (overviewResponse.success) {
        setData(overviewResponse.data);
      } else {
        throw new Error(overviewResponse.error || 'Failed to fetch overview data');
      }

      if (agentsResponse.success) {
        setAgentData(agentsResponse.data.agents || []);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.message || 'An error occurred while fetching analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const stats = useMemo(() => {
    if (!data) return [];
    
    const convTotal = data.conversations?.total || 0;
    const resolved = data.conversations?.resolved || 0;
    const resRate = convTotal > 0 ? ((resolved / convTotal) * 100).toFixed(1) : '0.0';
    const avgResTime = data.responseTime?.avgFirstResponseTime || 0;
    const activeChats = data.conversations?.activeCount || 0;

    return [
      { 
        label: 'Total Conversations', 
        value: convTotal.toLocaleString(), 
        change: '', // Trend data not easily available from current API for a single number
        trending: 'up', 
        icon: MessageCircle, 
        color: 'from-blue-500/10 to-blue-600/10 border-blue-500/20', 
        iconColor: 'text-blue-600 dark:text-blue-400' 
      },
      { 
        label: 'Avg Response Time', 
        value: avgResTime > 60 ? `${(avgResTime / 60).toFixed(1)} min` : `${avgResTime} sec`, 
        change: '', 
        trending: 'down', 
        icon: Clock, 
        color: 'from-violet-500/10 to-violet-600/10 border-violet-500/20', 
        iconColor: 'text-violet-600 dark:text-violet-400' 
      },
      { 
        label: 'Resolution Rate', 
        value: `${resRate}%`, 
        change: '', 
        trending: 'up', 
        icon: UserCheck, 
        color: 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/20', 
        iconColor: 'text-emerald-600 dark:text-emerald-400' 
      },
      { 
        label: 'Active Chats', 
        value: activeChats.toLocaleString(), 
        change: '', 
        trending: 'up', 
        icon: BarChart3, 
        color: 'from-amber-500/10 to-amber-600/10 border-amber-500/20', 
        iconColor: 'text-amber-600 dark:text-amber-400' 
      },
    ];
  }, [data]);

  const chartData = useMemo(() => {
    if (!data || !data.trend) return [];
    return data.trend.map(item => ({
      name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      conversations: item.conversations,
      messages: item.messages
    }));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading analytics data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-destructive/5 rounded-xl border border-destructive/20">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Failed to load analytics</h3>
        <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
        <button onClick={fetchData} className="btn-primary flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chat Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">Track your team&apos;s performance metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)} 
            className="input-premium text-sm py-2"
            disabled={loading}
          >
            <option value="24hours">Last 24 Hours</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
          <button className="btn-primary flex items-center gap-2 text-sm" disabled={loading}>
            <Download className="h-4 w-4" /> Export Report
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((stat, idx) => (
          <div key={idx} className={`bg-gradient-to-br ${stat.color} border rounded-xl p-5 hover:shadow-premium transition-shadow relative overflow-hidden`}>
            {loading && <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] animate-pulse" />}
            <div className="flex items-start justify-between mb-3">
              <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
              {stat.change && (
                <div className={`flex items-center gap-1 text-sm font-semibold ${stat.trending === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                  }`}>
                  {stat.trending === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  <span>{stat.change}</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-sm font-medium mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card border border-border/50 rounded-xl shadow-premium p-6 mb-8 relative">
        {loading && <div className="absolute inset-0 z-10 bg-background/20 backdrop-blur-[1px] flex items-center justify-center">
          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        </div>}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-foreground">Conversation Trends</h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="text-muted-foreground font-medium">Conversations</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-violet-500"></div>
              <span className="text-muted-foreground font-medium">Messages</span>
            </div>
          </div>
        </div>
        <div className="h-80 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.1)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="conversations" 
                  stroke="var(--primary)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorConv)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="messages" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorMsg)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No trend data available for this period</p>
            </div>
          )}
        </div>
      </div>

      {/* Additional Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border/50 rounded-xl shadow-premium p-6 relative">
          {loading && <div className="absolute inset-0 z-10 bg-background/20 backdrop-blur-[1px] flex items-center justify-center rounded-xl" />}
          <h3 className="text-lg font-bold text-foreground mb-4">Top Performing Agents</h3>
          <div className="space-y-4">
            {agentData.length > 0 ? (
              agentData.slice(0, 5).map((agent, idx) => {
                const maxReplies = Math.max(...agentData.map(a => a.totalReplies), 1);
                const percentage = (agent.totalReplies / maxReplies) * 100;
                
                return (
                  <div key={agent.agentId || idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">{agent.name}</span>
                      <span className="text-muted-foreground">{agent.totalReplies} chats</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-48 flex items-center justify-center border-2 border-dashed border-border rounded-xl">
                <p className="text-muted-foreground text-sm text-center">No agent activity data found for this period</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-card border border-border/50 rounded-xl shadow-premium p-6 relative overflow-hidden">
          {loading && <div className="absolute inset-0 z-10 bg-background/20 backdrop-blur-[1px] flex items-center justify-center rounded-xl" />}
          <h3 className="text-lg font-bold text-foreground mb-4">Message Distribution</h3>
          <div className="h-64">
            {data?.messages?.byType && Object.values(data.messages.byType).some(v => v > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(data.messages.byType)
                  .filter(([_, value]) => value > 0)
                  .map(([key, value]) => ({ name: key.charAt(0).toUpperCase() + key.slice(1), value }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 6)
                }>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.1)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(var(--primary), 0.05)' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-xl">
                <p className="text-muted-foreground text-sm">No message data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
