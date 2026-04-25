"use client";

import React, { useState } from 'react';
import { 
  Workflow, 
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
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { fetchRules, toggleRule, deleteRule, AutomationRule } from '@/lib/api/automation';
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

export default function WorkflowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTrigger, setFilterTrigger] = useState('all');

  const runWorkflowTest = async (ruleId: string) => {
    const conversationId = window.prompt('Enter conversation ID for test (optional):', '')?.trim() || '';
    const contactId = window.prompt('Enter contact ID for test (optional):', '')?.trim() || '';

    if (!conversationId && !contactId) {
      toast.error('Provide at least one ID (conversation or contact) to run a test.');
      return;
    }

    const messageBody = window.prompt('Test message body (optional):', 'Manual workflow test')?.trim() || 'Manual workflow test';

    try {
      const response = await fetch(`/api/automation/engine/rules/${ruleId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          contactId: contactId || undefined,
          messageBody
        })
      });

      const raw = await response.text();
      const json = raw ? JSON.parse(raw) : null;

      if (!response.ok || !json?.success) {
        throw new Error(json?.error || `Failed to test workflow (${response.status})`);
      }

      toast.success('Workflow test executed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Workflow test failed');
    }
  };

  const triggerOptions = [
    { value: 'all', label: 'All Triggers' },
    { value: 'customer.message.received', label: 'Incoming Message' },
    { value: 'message_received', label: 'Message Received (Legacy)' },
    { value: 'form_submitted', label: 'Form Submitted' },
    { value: 'keyword', label: 'Keyword Match' },
    { value: 'tag_added', label: 'Tag Added' }
  ];

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['automation-rules', 'workflow'],
    queryFn: () => fetchRules('workflow')
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleRule(id, enabled),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['automation-rules', 'workflow'] });

      const previous = queryClient.getQueryData(['automation-rules', 'workflow']);

      queryClient.setQueryData(['automation-rules', 'workflow'], (old: any) => {
        if (!old?.data?.rules) return old;
        return {
          ...old,
          data: {
            ...old.data,
            rules: old.data.rules.map((rule: any) =>
              rule._id === id ? { ...rule, enabled } : rule
            )
          }
        };
      });

      return { previous };
    },
    onError: (_error: any, _vars: any, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(['automation-rules', 'workflow'], context.previous);
      }
      toast.error('Failed to update workflow');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Workflow status updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Workflow deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete workflow')
  });

  const rules = rulesData?.data?.rules || [];
  const filteredWorkflows = rules.filter((wf: AutomationRule) => {
    const matchesSearch = wf.name.toLowerCase().includes(searchQuery.toLowerCase());
    const triggerType = wf.trigger?.event || wf.trigger?.type || 'message_received';
    const matchesTrigger = filterTrigger === 'all' || triggerType === filterTrigger;
    return matchesSearch && matchesTrigger;
  });

  const stats = {
    total: rules.length,
    active: rules.filter((r: any) => r.enabled).length,
    executions: rules.reduce((acc: number, r: any) => acc + (r.stats?.totalExecutions || 0), 0),
    avgSuccess: "98.2%"
  };

  const getTriggerLabel = (type: string) => {
    const labels: Record<string, string> = {
      'message_received': 'Message Received',
      'keyword': 'Keyword Match',
      'tag_added': 'Tag Added',
      'customer.message.received': 'External Event'
    };
    return labels[type] || type;
  };

  if (isLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-4">
            Visual Workflows
            <Badge variant="secondary" className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-primary/5 text-primary border-primary/10">
               {stats.active} Active Flows
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Build complex automated customer journeys and branching logic.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
             className="rounded-2xl h-12 px-6 font-black shadow-lg shadow-primary/20 bg-primary group"
              onClick={() => router.push('/dashboard/automation/workflows/builder/create')}
          >
            <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" /> Design New Workflow
          </Button>
        </div>
      </div>

      {/* Mini Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Flows", value: stats.total, icon: Workflow, color: "text-blue-500" },
            { label: "Active Now", value: stats.active, icon: Activity, color: "text-emerald-500" },
            { label: "Total Runs", value: stats.executions, icon: Zap, color: "text-amber-500" },
            { label: "Success Rate", value: stats.avgSuccess, icon: CheckCircle2, color: "text-indigo-500" },
          ].map((stat, i) => (
            <div 
              key={stat.label}
              className="bg-card border border-border/50 p-5 rounded-3xl shadow-sm flex items-center gap-5 group hover:border-primary/20 transition-all"
            >
                <div className={`p-3 rounded-2xl bg-muted/50 ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-2xl font-black tracking-tight text-foreground">{stat.value}</p>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{stat.label}</p>
                </div>
            </div>
          ))}
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
          <Input 
            placeholder="Search workflows by name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 w-full pl-12 rounded-2xl bg-card border-border/50 focus:ring-primary/20 transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="h-12 rounded-2xl border border-border/50 bg-card px-3 flex items-center gap-2 w-full md:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterTrigger}
              onChange={(e) => setFilterTrigger(e.target.value)}
              className="bg-transparent text-sm font-bold outline-none min-w-[180px]"
            >
              {triggerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {filterTrigger !== 'all' && (
            <Button
              variant="outline"
              className="h-12 rounded-2xl border-border/50 bg-card hover:bg-muted font-bold"
              onClick={() => setFilterTrigger('all')}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Workflows List */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredWorkflows.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-[40px] border-2 border-dashed border-border/50 py-32 text-center"
            >
              <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse text-muted-foreground">
                 <Workflow className="h-12 w-12" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-foreground mb-3">No workflows found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto font-medium text-sm px-6">
                Start by designing your first automated journey to save time and delight your customers.
              </p>
              <Button 
                variant="outline" 
                className="mt-10 rounded-2xl h-14 px-10 border-primary text-primary font-black hover:bg-primary hover:text-white transition-all shadow-xl shadow-primary/10"
              onClick={() => router.push('/dashboard/automation/workflows/builder/create')}
              >
                + Design Your First Flow
              </Button>
            </motion.div>
          ) : (
            filteredWorkflows.map((wf: AutomationRule, i: number) => (
              (() => {
                const isEnabled = Boolean((wf as any).enabled);
                return (
              <motion.div 
                key={wf._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group bg-card border border-border/50 rounded-[32px] p-2 pr-8 shadow-sm hover:shadow-premium hover:border-primary/30 transition-all flex items-center gap-8 relative overflow-hidden"
              >
                 {/* Visual ID/Icon */}
                 <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center text-xl shadow-inner transition-transform group-hover:scale-95 ${
                   isEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground opacity-50'
                 }`}>
                   <Workflow className="h-8 w-8" />
                 </div>

                 {/* Content */}
                 <div className="flex-1 py-4">
                    <div className="flex items-center gap-3 mb-1.5">
                       <h3 className="text-lg font-black tracking-tight text-foreground group-hover:text-primary transition-colors">{wf.name}</h3>
                       <Badge className={`rounded-xl h-6 px-3 text-[9px] font-black uppercase tracking-widest ${
                         isEnabled ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-muted text-muted-foreground'
                       }`}>
                          {isEnabled ? 'Active' : 'Paused'}
                       </Badge>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground line-clamp-1 opacity-70">
                       {getTriggerLabel(wf.trigger?.event || wf.trigger?.type || 'message_received')} • Last executed <span className="text-foreground">{wf.stats?.lastExecutedAt ? new Date(wf.stats.lastExecutedAt).toLocaleDateString() : 'Never'}</span>
                    </p>
                 </div>

                 {/* Performance Section */}
                 <div className="hidden lg:grid grid-cols-2 gap-12 px-8 border-x border-border/10">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Total Runs</p>
                       <p className="text-sm font-black text-foreground tabular-nums">{wf.stats?.totalExecutions || 0}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Efficiency</p>
                       <div className="flex items-center gap-3">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                             <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }} />
                          </div>
                          <span className="text-xs font-black text-emerald-500">92%</span>
                       </div>
                    </div>
                 </div>

                 {/* Action Panel */}
                 <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      onClick={() => toggleMutation.mutate({ id: wf._id, enabled: !isEnabled })}
                      disabled={toggleMutation.isPending}
                      className={`h-12 w-12 rounded-2xl transition-colors ${
                        isEnabled ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-200/50'
                      }`}
                      title={isEnabled ? "Pause Flow" : "Activate Flow"}
                    >
                      {isEnabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                    </Button>
                    
                    <Link href={`/dashboard/automation/workflows/builder/${wf._id}`}>
                      <Button variant="ghost" className="h-12 w-12 rounded-2xl text-primary hover:bg-primary/10" title="Open Builder">
                         <Pencil className="h-5 w-5" />
                      </Button>
                    </Link>

                    <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-12 w-12 rounded-2xl text-muted-foreground hover:bg-muted transition-all">
                             <MoreVertical className="h-5 w-5" />
                          </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="rounded-2xl p-2 border-border/50 shadow-xl min-w-[160px]">
                      <DropdownMenuItem onClick={() => router.push(`/dashboard/automation/workflows/${wf._id}/view`)} className="rounded-xl h-10 px-4 font-bold text-xs gap-3">
                             <Eye className="h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => runWorkflowTest(wf._id)} className="rounded-xl h-10 px-4 font-bold text-xs gap-3">
                             <Target className="h-4 w-4" /> Test Flow
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              if (confirm('Delete this workflow? This action cannot be undone.')) {
                                deleteMutation.mutate(wf._id);
                              }
                            }}
                            className="rounded-xl h-10 px-4 font-bold text-xs gap-3 text-red-500 focus:text-red-600 focus:bg-red-50"
                          >
                             <Trash2 className="h-4 w-4" /> Delete Flow
                          </DropdownMenuItem>
                       </DropdownMenuContent>
                    </DropdownMenu>
                 </div>

                 {/* Subtle Gradient Backglow */}
                 <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </motion.div>
                );
              })()
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Pro Help Banner */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
        className="bg-slate-900 rounded-[40px] p-10 border border-white/5 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8"
      >
         <div className="space-y-3 relative z-10 text-center md:text-left">
            <h3 className="text-2xl font-black tracking-tight">Need a custom bot journey?</h3>
            <p className="text-sm text-white/50 font-medium">Use our <span className="text-white font-black underline decoration-primary underline-offset-4 pointer-events-none">AI Prompt to Flow</span> engine to generate complex logic in seconds.</p>
         </div>
         <Button className="h-14 px-10 rounded-2xl bg-white text-slate-900 font-black hover:bg-white/90 transition-all shadow-xl shadow-white/5 group relative z-10">
            Open AI Builder <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
         </Button>

         {/* Backdrop FX */}
         <div className="absolute -bottom-20 -left-20 h-64 w-64 bg-primary/20 rounded-full blur-[100px]" />
         <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-[80px]" />
      </motion.div>
    </div>
  );
}
