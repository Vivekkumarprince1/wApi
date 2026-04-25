"use client";

import React, { useState } from 'react';
import { 
  MessageCircle, 
  Plus, 
  Search, 
  ToggleLeft, 
  ToggleRight, 
  Eye, 
  Pencil, 
  Trash2, 
  Zap, 
  Target, 
  ArrowRight,
  Filter,
  MoreVertical,
  Activity,
  CheckCircle2,
  MessageCircleIcon,
  Hash,
  Gift,
  ChevronDown,
  Clock,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { 
  fetchInstagramQuickflows, 
  toggleInstagramQuickflow, 
  deleteInstagramQuickflow, 
  createInstagramQuickflow 
} from '@/lib/api/automation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import FlashLoader from '@/components/ui/flash-loader';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const PRESET_TEMPLATES = [
  {
    id: 'price_please',
    name: 'Price Please',
    description: 'Respond to price inquiries automatically',
    icon: '💰',
    keywords: ['price', 'cost', 'how much', '$'],
    triggerType: 'comment',
    color: 'bg-blue-500/10 text-blue-500'
  },
  {
    id: 'giveaway',
    name: 'Giveaway',
    description: 'Auto-reply to giveaway entries',
    icon: '🎁',
    keywords: ['giveaway', 'contest', 'free'],
    triggerType: 'comment',
    color: 'bg-purple-500/10 text-purple-500'
  },
  {
    id: 'lead_gen',
    name: 'Lead Generation',
    description: 'Capture leads and redirect to WhatsApp',
    icon: '📋',
    keywords: ['info', 'interested', 'tell me'],
    triggerType: 'dm',
    color: 'bg-emerald-500/10 text-emerald-500'
  },
  {
    id: 'story_auto_reply',
    name: 'Story Auto Reply',
    description: 'Reply to story mentions and replies',
    icon: '📖',
    keywords: [],
    triggerType: 'story_reply',
    color: 'bg-pink-500/10 text-pink-500'
  }
];

