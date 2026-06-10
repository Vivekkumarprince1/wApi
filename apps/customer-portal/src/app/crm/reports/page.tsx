"use client";

import React, { useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Calendar, 
  ArrowRight, 
  PieChart, 
  Activity,
  Target,
  Users,
  Clock,
  ArrowUpRight,
  Filter,
  Zap,
  MousePointer2,
  Percent,
  ChevronRight,
  Layers,
  Sparkles
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { 
  fetchPipelines,
  Pipeline
} from '@/lib/api/crm';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart as RPieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import FlashLoader from '@/components/ui/flash-loader';
import { cn } from '@/lib/utils';
import { 
  Avatar, 
  AvatarImage, 
  AvatarFallback 
} from '@/components/ui/avatar';

const KPICard = ({ label, value, icon: Icon, trend, color, bg }: any) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="relative group border-none ring-1 ring-border/40 bg-card rounded-[32px] overflow-hidden shadow-premium-sm hover:ring-primary/20 transition-all p-6"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-3 rounded-2xl", bg, color)}>
         <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col items-end">
         <Badge variant="secondary" className="bg-muted/50 text-[9px] font-black tracking-widest uppercase rounded-lg border-none py-1">
            {trend}
         </Badge>
      </div>
    </div>
    <div className="space-y-1">
       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">{label}</p>
       <h3 className="text-3xl font-black tracking-tight text-foreground">{value}</h3>
    </div>
    {/* Decorative gradient */}
    <div className={cn("absolute -bottom-10 -right-10 w-24 h-24 blur-[40px] opacity-10 rounded-full", bg)} />
  </motion.div>
);

