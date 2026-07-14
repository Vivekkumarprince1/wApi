"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Play,
  Pause,
  Trash2,
  Eye,
  Search,
  SlidersHorizontal,
  User,
  Plus,
  Target,
  TrendingUp,
  MessageSquare,
  FileDown,
  Filter,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { fetchCampaigns, performCampaignAction, deleteCampaign, Campaign } from '@/lib/api/campaigns';
import FlashLoader from '@/components/ui/flash-loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const EmptyState = () => {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 shadow-premium-sm border border-primary/10">
        <MessageSquare className="h-10 w-10 text-primary opacity-40" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">No campaigns found</h3>
      <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto font-medium">
        Broadcast your message to thousands of customers in just a few clicks.
      </p>
      <Button
        onClick={() => router.push('/campaign/new')}
        className="rounded-xl px-8 h-12 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-bold group"
      >
        <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform" />
        Create First Campaign
      </Button>
    </div>
  );
};

const CampaignsPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('one-time');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => fetchCampaigns(),
    refetchInterval: (query) => {
      const payload: any = query.state.data;
      const campaigns = payload?.campaigns || payload?.data?.campaigns || payload?.data || [];
      return Array.isArray(campaigns) && campaigns.some((campaign: any) => ['QUEUED', 'RUNNING', 'SCHEDULED', 'PROCESSING'].includes(String(campaign?.status || '').toUpperCase())) ? 10000 : false;
    },
    refetchIntervalInBackground: false,
  });

  const campaigns: Campaign[] = useMemo(() => data?.campaigns || [], [data?.campaigns]);

  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns || [];

    // Tab filtering
    if (activeTab === 'one-time') {
      filtered = filtered.filter(c => c && (c.campaignType === 'one-time' || !c.campaignType));
    } else if (activeTab === 'ongoing') {
      filtered = filtered.filter(c => c && c.campaignType === 'scheduled');
    }

    // Search filtering
    if (search) {
      filtered = filtered.filter(c =>
        c && (
          (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.template?.name || '').toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    return filtered;
  }, [campaigns, activeTab, search]);

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string, action: any }) => performCampaignAction(id, action),
    onSuccess: (_, { action }) => {
      toast.success(`Campaign ${action} successful`);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Action failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => {
      toast.success('Campaign deleted');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Delete failed');
    }
  });

  const getStatusConfig = (s: string) => {
    const status = (s || '').toLowerCase();
    switch (status) {
      case 'running':
      case 'sending': return { color: 'bg-blue-500/10 text-blue-600 border-blue-200', pulse: true };
      case 'completed': return { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', pulse: false };
      case 'paused': return { color: 'bg-amber-500/10 text-amber-600 border-amber-200', pulse: false };
      case 'failed': return { color: 'bg-destructive/10 text-destructive border-destructive/20', pulse: false };
      case 'scheduled':
      case 'queued': return { color: 'bg-violet-500/10 text-violet-600 border-violet-200', pulse: true };
      case 'draft': return { color: 'bg-muted text-muted-foreground border-border', pulse: false };
      default: return { color: 'bg-muted text-muted-foreground border-border', pulse: false };
    }
  };



  if (isLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-4">
            Campaigns
            <Badge variant="secondary" className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-primary/5 text-primary border-primary/10">
              {campaigns.length} Total
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Manage and track your message broadcasts.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (!filteredCampaigns.length) { toast.error('No campaigns to export'); return; }
              const headers = ['Name', 'Type', 'Status', 'Template', 'Recipients', 'Sent', 'Delivered', 'Read', 'Created'];
              const cell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
              const rows = filteredCampaigns.map((c: any) => [
                c.name, c.campaignType || 'one-time', c.status, c.templateName || c.template?.name,
                c.stats?.total ?? c.recipientCount, c.stats?.sent, c.stats?.delivered, c.stats?.read, c.createdAt
              ].map(cell).join(','));
              const csv = [headers.map(cell).join(','), ...rows].join('\n');
              const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
              const a = Object.assign(document.createElement('a'), { href: url, download: 'campaigns.csv' });
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="rounded-2xl px-6 h-12 font-bold border-border/50 group">
            <FileDown className="h-4 w-4 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
            Export
          </Button>
          <Button
            onClick={() => router.push('/campaign/new')}
            className="rounded-2xl px-6 h-12 shadow-premium hover:shadow-primary/20 transition-all font-bold bg-primary group"
          >
            <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-3xl p-1.5 flex flex-col sm:flex-row items-center gap-2 overflow-hidden shadow-sm">
        <div className="flex bg-muted/30 p-1 rounded-2xl w-full sm:w-auto">
          {[
            { id: 'one-time', label: 'One-Time' },
            { id: 'ongoing', label: 'Ongoing' },
            { id: 'api', label: 'API' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === tab.id
                  ? 'bg-background text-primary shadow-sm shadow-black/5 ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/10'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search by name or template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 h-11 bg-transparent border-none focus-visible:ring-0 shadow-none font-medium placeholder:font-normal"
          />
        </div>

        <div className="hidden sm:flex items-center gap-1 border-l border-border/50 px-2 ml-1">
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setActiveTab('one-time'); }} className="rounded-xl text-[10px] font-black uppercase tracking-widest h-9 text-muted-foreground hover:text-foreground">
            <Filter className="mr-2 h-3.5 w-3.5" /> Reset Filters
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-card border border-border/50 rounded-3xl shadow-premium-sm overflow-hidden">
        {filteredCampaigns.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Details</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest text-center">Engagement</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Progress</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                <AnimatePresence mode="popLayout">
                  {filteredCampaigns.map((c) => {
                    const status = getStatusConfig(c.status);
                    const statusKey = (c.status || '').toLowerCase();
                    const sentPercentage = c.totalContacts > 0 ? (c.sentCount / c.totalContacts) * 100 : 0;
                    return (
                      <motion.tr
                        key={c._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1">
                            <span
                              className="text-sm font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer flex items-center gap-2"
                              onClick={() => router.push(`/campaign/${c._id}`)}
                            >
                              {c.name}
                              <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-black uppercase tracking-tighter bg-emerald-500/5 text-emerald-600 border-emerald-500/20">WhatsApp</Badge>
                              <span className="text-[11px] text-muted-foreground font-medium">• {c.template?.name || 'Manual Message'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center justify-center gap-4">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-black text-blue-600">{c.deliveredCount}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">Delivered</span>
                            </div>
                            <div className="h-6 w-[1px] bg-border/40" />
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-black text-emerald-600">{c.readCount}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">Read</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="w-32 flex flex-col gap-1.5">
                            <div className="flex justify-between items-end">
                              <span className="text-[10px] font-bold text-foreground">{Math.round(sentPercentage)}%</span>
                              <span className="text-[9px] font-medium text-muted-foreground">{c.sentCount}/{c.totalContacts}</span>
                            </div>
                            <Progress value={sentPercentage} className="h-1.5" />
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <Badge className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest border border-transparent shadow-sm ${status.color}`}>
                              {status.pulse && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
                              {c.status}
                            </Badge>
                          </div>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                              onClick={() => router.push(`/campaign/${c._id}`)}
                              aria-label={`View campaign ${c.name}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger aria-label={`Open actions for campaign ${c.name}`} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors outline-none cursor-pointer">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 shadow-premium border-border/50">
                                {statusKey === 'draft' && (
                                  <DropdownMenuItem
                                    className="rounded-xl h-10 font-bold text-blue-600 focus:text-blue-600 focus:bg-blue-500/10 cursor-pointer"
                                    onClick={() => actionMutation.mutate({ id: c._id, action: 'start' })}
                                  >
                                    <Play className="h-4 w-4 mr-3" /> Start Now
                                  </DropdownMenuItem>
                                )}
                                {['sending', 'queued', 'running'].includes(statusKey) && (
                                  <DropdownMenuItem
                                    className="rounded-xl h-10 font-bold text-amber-600 focus:text-amber-600 focus:bg-amber-500/10 cursor-pointer"
                                    onClick={() => actionMutation.mutate({ id: c._id, action: 'pause' })}
                                  >
                                    <Pause className="h-4 w-4 mr-3" /> Pause
                                  </DropdownMenuItem>
                                )}
                                {statusKey === 'paused' && (
                                  <DropdownMenuItem
                                    className="rounded-xl h-10 font-bold text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10 cursor-pointer"
                                    onClick={() => actionMutation.mutate({ id: c._id, action: 'resume' })}
                                  >
                                    <Play className="h-4 w-4 mr-3" /> Resume
                                  </DropdownMenuItem>
                                )}
                                {statusKey === 'completed' && (
                                  <DropdownMenuItem
                                    className="rounded-xl h-10 font-bold text-primary focus:text-primary focus:bg-primary/10 cursor-pointer"
                                    onClick={() => router.push(`/campaign/${c._id}`)} // Or retarget trigger
                                  >
                                    <Target className="h-4 w-4 mr-3" /> Retarget
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="rounded-xl h-10 font-bold text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                  onClick={() => {
                                    if (confirm('Delete this campaign forever?')) {
                                      deleteMutation.mutate(c._id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-3" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-3xl flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 opacity-60">Avg. Delivery</span>
            <p className="text-2xl font-black text-blue-700">{data?.stats?.avgDelivery || 0}%</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 transition-transform group-hover:scale-110">
            <SlidersHorizontal className="h-6 w-6" />
          </div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-3xl flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 opacity-60">Avg. Open Rate</span>
            <p className="text-2xl font-black text-emerald-700">{data?.stats?.avgOpenRate || 0}%</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
        <div className="bg-primary/5 border border-primary/10 p-6 rounded-3xl flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary opacity-60">Total Sent</span>
            <p className="text-2xl font-black text-primary">{(data?.stats?.totalSent || 0).toLocaleString()}</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover:scale-110">
            <User className="h-6 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignsPage;
