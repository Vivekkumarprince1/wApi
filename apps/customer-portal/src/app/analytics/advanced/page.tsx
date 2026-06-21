"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
   CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
   TrendingUp,
   TrendingDown,
   MessageSquare,
   Users,
   CheckCircle,
   BarChart3,
   Calendar,
   Download,
   DollarSign,
   ArrowRight,
   Loader2
} from "lucide-react";
import {
   AreaChart,
   Area,
   XAxis,
   YAxis,
   CartesianGrid,
   Tooltip,
   ResponsiveContainer,
   BarChart,
   Bar,
   PieChart,
   Pie,
   Cell,
} from 'recharts';
import { getAdvancedChatAnalytics } from '@/lib/api/analytics';
import { toast } from 'sonner';

type Kpis = {
   totalMessages: number;
   totalMessagesChange: number;
   activeContacts: number;
   activeContactsChange: number;
   estimatedSpend: number;
   estimatedSpendChange: number;
   deliveryRate: number;
   deliveryRateChange: number;
};

type VolumePoint = {
   date: string;
   name: string;
   sent: number;
   received: number;
   delivered: number;
};

type CategoryPoint = {
   name: string;
   value: number;
   color: string;
};

type AgentRow = {
   id: string;
   name: string;
   resolved: number;
   rTime: string;
   satisfaction: number;
   status: string;
};

const EMPTY_KPIS: Kpis = {
   totalMessages: 0,
   totalMessagesChange: 0,
   activeContacts: 0,
   activeContactsChange: 0,
   estimatedSpend: 0,
   estimatedSpendChange: 0,
   deliveryRate: 0,
   deliveryRateChange: 0,
};

const EMPTY_MIX: CategoryPoint[] = [
   { name: 'Marketing', value: 0, color: '#10b981' },
   { name: 'Utility', value: 0, color: '#3b82f6' },
   { name: 'Service', value: 0, color: '#6366f1' },
   { name: 'Auth', value: 0, color: '#f59e0b' },
];

const numberFormatter = new Intl.NumberFormat('en-US');

function formatCompactNumber(value: number) {
   if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
   }
   return numberFormatter.format(value);
}

function getChangeTone(change: number) {
   if (change > 0) return 'positive';
   if (change < 0) return 'negative';
   return 'neutral';
}

