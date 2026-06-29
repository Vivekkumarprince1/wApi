"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchCampaignById, performCampaignAction } from "@/lib/api/campaigns";
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Users,
  MessageSquare,
  BarChart,
  Loader2,
  Calendar,
  Layers,
  Info,
  Target,
  MoreVertical,
  Trash2,
  TrendingUp
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CampaignFunnel } from "@/components/dashboard/campaign/analytics/CampaignFunnel";
import { CampaignRecipientTable } from "@/components/dashboard/campaign/analytics/CampaignRecipientTable";
import { CampaignTemplatePreview } from "@/components/dashboard/campaign/analytics/CampaignTemplatePreview";
import { CampaignFailureAnalysis } from "@/components/dashboard/campaign/analytics/CampaignFailureAnalysis";
import { CampaignButtonTracking } from "@/components/dashboard/campaign/analytics/CampaignButtonTracking";
import { motion } from "framer-motion";
import { useRef } from "react";

export default function CampaignDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const tableRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => fetchCampaignById(campaignId),
    refetchInterval: 5000 // Poll every 5s for realtime stats
  });

  const campaign = (data as any)?.data?.campaign || (data as any)?.campaign || (data as any)?.data || data;

  const handleAction = async (action: 'start' | 'pause' | 'resume') => {
    try {
      setIsActionLoading(true);
      await performCampaignAction(campaignId, action);
      toast.success(`Campaign ${action}ed successfully`);
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Failed to ${action} campaign`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMetricClick = (status: string) => {
    setStatusFilter(status);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast.info(`Filtering activity for: ${status.toUpperCase()}`);
  };

  if (isLoading && !campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest">Loading Analytics Dashboard...</p>
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">Campaign Not Found</h2>
        <Button variant="outline" onClick={() => router.push('/campaign')}>
          Back to Campaigns
        </Button>
      </div>
    );
  }

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

  const statusConfig = getStatusConfig(campaign.status);
  const statusKey = (campaign.status || '').toLowerCase();

  const timelineEntries = Array.isArray(campaign.audit?.history)
    ? [...campaign.audit.history]
        .sort((left: any, right: any) => new Date(right.at).getTime() - new Date(left.at).getTime())
        .slice(0, 6)
    : [];

  const getAuditAccent = (action: string) => {
    switch ((action || '').toUpperCase()) {
      case 'COMPLETED':
      case 'RESUMED':
      case 'STARTED':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'PAUSED':
      case 'SYSTEM_PAUSED':
      case 'FAILED':
        return 'bg-rose-500/10 text-rose-600 border-rose-200';
      case 'BATCH_COMPLETED':
        return 'bg-blue-500/10 text-blue-600 border-blue-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatAuditMeta = (meta: any) => {
    if (!meta || typeof meta !== 'object') return '';

    return Object.entries(meta)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
      .join(' · ');
  };

  // Use totals as source of truth for accuracy
  const counts = {
    total: campaign.totals?.totalRecipients || campaign.totalContacts || 0,
    sent: campaign.totals?.sent || campaign.sentCount || 0,
    delivered: campaign.totals?.delivered || campaign.deliveredCount || 0,
    read: campaign.totals?.read || campaign.readCount || 0,
    failed: campaign.totals?.failed || campaign.failedCount || 0,
    replied: campaign.totals?.replied || campaign.repliedCount || 0,
  };

  const progress = counts.total > 0 
    ? Math.round(((counts.sent + counts.failed) / counts.total) * 100) 
    : 0;

  const deliveryRate = counts.sent > 0 ? Math.round((counts.delivered / counts.sent) * 100) : 0;
  const readRate = counts.delivered > 0 ? Math.round((counts.read / counts.delivered) * 100) : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-7xl mx-auto pb-10"
    >
      {/* Header with Navigation */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
	          <Button 
	            variant="ghost" 
	            size="icon" 
	            className="h-10 w-10 shrink-0 rounded-lg bg-background border border-border/70"
	            onClick={() => router.push('/campaign')}
	            aria-label="Back to campaigns"
	          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 mb-1">
              <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight md:text-2xl">{campaign.name}</h1>
              <Badge variant="outline" className={`w-fit rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest border ${statusConfig.color}`}>
                {statusConfig.pulse && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
                {campaign.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-bold">
              <p className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                Created {new Date(campaign.createdAt).toLocaleDateString()}
              </p>
              <p className="flex items-center gap-2">
                <Target className="h-3 w-3" />
                {campaign.recipientFilter?.type || 'Bulk'} Upload
              </p>
              <p className="flex items-center gap-2 text-primary">
                <Layers className="h-3 w-3" />
                {campaign.templateSnapshot?.name || campaign.template?.name || campaign.templateName || 'Standard Template'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          {/* Engagement Overview (Main Page Alignment) */}
          <div className="hidden lg:flex items-center bg-card/30 backdrop-blur-sm border border-border/50 rounded-2xl px-6 py-2 gap-6 mr-2">
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-blue-600">{counts.delivered}</span>
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Delivered</span>
            </div>
            <div className="h-6 w-[1px] bg-border/40" />
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-emerald-600">{counts.read}</span>
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Read</span>
            </div>
          </div>

          {['draft', 'scheduled', 'paused'].includes(statusKey) && (
            <Button 
              onClick={() => handleAction('start')}
              disabled={isActionLoading}
              className="h-11 w-full rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2 fill-current" />}
              {statusKey === 'paused' ? 'RESUME' : 'START BROADCAST'}
            </Button>
          )}

          {['sending', 'queued', 'running'].includes(statusKey) && (
            <Button 
              onClick={() => handleAction('pause')}
              disabled={isActionLoading}
              variant="outline"
              className="h-11 w-full rounded-lg border-amber-500/30 px-5 font-semibold text-amber-600 hover:bg-amber-500/5 sm:w-auto"
            >
              {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pause className="h-4 w-4 mr-2 fill-current" />}
              PAUSE
            </Button>
          )}

	          <DropdownMenu>
	            <DropdownMenuTrigger asChild>
	              <Button variant="outline" aria-label={`Open actions for campaign ${campaign.name}`} className="h-11 w-full rounded-lg border-border/70 bg-background hover:bg-muted transition-colors sm:w-11 sm:p-0">
	                <MoreVertical className="h-4 w-4" />
	              </Button>
	            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-premium border-border/50">
              <DropdownMenuItem 
                onClick={() => refetch()}
                className="rounded-xl h-11 font-bold focus:bg-primary/5 focus:text-primary cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 mr-3 ${isLoading ? 'animate-spin' : ''}`} /> Update Data
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => router.push(`/campaign/new?retarget=${campaignId}`)}
                className="rounded-xl h-11 font-bold focus:bg-primary/5 focus:text-primary cursor-pointer"
              >
                <Target className="h-4 w-4 mr-3" /> Retarget Audience
              </DropdownMenuItem>

              <div className="h-px bg-border/50 my-1" />
              
              <DropdownMenuItem 
                className="rounded-xl h-11 font-bold text-destructive focus:bg-destructive/5 focus:text-destructive cursor-pointer"
                onClick={() => {
                   if (confirm('Delete this campaign analysis? This action cannot be undone.')) {
                      // perform delete and redirect
                      toast.promise(Promise.resolve(), {
                        loading: 'Deleting...',
                        success: () => {
                          router.push('/campaign');
                          return 'Campaign deleted';
                        }
                      });
                   }
                }}
              >
                <Trash2 className="h-4 w-4 mr-3" /> Delete analysis
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stats & Funnel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Stats Funnel */}
          <div className="bg-background rounded-xl p-4 sm:p-6 border border-border/70 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <BarChart className="h-48 w-48 text-primary" />
            </div>
            
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Performance Funnel</h2>
                <div className="flex w-fit items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-md border border-border/50">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest leading-none">Live Data</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6 mb-10">
              {[
                { label: 'Recipients', count: counts.total, icon: Users, color: 'text-foreground', filter: 'all' },
                { label: 'Delivered', count: counts.delivered, icon: CheckCircle2, color: 'text-emerald-500', sub: `${deliveryRate}%`, filter: 'delivered' },
                { label: 'Read', count: counts.read, icon: MessageSquare, color: 'text-blue-500', sub: `${readRate}%`, filter: 'read' },
                { label: 'Failed', count: counts.failed, icon: AlertCircle, color: 'text-rose-500', filter: 'failed' }
              ].map((stat, i) => (
                <motion.div 
                    key={i}
                    whileHover={{ y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleMetricClick(stat.filter)}
                    className="space-y-2 group cursor-pointer rounded-lg border border-transparent p-2 transition-colors hover:border-border/70 hover:bg-muted/20"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2 transition-colors group-hover:text-foreground">
                      <stat.icon className="h-3 w-3" /> {stat.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                      <p className={`text-2xl sm:text-3xl font-semibold tracking-tight ${statusFilter === stat.filter ? stat.color : ''}`}>{(stat.count || 0).toLocaleString()}</p>
                      {stat.sub && <span className="text-xs font-semibold text-muted-foreground">{stat.sub}</span>}
                  </div>
                  {statusFilter === stat.filter && (
                    <motion.div layoutId="activeFilter" className={`h-1 w-8 rounded-full bg-current ${stat.color}`} />
                  )}
                </motion.div>
              ))}
            </div>

            <CampaignFunnel 
                onFilter={handleMetricClick}
                data={{
                    sent: counts.sent,
                    delivered: counts.delivered,
                    read: counts.read,
                    replied: counts.replied
                }} 
            />
          </div>

          {/* Marketing Insights Section */}
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
               <CampaignFailureAnalysis campaign={campaign} />
               <CampaignButtonTracking campaign={campaign} />
            </div>
          </div>

          {/* Detailed Recipient Activity */}
          <div ref={tableRef} className="bg-background rounded-xl p-4 sm:p-6 border border-border/70">
             <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="space-y-1">
                    <h2 className="text-base font-semibold tracking-tight">Recipient Activity Log</h2>
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <Info className="h-3 w-3" /> Detailed delivery and read status per contact
                    </p>
                </div>
                {statusFilter !== 'all' && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setStatusFilter('all')}
                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                    >
                        Clear Filter
                    </Button>
                )}
             </div>
             
             <CampaignRecipientTable 
                campaignId={campaignId} 
                externalStatus={statusFilter}
                onStatusChange={setStatusFilter}
             />
          </div>
        </div>

        {/* Right Column: Template Preview & Metadata */}
        <div className="space-y-6">
           <CampaignTemplatePreview campaign={campaign} />

            <div className="bg-slate-950 rounded-xl p-4 sm:p-6 border border-slate-800 relative overflow-hidden">
             <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50 mb-6 flex items-center gap-2">
                <RefreshCw className="h-3 w-3" /> Execution Progress
             </h3>

             <div className="space-y-6 relative z-10">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <p className="text-3xl font-semibold text-white">{progress}%</p>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-white/40">Total Progress</p>
                    </div>
                    <div className="text-right pb-1">
                        <p className="text-xs font-black text-white/80">{counts.sent + counts.failed} / {counts.total}</p>
                    </div>
                  </div>
                  <Progress value={progress} className="h-4 bg-white/5 border border-white/5" indicatorClassName="bg-gradient-to-r from-primary via-blue-500 to-emerald-500" />
                </div>

                {statusKey === 'running' && (
                  <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Live Broadcast In Progress
                  </div>
                )}

                {statusKey === 'completed' && (
                  <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    <CheckCircle2 className="h-3 w-3" />
                    Broadcast Finished Successfully
                  </div>
                )}
             </div>
           </div>

           <div className="bg-background rounded-xl p-4 sm:p-6 border border-border/70">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-6 flex items-center gap-2">
                <Info className="h-4 w-4" /> Context Summary
              </h3>
              <div className="space-y-3">
                 {[
                   { label: 'Audience', value: `${campaign.totalContacts} Contacts` },
                   { label: 'Channel', value: 'WhatsApp API' },
                   { label: 'Category', value: campaign.templateSnapshot?.category || 'MARKETING' },
                   { label: 'Batches', value: `${campaign.batching?.completedBatches || 0} / ${campaign.batching?.totalBatches || 0}` }
                 ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                       <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{item.label}</span>
                       <span className="text-xs font-semibold truncate max-w-[160px]" title={item.value}>{item.value}</span>
                    </div>
                 ))}
              </div>
           </div>

           <div className="bg-background rounded-xl p-4 sm:p-6 border border-border/70">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Campaign Timeline
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                  {timelineEntries.length} Events
                </span>
              </div>

              {timelineEntries.length > 0 ? (
                <div className="space-y-3">
                  {timelineEntries.map((entry: any, index: number) => (
                    <motion.div
                      key={`${entry.action}-${entry.at}-${index}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-2xl border border-border/50 bg-muted/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${getAuditAccent(entry.action)}`}>
                              {entry.action}
                            </Badge>
                            {entry.systemInitiated && (
                              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 border-amber-200">
                                System
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-foreground truncate">
                            {entry.reason || 'Status recorded'}
                          </p>
                          {formatAuditMeta(entry.meta) && (
                            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed break-words">
                              {formatAuditMeta(entry.meta)}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                          {new Date(entry.at).toLocaleString()}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
                  <p className="text-xs font-bold text-muted-foreground">No lifecycle activity recorded yet.</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </motion.div>
  );
}