export default function CRMReportsPage() {
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string | null>(null);

  const { data: response } = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines
  });

  const pipelines: Pipeline[] = (response as any) || [];

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['crm-analytics', selectedPipelineId],
    queryFn: async () => {
      const response: any = await api.get('/crm/analytics', {
        params: { pipelineId: selectedPipelineId }
      });
      return response.data;
    }
  });

  const funnelColors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];

  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (isLoading) return <FlashLoader />;

  const { 
    funnelData = [], 
    statusData = [], 
    agentPerformance = [], 
    metrics = {}, 
    taskStats = {},
    intelligence = {}
  } = analytics || {};

  // KPI Calculations
  const totalLeads = metrics.totalDeals || 0;
  const conversionRate = metrics.winRate || 0;



  return (
    <div className="h-[calc(100vh-theme(spacing.20))] overflow-y-auto custom-scrollbar no-scrollbar bg-muted/[0.02]">
      <div className="p-8 max-w-[1600px] mx-auto space-y-10 pb-32">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-4">
              Intelligence Hub
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Live Engine</span>
              </div>
            </h1>
            <p className="text-muted-foreground text-sm font-medium opacity-60 leading-relaxed max-w-2xl">
              Analyzing deal velocity, agent throughput, and sales funnel drop-offs to optimize your workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-muted/20 border border-border/10 rounded-2xl mr-2">
                 <Select 
                  value={selectedPipelineId || "all"} 
                  onValueChange={(v) => setSelectedPipelineId(v === "all" ? null : v)}
                 >
                    <SelectTrigger className="h-10 w-[200px] border-none bg-background shadow-premium-sm rounded-xl font-black text-[10px] uppercase tracking-widest text-primary focus:ring-0">
                      <SelectValue placeholder="All Pipelines" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/40 shadow-premium-lg">
                       <SelectItem value="all" className="font-bold py-2.5">Global View</SelectItem>
                       {pipelines.map((p) => (
                         <SelectItem key={p._id} value={p._id} className="font-bold py-2.5">{p.name}</SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>
              <Button variant="outline" className="rounded-2xl h-12 px-6 border-border/30 font-black text-[10px] uppercase tracking-widest bg-card hover:bg-muted shadow-premium-sm">
                  <Download className="mr-2 h-4 w-4 opacity-40" /> Export Intelligence
              </Button>
          </div>
        </div>

        {/* Core Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
             label="Active Pipeline Value" 
             value={`₹${metrics.activeValue?.toLocaleString() || 0}`} 
             icon={Target} 
             trend="SURFACE VALUE" 
             color="text-indigo-500" 
             bg="bg-indigo-500/5" 
          />
          <KPICard 
             label="Won Deals Value" 
             value={`₹${metrics.wonValue?.toLocaleString() || 0}`} 
             icon={TrendingUp} 
             trend="RECOGNIZED REVENUE" 
             color="text-emerald-500" 
             bg="bg-emerald-500/5" 
          />
          <KPICard 
             label="Conversion Velocity" 
             value={`${conversionRate}%`} 
             icon={Activity} 
             trend="WIN RATE" 
             color="text-purple-500" 
             bg="bg-purple-500/5" 
          />
          <KPICard 
             label="Action Performance" 
             value={`${taskStats.pending || 0}`} 
             icon={Clock} 
             trend={`${taskStats.overdue || 0} OVERDUE`} 
             color="text-amber-500" 
             bg="bg-amber-500/5" 
          />
        </div>

        {/* Primary Data Visuals */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Professional Conversion Funnel */}
          <Card className="lg:col-span-8 border-none ring-1 ring-border/30 bg-card rounded-[48px] shadow-premium-lg overflow-hidden group/funnel">
            <CardHeader className="p-10 pb-2">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tight">Sales Funnel Efficiency</CardTitle>
                    <CardDescription className="text-xs font-semibold opacity-50 uppercase tracking-widest">Tracking leads from capture to conversion.</CardDescription>
                  </div>
                  <div className="size-12 rounded-[20px] bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                     <Layers className="size-6" />
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-10">
               <div className="flex flex-col gap-4 relative">
                  {funnelData.map((stage: any, index: number) => {
                    const width = 100 - (index * 8);
                    const count = stage.count || 0;
                    const prevCount = index > 0 ? funnelData[index-1].count : count;
                    const dropoff = index === 0 ? 0 : (100 - (count / prevCount * 100)).toFixed(1);

                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        key={stage.stage || index} 
                        className="relative"
                      >
                         <div 
                           className="h-16 rounded-[24px] flex items-center justify-between px-8 relative transition-all hover:scale-[1.02] cursor-default overflow-hidden group/bar shadow-premium-sm"
                           style={{ 
                             width: `${width}%`, 
                             backgroundColor: `${funnelColors[index % funnelColors.length]}15`,
                             border: `1px solid ${funnelColors[index % funnelColors.length]}30`
                           }}
                         >
                            <div className="flex items-center gap-4 min-w-0">
                               <div className="size-8 rounded-xl flex items-center justify-center font-black text-xs" style={{ backgroundColor: funnelColors[index % funnelColors.length], color: '#fff' }}>
                                  {index + 1}
                               </div>
                               <span className="font-black text-sm uppercase tracking-widest truncate">{stage.stage}</span>
                            </div>
                            <div className="flex items-center gap-10">
                               <div className="text-right">
                                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Deals</p>
                                  <p className="text-xl font-black">{count}</p>
                               </div>
                               <div className="text-right min-w-[60px]">
                                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Value</p>
                                  <p className="text-sm font-black">₹{stage.value?.toLocaleString() || 0}</p>
                               </div>
                            </div>
                            {/* Visual effect */}
                            <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: funnelColors[index % funnelColors.length] }} />
                         </div>
                         
                         {index < funnelData.length - 1 && (
                            <div className="absolute -bottom-4 right-10 flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 rounded-full border border-red-500/20 z-10 shadow-premium-sm">
                               <TrendingUp className="size-3 rotate-180" />
                               <span className="text-[9px] font-black uppercase tracking-widest">{dropoff}% DROP</span>
                            </div>
                         )}
                      </motion.div>
                    );
                  })}
               </div>
            </CardContent>
          </Card>

          {/* Deal Mix - Advanced Donut */}
          <Card className="lg:col-span-4 border-none ring-1 ring-border/30 bg-card rounded-[48px] shadow-premium-lg overflow-hidden flex flex-col">
            <CardHeader className="p-10 pb-0">
               <CardTitle className="text-2xl font-black tracking-tight">Portfolio Mix</CardTitle>
               <CardDescription className="text-xs font-semibold opacity-50 uppercase tracking-widest">Active deal distribution.</CardDescription>
            </CardHeader>
            <CardContent className="p-10 flex-1 flex flex-col justify-center relative">
               <div className="h-[280px] w-full relative">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <RPieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={85}
                          outerRadius={110}
                          paddingAngle={6}
                          dataKey="value"
                          stroke="none"
                        >
                          {statusData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} className="outline-none" />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ border: 'none', borderRadius: '16px', background: '#000', color: '#fff' }} />
                      </RPieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Avg. Win Rate</p>
                        <p className="text-4xl font-black text-foreground">{metrics.winRate}%</p>
                     </div>
                  </div>
               </div>

               <div className="mt-8 grid grid-cols-2 gap-4">
                  {statusData.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20 border border-border/10">
                       <div className="size-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                       <div className="flex-1">
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-40 leading-none mb-1">{item.name}</p>
                          <p className="text-xs font-black">{item.value}%</p>
                       </div>
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>

          {/* Agent Elite Leaderboard */}
          <Card className="lg:col-span-12 border-none ring-1 ring-border/30 bg-card rounded-[48px] shadow-premium-lg overflow-hidden">
            <CardHeader className="p-10 pb-0">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                       Agent Performance Leaderboard
                       <Sparkles className="size-6 text-amber-500 fill-amber-500/20" />
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold opacity-50 uppercase tracking-widest text-muted-foreground">Tracking revenue throughput and deal closure speed.</CardDescription>
                  </div>
                  <Button variant="ghost" className="rounded-xl h-10 px-5 font-black text-[10px] uppercase tracking-widest hover:bg-muted gap-2">
                     Historical Data <ArrowUpRight className="size-4" />
                  </Button>
               </div>
            </CardHeader>
            <CardContent className="p-10">
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {agentPerformance.length > 0 ? agentPerformance.map((agent: any, i: number) => (
                    <motion.div 
                      whileHover={{ y: -5 }}
                      key={agent._id || i} 
                      className="group relative p-6 rounded-[32px] bg-muted/20 border border-border/20 flex flex-col gap-6 transition-all hover:bg-muted/30 hover:shadow-premium-sm"
                    >
                       <div className="flex items-center justify-between">
                          <div className="relative">
                             <Avatar className="size-16 rounded-[24px] ring-4 ring-background shadow-premium-lg">
                                <AvatarImage src={agent.avatar} />
                                <AvatarFallback className="text-xl font-black bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                                   {agent.name?.charAt(0) || <Users className="size-6" />}
                                </AvatarFallback>
                             </Avatar>
                             {i < 3 && (
                                <div className={cn(
                                  "absolute -top-3 -right-3 size-8 rounded-2xl flex items-center justify-center font-black text-xs shadow-lg ring-4 ring-background",
                                  i === 0 ? "bg-amber-400 text-amber-950" : i === 1 ? "bg-slate-300 text-slate-900" : "bg-orange-400 text-orange-950"
                                )}>
                                   #{i + 1}
                                </div>
                             )}
                          </div>
                           <div className="text-right">
                              <div className="flex items-center gap-1.5 text-emerald-500 justify-end mb-1">
                                 <TrendingUp className="size-3" />
                                 <span className="text-[10px] font-black uppercase tracking-widest">TOP PERFORMER</span>
                              </div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Performance</p>
                              <p className="text-xs font-black text-emerald-500">OPTIMAL</p>
                           </div>
                       </div>

                        <div className="space-y-1">
                          <h4 className="text-lg font-black tracking-tight text-foreground truncate">{agent.name}</h4>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Sales Performance</p>
                       </div>

                       <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/10">
                          <div>
                             <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40 mb-1">Wins</p>
                             <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black rounded-lg">
                                {agent.count} Leads
                             </Badge>
                          </div>
                          <div className="text-right">
                             <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40 mb-1">Impact</p>
                             <p className="text-xs font-black tracking-tighter">₹{agent.totalValue?.toLocaleString() || 0}</p>
                          </div>
                       </div>

                       <Button className="w-full mt-2 rounded-2xl h-11 bg-background border border-border/20 text-muted-foreground hover:text-primary hover:bg-muted text-[9px] font-black uppercase tracking-widest shadow-premium-sm">
                           View Profile
                       </Button>
                    </motion.div>
                  )) : (
                    <div className="col-span-full h-48 border-4 border-dashed border-border/10 rounded-[48px] flex flex-col items-center justify-center gap-4 text-muted-foreground opacity-30">
                       <Users className="size-10" />
                       <p className="text-xs font-black uppercase tracking-widest">Recruiting sales champions...</p>
                    </div>
                  )}
               </div>
            </CardContent>
          </Card>

          {/* Intelligence Insights - Premium Section */}
          <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
             <Card className="border-none ring-1 ring-border/30 bg-card rounded-[40px] shadow-premium-sm overflow-hidden p-8 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                   <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                      <Clock className="size-6" />
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40 leading-none">Avg. Age in Pipeline</p>
                      <h4 className="text-xl font-black">{intelligence.avgAgeInPipeline || 0} Days</h4>
                   </div>
                </div>
                <div className="space-y-2">
                   <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="opacity-40">Velocity Index</span>
                      <span className="text-emerald-500">+{intelligence.velocityIndex || 0}% OPTIMAL</span>
                   </div>
                   <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${intelligence.velocityIndex || 70}%` }} />
                   </div>
                </div>
             </Card>

             <Card className="border-none ring-1 ring-border/30 bg-card rounded-[40px] shadow-premium-sm overflow-hidden p-8 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                   <div className="size-12 rounded-2xl bg-red-500/5 flex items-center justify-center text-red-500">
                      <Zap className="size-6" />
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40 leading-none">Critical Friction Stage</p>
                      <h4 className="text-xl font-black italic">{intelligence.frictionStage || 'None'}</h4>
                   </div>
                </div>
                <div className="space-y-2">
                   <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="opacity-40">Dropout Risk</span>
                      <span className="text-red-500">REAL-TIME ANALYSIS</span>
                   </div>
                   <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full w-[42%] bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
                   </div>
                </div>
             </Card>

             <Card className="border-none ring-1 ring-border/30 bg-card rounded-[40px] shadow-premium-sm overflow-hidden p-8 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                   <div className="size-12 rounded-2xl bg-amber-500/5 flex items-center justify-center text-amber-500">
                      <Zap className="size-6" />
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40 leading-none">Agent Hustle Factor</p>
                      <h4 className="text-xl font-black">{intelligence.hustleFactor || 0}%</h4>
                   </div>
                </div>
                <div className="space-y-2">
                   <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="opacity-40">Proactivity Score</span>
                      <span className="text-amber-500">EXCELLENT</span>
                   </div>
                   <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${intelligence.hustleFactor || 85}%` }} />
                   </div>
                </div>
             </Card>
          </div>

          <Card className="lg:col-span-12 border-none ring-1 ring-border/30 bg-card rounded-[48px] shadow-premium-lg p-10 mt-8">
             <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                   <CardTitle className="text-2xl font-black tracking-tight">Lead Source Attribution</CardTitle>
                   <CardDescription className="text-xs font-semibold opacity-50 uppercase tracking-widest">Identifying the highest quality incoming channels.</CardDescription>
                </div>
                <div className="flex gap-2">
                   {((intelligence.sourceAttribution || []) as any[]).slice(0, 3).map((source: any) => (
                     <div key={source.label} className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-xl border border-border/10">
                        <div className="size-2 rounded-full bg-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{source.label}</span>
                     </div>
                   ))}
                </div>
             </div>
             
             <div className="h-[200px] flex items-end gap-12 px-4">
                {(intelligence.sourceAttribution || []).length > 0 ? (intelligence.sourceAttribution as any[]).map((item: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-4 group/bar">
                     <div className="w-full relative flex items-end justify-center">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${item.val * 2}px` }}
                          className={cn("w-full rounded-2xl transition-all duration-700 group-hover/bar:brightness-110 shadow-lg bg-primary")}
                        />
                        <div className="absolute -top-10 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-background border border-border/30 px-3 py-1 rounded-lg text-xs font-black shadow-premium-sm">
                           {Math.round(item.val)}%
                        </div>
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{item.label}</span>
                  </div>
                )) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20 italic text-[10px] font-black uppercase tracking-widest">
                     Awaiting source data...
                  </div>
                )}
             </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
