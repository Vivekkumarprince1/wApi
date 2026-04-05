"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, 
  Download, 
  ChevronDown, 
  TrendingUp, 
  DollarSign, 
  Trophy, 
  Users, 
  Filter, 
  BarChart2, 
  PieChart as PieIcon, 
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { 
  getPipelinePerformanceReport, 
  getFunnelReport, 
  getAgentPerformanceReport, 
  getPipelines,
  getDefaultPipeline
} from "@/lib/api/sales";
import { toast } from "react-hot-toast";

export default function SalesCRMReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pipelines, setPipelines] = useState([]);
  const [activePipeline, setActivePipeline] = useState(null);
  const [dateRange, setDateRange] = useState("last30days");

  // Report Data
  const [summaryStats, setSummaryStats] = useState({
    totalRevenue: 0,
    dealsWon: 0,
    activeLeads: 0,
    conversionRate: 0
  });
  const [agentPerf, setAgentPerf] = useState([]);
  const [funnelData, setFunnelData] = useState([]);
  const [pipelinePerf, setPipelinePerf] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activePipeline) {
      loadReports();
    }
  }, [activePipeline, dateRange]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const pipelinesData = await getPipelines();
      const pipelinesList = pipelinesData?.pipelines || [];
      setPipelines(pipelinesList);
      
      if (pipelinesList.length > 0) {
        const defaultPipeline = pipelinesList.find(p => p.isDefault) || pipelinesList[0];
        setActivePipeline(defaultPipeline);
      } else {
        const defaultP = await getDefaultPipeline();
        if (defaultP) {
          setPipelines([defaultP]);
          setActivePipeline(defaultP);
        }
      }
    } catch (err) {
      console.error("Initial load failed:", err);
      setError("Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  };

  const getDateParams = (range) => {
    const end = new Date();
    const start = new Date();
    if (range === "last7days") start.setDate(end.getDate() - 7);
    else if (range === "last30days") start.setDate(end.getDate() - 30);
    else if (range === "last90days") start.setDate(end.getDate() - 90);
    
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  };

  const loadReports = async () => {
    try {
      const dates = getDateParams(dateRange);
      const params = { ...dates, pipelineId: activePipeline._id };

      const [perfRes, funnelRes, agentRes] = await Promise.all([
        getPipelinePerformanceReport(params),
        getFunnelReport(activePipeline._id, dates),
        getAgentPerformanceReport(dates)
      ]);

      // Process Summary Stats
      const currentPipelinePerf = perfRes.data?.find(p => p.pipelineId === activePipeline._id) || perfRes.data?.[0];
      if (currentPipelinePerf) {
        setSummaryStats({
          totalRevenue: currentPipelinePerf.totalValue || 0,
          dealsWon: currentPipelinePerf.wonDeals || 0,
          activeLeads: currentPipelinePerf.activeDeals || 0,
          conversionRate: currentPipelinePerf.conversionRate || 0
        });
      }

      setPipelinePerf(perfRes.data || []);
      setFunnelData(funnelRes.funnel || []);
      setAgentPerf(agentRes.data || []);
      
    } catch (err) {
      console.error("Report loading failed:", err);
      toast.error("Failed to refresh reports");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight font-outfit">Sales Intelligence</h1>
          <p className="text-muted-foreground mt-1 font-medium font-inter">Actionable insights to drive your revenue growth</p>
        </div>

        <div className="flex items-center gap-3 bg-card p-1.5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-muted-foreground">
            <Filter className="w-4 h-4" />
            <span>Range:</span>
          </div>
          {['last7days', 'last30days', 'last90days'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                dateRange === range 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {range === 'last7days' ? '1W' : range === 'last30days' ? '1M' : '3M'}
            </button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          <select 
            value={activePipeline?._id}
            onChange={(e) => {
              const p = pipelines.find(p => p._id === e.target.value);
              if (p) setActivePipeline(p);
            }}
            className="bg-transparent text-xs font-bold text-foreground border-none focus:ring-0 pr-8 cursor-pointer"
          >
            {pipelines.map((p, idx) => (
              <option key={p._id || idx} value={p._id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'Total Sales', value: `₹${summaryStats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'from-blue-500 to-indigo-600', trend: '+12.5%' },
          { label: 'Deals Won', value: summaryStats.dealsWon, icon: Trophy, color: 'from-emerald-500 to-teal-600', trend: '+8.2%' },
          { label: 'Active Pipeline', value: summaryStats.activeLeads, icon: Users, color: 'from-amber-500 to-orange-600', trend: '+15.1%' },
          { label: 'Lead Win Rate', value: `${summaryStats.conversionRate}%`, icon: TrendingUp, color: 'from-fuchsia-500 to-purple-600', trend: '+2.4%' }
        ].map((stat, i) => (
          <div key={i} className="bg-card rounded-[2rem] border border-border p-6 shadow-premium hover:shadow-2xl transition-all group overflow-hidden relative">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-[0.03] rounded-bl-[4rem] group-hover:scale-150 transition-transform duration-500`} />
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3.5 bg-gradient-to-br ${stat.color} rounded-2xl shadow-lg shadow-inner ring-4 ring-white/10`}>
                <stat.icon className="text-white w-6 h-6" />
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[10px] font-extrabold uppercase">
                <ArrowUpRight className="w-3 h-3" />
                {stat.trend}
              </div>
            </div>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mb-1 font-inter">{stat.label}</p>
            <p className="text-3xl font-extrabold font-outfit text-foreground tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Sales Funnel Analysis */}
        <div className="lg:col-span-2 bg-card rounded-[2.5rem] border border-border p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-extrabold text-foreground font-outfit">Conversion Funnel</h3>
              <p className="text-sm text-muted-foreground font-medium">Stage-by-stage drop-off analysis</p>
            </div>
            <button className="p-2.5 bg-muted rounded-xl hover:bg-primary/10 transition-colors">
              <Download className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-6 relative">
            {funnelData.length === 0 ? (
              <div className="py-20 text-center opacity-50 font-medium">No funnel data for this period</div>
            ) : (
              funnelData.map((stage, i) => {
                const maxCount = Math.max(...funnelData.map(s => s.dealCount || 1));
                const width = (stage.dealCount / maxCount) * 100;
                return (
                  <div key={i} className="group flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tighter">
                      <span className="text-foreground">{stage.stageName}</span>
                      <span className="text-primary bg-primary/5 px-2 py-0.5 rounded">{stage.dealCount} Deals</span>
                    </div>
                    <div className="relative h-10 w-full bg-muted/30 rounded-2xl overflow-hidden border border-border/50">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-1000 ease-out flex items-center justify-end px-4"
                        style={{ width: `${width}%` }}
                      >
                        <span className="text-[10px] text-white font-black">{width > 20 ? `${Math.round(width)}%` : ''}</span>
                      </div>
                    </div>
                    {i < funnelData.length - 1 && (
                      <div className="flex items-center gap-2 pl-4">
                        <div className="w-px h-6 bg-border" />
                        <span className="text-[10px] font-black text-red-500/80 bg-red-500/5 px-2 py-0.5 rounded-full">
                          ↓ {stage.dropoff}% LEAKAGE
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Agent Leaderboard */}
        <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-xl font-extrabold text-foreground font-outfit">Top Performers</h3>
            <p className="text-sm text-muted-foreground font-medium">Leading agents by win rate</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-2 no-scrollbar">
            {agentPerf.length === 0 ? (
              <div className="py-20 text-center opacity-50 font-medium">No agent data found</div>
            ) : (
              agentPerf.slice(0, 6).map((agent, i) => (
                <div key={i} className="group bg-muted/30 p-4 rounded-3xl border border-border/50 hover:border-primary/30 hover:bg-card hover:shadow-xl transition-all flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg ${
                    i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 ring-4 ring-amber-400/20' : 
                    i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
                    i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-700' : 'bg-primary/20 text-primary'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{agent.agentName}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{agent.wonDeals} deals won</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary font-outfit">{Math.round(agent.winRate)}%</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">Win Rate</p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <button className="mt-8 py-4 w-full bg-muted hover:bg-primary hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
            Full Agent Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pipeline Distribution */}
        <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-extrabold text-foreground font-outfit">Pipeline Landscape</h3>
              <p className="text-sm text-muted-foreground font-medium">Distribution across all pipelines</p>
            </div>
            <PieIcon className="w-6 h-6 text-muted-foreground opacity-20" />
          </div>

          <div className="space-y-4">
            {pipelinePerf.map((p, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="w-full">
                  <div className="flex justify-between text-[11px] font-bold uppercase mb-1.5 px-1">
                    <span className="text-foreground">{p.pipelineName}</span>
                    <span className="text-muted-foreground">₹{p.totalValue.toLocaleString()}</span>
                  </div>
                  <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden border border-border/30 p-0.5">
                    <div 
                      className="h-full bg-primary rounded-full group-hover:brightness-110 transition-all duration-700"
                      style={{ width: `${Math.max(10, (p.totalValue / (summaryStats.totalRevenue || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Sales Velocity */}
        <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-extrabold text-foreground font-outfit">Sales Momentum</h3>
              <p className="text-sm text-muted-foreground font-medium">Real-time ecosystem activity</p>
            </div>
            <Activity className="w-6 h-6 text-primary animate-pulse" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 p-6 rounded-[2rem] border border-border/50">
              <p className="text-[10px] font-black text-muted-foreground uppercase mb-2">Deal Velocity</p>
              <p className="text-2xl font-black text-foreground font-outfit">18.4 Days</p>
              <p className="text-[10px] text-emerald-500 font-bold mt-1">Avg to Close</p>
            </div>
            <div className="bg-muted/30 p-6 rounded-[2rem] border border-border/50">
              <p className="text-[10px] font-black text-muted-foreground uppercase mb-2">Avg Deal Size</p>
              <p className="text-2xl font-black text-foreground font-outfit">₹48,200</p>
              <p className="text-[10px] text-primary font-bold mt-1">Current Weighted</p>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground px-2">
              <span>System Throughput</span>
              <span>88% Efficiency</span>
            </div>
            <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
              <div className="h-full w-[88%] bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        .font-inter { font-family: 'Inter', sans-serif; }
        .font-outfit { font-family: 'Outfit', sans-serif; }
        .shadow-premium { box-shadow: 0 4px 20px -5px rgba(0, 0, 0, 0.05); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