export default function InstagramQuickflowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: quickflows, isLoading } = useQuery({
    queryKey: ['instagram-quickflows'],
    queryFn: () => fetchInstagramQuickflows()
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleInstagramQuickflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-quickflows'] });
      toast.success('QuickFlow status updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update QuickFlow')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInstagramQuickflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-quickflows'] });
      toast.success('QuickFlow removed');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete QuickFlow')
  });

  const flows: any[] = quickflows?.data?.data || [];
  const filteredFlows = flows.filter((qf: any) => 
    qf.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageCircle className="h-4 w-4" />;
      case 'dm': return <MessageCircleIcon className="h-4 w-4" />; // Fixed icon name
      case 'story_reply': return <Activity className="h-4 w-4" />;
      case 'mention': return <Gift className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  const stats = {
    total: flows.length,
    active: flows.filter((f: any) => f.enabled).length,
    triggered: flows.reduce((acc: number, f: any) => acc + (f.totalTriggered || 0), 0)
  };

  if (isLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-4">
            Instagram QuickFlows
            <Badge variant="secondary" className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-pink-500/5 text-pink-500 border-pink-500/10">
               {stats.active} Live Flows
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Auto-reply to Instagram comments, DMs, and story mentions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
             className="rounded-2xl h-12 px-6 font-black shadow-lg shadow-pink-500/20 bg-gradient-to-r from-pink-500 to-rose-500 group border-none text-white"
             onClick={() => setShowPresetModal(true)}
          >
            <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" /> Create QuickFlow
          </Button>
        </div>
      </div>

      {/* Stats Cluster */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Instagram Flows", value: stats.total, icon: MessageCircle, color: "text-pink-500" },
            { label: "Active Status", value: stats.active, icon: Activity, color: "text-emerald-500" },
            { label: "System Triggers", value: stats.triggered, icon: Zap, color: "text-amber-500" },
          ].map((stat) => (
            <div 
              key={stat.label}
              className="bg-card border border-border/50 p-6 rounded-[32px] shadow-sm flex items-center gap-6 group hover:border-pink-500/20 transition-all"
            >
                <div className={cn("p-4 rounded-2xl bg-muted/50 transition-transform group-hover:scale-110", stat.color)}>
                    <stat.icon className="h-6 w-6" />
                </div>
                <div>
                   <p className="text-2xl font-black tracking-tight text-foreground">{stat.value}</p>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{stat.label}</p>
                </div>
            </div>
          ))}
      </div>

      {/* Filter Bar */}
      <div className="max-w-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
            <Input 
              placeholder="Search by name or keyword..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-14 w-full pl-12 rounded-3xl bg-card border-border/50 focus:ring-pink-500/20 transition-all font-medium text-lg shadow-sm"
            />
          </div>
      </div>

      {/* QuickFlows List */}
      <div className="grid grid-cols-1 gap-5">
        <AnimatePresence mode="popLayout">
          {filteredFlows.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-[48px] border-2 border-dashed border-border/50 py-32 text-center"
            >
              <div className="w-24 h-24 bg-pink-500/5 rounded-full flex items-center justify-center mx-auto mb-8 text-pink-500">
                 <Camera className="h-12 w-12" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-foreground mb-3">No Instagram flows active</h3>
              <p className="text-muted-foreground max-w-sm mx-auto font-medium text-sm px-6">
                Start by using a preset template to automate your Instagram engagement.
              </p>
              <Button 
                className="mt-10 rounded-2xl h-14 px-10 bg-pink-500 text-white font-black hover:bg-pink-600 transition-all shadow-xl shadow-pink-500/20"
                onClick={() => setShowPresetModal(true)}
              >
                + Choose from Presets
              </Button>
            </motion.div>
          ) : (
            filteredFlows.map((qf: any, i: number) => (
              <motion.div 
                key={qf._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "group bg-card border border-border/50 rounded-[40px] shadow-sm hover:shadow-premium hover:border-pink-500/30 transition-all flex flex-col relative overflow-hidden",
                  expandedId === qf._id && "ring-1 ring-pink-500/20"
                )}
              >
                 <div className="p-2 flex items-center gap-8 pr-10">
                    {/* Icon */}
                    <div className={cn(
                      "w-20 h-20 rounded-[32px] flex items-center justify-center text-3xl shadow-inner transition-transform group-hover:scale-95",
                      qf.enabled ? 'bg-pink-50 text-pink-500' : 'bg-muted text-muted-foreground grayscale opacity-50'
                    )}>
                      {PRESET_TEMPLATES.find(p => p.id === qf.presetName)?.icon || '🤖'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 py-4 cursor-pointer" onClick={() => setExpandedId(expandedId === qf._id ? null : qf._id)}>
                        <div className="flex items-center gap-3 mb-1.5">
                           <h3 className="text-xl font-black tracking-tight text-foreground group-hover:text-pink-500 transition-colors">{qf.name}</h3>
                           <Badge className={cn(
                              "rounded-xl h-6 px-3 text-[9px] font-black uppercase tracking-widest",
                              qf.enabled ? 'bg-pink-500 text-white border-none' : 'bg-muted text-muted-foreground'
                           )}>
                              {qf.enabled ? 'Active' : 'Paused'}
                           </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                           <p className="text-sm font-bold text-muted-foreground/60 flex items-center gap-2">
                             {getTriggerIcon(qf.triggerType)} {qf.triggerType.replace('_', ' ')}
                           </p>
                           <span className="h-1 w-1 rounded-full bg-border" />
                           <p className="text-sm font-bold text-pink-500/80">
                             {qf.totalTriggered || 0} Triggers
                           </p>
                        </div>
                    </div>

                    {/* Meta Stats */}
                    <div className="hidden lg:flex items-center gap-12 px-10 border-x border-border/10">
                        <div className="space-y-1">
                           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">Efficiency</p>
                           <div className="flex items-center gap-3">
                              <span className="text-xl font-black text-foreground tabular-nums">
                                {qf.totalTriggered ? Math.round((qf.totalRepliesSent / qf.totalTriggered) * 100) : 0}%
                              </span>
                           </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-3">
                        <button 
                          onClick={() => toggleMutation.mutate(qf._id)}
                          className={cn(
                            "h-14 w-14 rounded-full flex items-center justify-center transition-all shadow-sm",
                            qf.enabled ? 'bg-pink-500 text-white shadow-pink-500/20' : 'bg-muted text-muted-foreground'
                          )}
                        >
                           {qf.enabled ? <ToggleLeft className="h-7 w-7" /> : <ToggleRight className="h-7 w-7" />}
                        </button>
                        
                        <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-14 w-14 rounded-full text-muted-foreground hover:bg-muted transition-all">
                                 <MoreVertical className="h-6 w-6" />
                              </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end" className="rounded-[24px] p-2 border-border/50 shadow-2xl min-w-[200px]">
                              <DropdownMenuItem className="rounded-xl h-12 px-4 font-bold text-sm gap-3">
                                 <Pencil className="h-4 w-4" /> Edit QuickFlow
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-xl h-12 px-4 font-bold text-sm gap-3">
                                 <Activity className="h-4 w-4" /> View Analytics
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  if (confirm('Delete this Instagram flow?')) {
                                    deleteMutation.mutate(qf._id);
                                  }
                                }}
                                className="rounded-xl h-12 px-4 font-bold text-sm gap-3 text-red-500 focus:text-red-600 focus:bg-red-50"
                              >
                                 <Trash2 className="h-4 w-4" /> Delete Permanently
                              </DropdownMenuItem>
                           </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                 </div>

                 {/* Expanded Content */}
                 <AnimatePresence>
                    {expandedId === qf._id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border/50 bg-muted/20"
                      >
                         <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                               <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">Target Keywords</p>
                                  <div className="flex flex-wrap gap-2">
                                     {qf.keywords?.map((k: string) => (
                                       <Badge key={k} variant="secondary" className="rounded-lg bg-card border-border/50 font-bold px-3 py-1 text-xs">#{k}</Badge>
                                     )) || <span className="text-sm italic opacity-40 font-medium">Any {qf.triggerType}</span>}
                                  </div>
                               </div>
                               <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">Automated Response</p>
                                  <div className="bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
                                     <p className="text-sm font-medium leading-relaxed italic">"{qf.response?.message || qf.response?.template || 'No message configured'}"</p>
                                  </div>
                               </div>
                            </div>
                            <div className="space-y-6">
                               <div className="bg-gradient-to-br from-indigo-500/5 to-pink-500/5 p-6 rounded-[32px] border border-pink-500/10 h-full">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-6">Execution Summary</p>
                                  <div className="grid grid-cols-2 gap-8">
                                     <div className="space-y-1">
                                        <p className="text-xs font-bold text-muted-foreground opacity-60">Success Rate</p>
                                        <p className="text-3xl font-black text-pink-500">{qf.totalTriggered ? Math.round((qf.totalRepliesSent / qf.totalTriggered) * 100) : 0}%</p>
                                     </div>
                                     <div className="space-y-1">
                                        <p className="text-xs font-bold text-muted-foreground opacity-60">Last Active</p>
                                        <div className="flex items-center gap-2 text-foreground font-black">
                                           <Clock className="h-4 w-4" /> 
                                           <span>{qf.lastTriggeredAt ? new Date(qf.lastTriggeredAt).toLocaleDateString() : 'Inactive'}</span>
                                        </div>
                                     </div>
                                  </div>
                                  <Button className="w-full mt-10 rounded-2xl bg-foreground text-background font-black hover:opacity-90 transition-opacity">
                                    Browse Execution Logs <ArrowRight className="h-4 w-4 ml-2" />
                                  </Button>
                               </div>
                            </div>
                         </div>
                      </motion.div>
                    )}
                 </AnimatePresence>

                 {/* Backdrop Accent */}
                 <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-pink-500 to-rose-500" />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Preset Modal */}
      <AnimatePresence>
        {showPresetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl"
               onClick={() => setShowPresetModal(false)}
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 30 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 30 }}
               className="relative bg-card w-full max-w-4xl rounded-[50px] shadow-2xl border border-white/10 overflow-hidden"
             >
                <div className="p-10 pb-0">
                   <h2 className="text-4xl font-black tracking-tight mb-2">Power up with Presets</h2>
                   <p className="text-muted-foreground font-medium">Select a battle-tested automation flow to get started instantly.</p>
                </div>

                <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
                    {PRESET_TEMPLATES.map((preset) => (
                      <div 
                        key={preset.id}
                        onClick={() => router.push(`/dashboard/automation/instagram-quickflows/create?preset=${preset.id}`)}
                        className="group bg-muted/30 border border-border/50 rounded-[40px] p-8 hover:border-pink-500/30 hover:bg-card transition-all cursor-pointer relative overflow-hidden"
                      >
                         <div className="flex items-start gap-6 relative z-10">
                            <div className={cn("w-16 h-16 rounded-[24px] flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform", preset.color)}>
                               {preset.icon}
                            </div>
                            <div className="flex-1">
                               <h3 className="text-xl font-black mb-1 group-hover:text-pink-500 transition-colors">{preset.name}</h3>
                               <p className="text-sm font-medium text-muted-foreground/70 leading-relaxed mb-4">{preset.description}</p>
                               <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                                  {getTriggerIcon(preset.triggerType)}
                                  <span>{preset.triggerType.replace('_', ' ')}</span>
                               </div>
                            </div>
                         </div>
                         <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                    <div 
                        onClick={() => router.push('/dashboard/automation/instagram-quickflows/create')}
                        className="bg-slate-900 rounded-[40px] p-8 flex flex-col items-center justify-center text-center group hover:bg-slate-800 transition-all cursor-pointer border border-white/5"
                    >
                       <Plus className="h-12 w-12 text-white/20 mb-4 group-hover:scale-110 group-hover:text-pink-500 transition-all" />
                       <h3 className="text-xl font-black text-white mb-1">Custom Builder</h3>
                       <p className="text-sm font-medium text-white/40 leading-relaxed">Design your own logic from scratch</p>
                    </div>
                </div>

                <div className="p-10 bg-muted/20 border-t border-border/50 flex justify-end gap-4">
                   <Button variant="ghost" className="rounded-2xl h-12 px-8 font-black" onClick={() => setShowPresetModal(false)}>Close</Button>
                   <Button className="rounded-2xl h-12 px-8 font-black bg-pink-500 text-white hover:bg-pink-600 transition-all">Start Designing</Button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