export default function AdvancedAnalyticsPage() {
   const router = useRouter();
   const [loading, setLoading] = useState(true);
   const [dateRange, setDateRange] = useState(30);
   const [kpis, setKpis] = useState<Kpis>(EMPTY_KPIS);
   const [messageVolume, setMessageVolume] = useState<VolumePoint[]>([]);
   const [conversationMix, setConversationMix] = useState<CategoryPoint[]>(EMPTY_MIX);
   const [agentPerformance, setAgentPerformance] = useState<AgentRow[]>([]);

   useEffect(() => {
      const loadAdvancedAnalytics = async () => {
         try {
            setLoading(true);
            const payload = await getAdvancedChatAnalytics(dateRange) || {};

            setKpis(payload?.kpis || EMPTY_KPIS);
            setMessageVolume(payload?.messageVolume || []);
            setConversationMix(payload?.conversationMix || EMPTY_MIX);
            setAgentPerformance(payload?.agentPerformance || []);
         } catch (error) {
            console.error('[Analytics Load Error]:', error);
            toast.error('Unable to load chat analytics');
            setKpis(EMPTY_KPIS);
            setMessageVolume([]);
            setConversationMix(EMPTY_MIX);
            setAgentPerformance([]);
         } finally {
            setLoading(false);
         }
      };

      loadAdvancedAnalytics();
   }, [dateRange]);

   const totalMixValue = useMemo(
      () => conversationMix.reduce((sum, entry) => sum + entry.value, 0),
      [conversationMix]
   );

   const handleExport = () => {
      const payload = {
         generatedAt: new Date().toISOString(),
         days: dateRange,
         kpis,
         messageVolume,
         conversationMix,
         agentPerformance,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-analytics-${dateRange}d.json`;
      a.click();
      URL.revokeObjectURL(url);
   };

   return (
      <div className="flex flex-col gap-8">

         {/* Analytics Header */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
               <h1 className="text-3xl font-bold tracking-tight">Advanced Analytics</h1>
               <p className="text-muted-foreground flex items-center gap-2">
                  Deep insights into your WhatsApp communication performance.
               </p>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex items-center bg-background/50 border border-border/50 rounded-xl px-4 text-xs font-bold uppercase tracking-widest h-10">
                  <Calendar className="h-4 w-4 mr-2" />
                  Last {dateRange} Days
               </div>
               <div className="flex items-center rounded-xl border border-border/50 overflow-hidden">
                  {[7, 30, 90].map((days) => (
                     <button
                        key={days}
                        onClick={() => setDateRange(days)}
                        className={`px-3 h-10 text-[10px] font-black uppercase tracking-widest transition-colors ${
                           dateRange === days ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent/40'
                        }`}
                     >
                        {days}D
                     </button>
                  ))}
               </div>
               <Button onClick={handleExport} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 h-10 px-5">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
               </Button>
            </div>
         </div>

         {loading && (
            <Card className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl">
               <CardContent className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading live analytics...
               </CardContent>
            </Card>
         )}

         {/* Global KPI Cards */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                  <MessageSquare className="h-12 w-12" />
               </div>
               <CardContent className="p-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Total Messages</p>
                  <h3 className="text-3xl font-black">{formatCompactNumber(kpis.totalMessages)}</h3>
                  <div className="flex items-center mt-4 gap-2 text-[10px] font-bold">
                     <div className="flex items-center bg-white/20 rounded-full px-2 py-0.5">
                        {getChangeTone(kpis.totalMessagesChange) === 'negative' ? <TrendingDown className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />} {kpis.totalMessagesChange > 0 ? '+' : ''}{kpis.totalMessagesChange}%
                     </div>
                     <span className="opacity-80 font-medium">vs last period</span>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-none bg-blue-500 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                  <Users className="h-12 w-12" />
               </div>
               <CardContent className="p-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Active Contacts</p>
                  <h3 className="text-3xl font-black">{formatCompactNumber(kpis.activeContacts)}</h3>
                  <div className="flex items-center mt-4 gap-2 text-[10px] font-bold">
                     <div className="flex items-center bg-white/20 rounded-full px-2 py-0.5">
                        {getChangeTone(kpis.activeContactsChange) === 'negative' ? <TrendingDown className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />} {kpis.activeContactsChange > 0 ? '+' : ''}{kpis.activeContactsChange}%
                     </div>
                     <span className="opacity-80 font-medium">vs last period</span>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-none bg-violet-500 text-white shadow-xl shadow-violet-500/20 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                  <DollarSign className="h-12 w-12" />
               </div>
               <CardContent className="p-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Est. Spend</p>
                  <h3 className="text-3xl font-black">${kpis.estimatedSpend.toFixed(2)}</h3>
                  <div className="flex items-center mt-4 gap-2 text-[10px] font-bold">
                     <div className="flex items-center bg-white/20 rounded-full px-2 py-0.5 text-red-100">
                        {getChangeTone(kpis.estimatedSpendChange) === 'negative' ? <TrendingDown className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />} {kpis.estimatedSpendChange > 0 ? '+' : ''}{kpis.estimatedSpendChange}%
                     </div>
                     <span className="opacity-80 font-medium">vs last period</span>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-none bg-slate-900 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                  <CheckCircle className="h-12 w-12" />
               </div>
               <CardContent className="p-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Delivery Rate</p>
                  <h3 className="text-3xl font-black">{kpis.deliveryRate.toFixed(1)}%</h3>
                  <div className="flex items-center mt-4 gap-2 text-[10px] font-bold text-emerald-400">
                     <div className="flex items-center bg-white/10 rounded-full px-2 py-0.5">
                        <CheckCircle className="h-3 w-3 mr-1" /> {kpis.deliveryRateChange === 0 ? 'Stable' : `${kpis.deliveryRateChange > 0 ? '+' : ''}${kpis.deliveryRateChange}%`}
                     </div>
                     <span className="text-slate-400 font-medium">outbound confirmed delivery</span>
                  </div>
               </CardContent>
            </Card>
         </div>

         {/* Charts Section */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Message Volume Trend */}
            <Card className="lg:col-span-2 border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl">
               <CardHeader className="flex flex-row items-center justify-between pb-8">
                  <div>
                     <CardTitle className="text-lg font-bold">Message Volume</CardTitle>
                     <CardDescription>Daily sent vs received traffic</CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sent</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-blue-500/30 border border-blue-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Received</span>
                     </div>
                  </div>
               </CardHeader>
               <CardContent className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={messageVolume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                           <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                           </linearGradient>
                           <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                        <XAxis
                           dataKey="name"
                           axisLine={false}
                           tickLine={false}
                           tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                           dy={10}
                        />
                        <YAxis
                           axisLine={false}
                           tickLine={false}
                           tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                        />
                        <Tooltip
                           contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                           itemStyle={{ fontSize: '11px', fontWeight: 800 }}
                        />
                        <Area type="monotone" dataKey="sent" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSent)" />
                        <Area type="monotone" dataKey="received" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorReceived)" />
                     </AreaChart>
                  </ResponsiveContainer>
               </CardContent>
            </Card>

            {/* Cost by Category */}
            <Card className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl">
               <CardHeader>
                  <CardTitle className="text-lg font-bold">Conversation Mix</CardTitle>
                  <CardDescription>Estimated cost distribution</CardDescription>
               </CardHeader>
               <CardContent>
                  <div className="h-[250px] relative">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                                             data={conversationMix}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={8}
                              dataKey="value"
                           >
                              {conversationMix.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                           </Pie>
                           <Tooltip />
                        </PieChart>
                     </ResponsiveContainer>
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                        <p className="text-2xl font-black">{totalMixValue.toFixed(1)}%</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Mapped</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-8">
                     {conversationMix.map((cat) => (
                        <div key={cat.name} className="flex flex-col gap-1 p-3 rounded-2xl bg-accent/30 border border-border/20">
                           <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase truncate">{cat.name}</span>
                           </div>
                           <p className="text-sm font-black">{cat.value}%</p>
                        </div>
                     ))}
                  </div>
               </CardContent>
            </Card>

         </div>

         {/* Agent Performance Table */}
         <Card className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl overflow-hidden shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
               <div>
                  <CardTitle className="text-lg font-bold">Agent Performance</CardTitle>
                  <CardDescription>Response times and resolution metrics</CardDescription>
               </div>
               <Button variant="ghost" onClick={() => { router.push('/settings'); }} className="text-primary font-bold text-xs uppercase tracking-widest">
                  View All Agents <ArrowRight className="h-3 w-3 ml-2" />
               </Button>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-accent/50 border-y border-border/30">
                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agent Name</th>
                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resolved</th>
                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg. Response</th>
                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rating</th>
                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Status</th>
                        </tr>
                     </thead>
                     <tbody>
                        {agentPerformance.map((agent) => (
                           <tr key={agent.id} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                              <td className="p-4 py-5">
                                 <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                                       {agent.name[0]}
                                    </div>
                                    <span className="font-bold text-sm">{agent.name}</span>
                                 </div>
                              </td>
                              <td className="p-4 font-bold text-sm font-mono">{agent.resolved}</td>
                              <td className="p-4 font-bold text-sm font-mono text-emerald-500">{agent.rTime}</td>
                              <td className="p-4">
                                 <div className="flex items-center gap-1.5 text-amber-500">
                                    <BarChart3 className="h-3 w-3" />
                                    <span className="text-sm font-black">{agent.satisfaction}</span>
                                 </div>
                              </td>
                              <td className="p-4 text-right">
                                 <Badge
                                    variant="secondary"
                                    className={`border-none font-bold text-[9px] uppercase tracking-tighter ${
                                       agent.status === 'Top Performer'
                                          ? 'bg-emerald-500/10 text-emerald-500'
                                          : agent.status === 'Needs Attention'
                                          ? 'bg-red-500/10 text-red-500'
                                          : 'bg-blue-500/10 text-blue-500'
                                    }`}
                                 >
                                    {agent.status}
                                 </Badge>
                              </td>
                           </tr>
                        ))}
                        {agentPerformance.length === 0 && (
                           <tr>
                              <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">No assigned conversation activity for this period.</td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </CardContent>
         </Card>

      </div>
   );
}
