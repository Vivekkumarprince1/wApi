"use client";

import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Zap, 
  Clock, 
  MessageSquare, 
  BarChart3, 
  ToggleLeft, 
  ToggleRight,
  Reply,
  ArrowRight,
  Trash2,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { 
  createRule,
  fetchRules, 
  updateRule,
  toggleRule, 
  deleteRule, 
  AutomationRule 
} from '@/lib/api/automation';
import { fetchTemplates, Template } from '@/lib/api/templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FlashLoader from '@/components/ui/flash-loader';

export default function AutoRepliesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isGlobalOptionsOpen, setIsGlobalOptionsOpen] = useState(false);
  const [analyticsRule, setAnalyticsRule] = useState<AutomationRule | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all');
  const [filterMatchMode, setFilterMatchMode] = useState<'all' | 'contains' | 'exact' | 'starts_with'>('all');
  const [editingRuleId, setEditingRuleId] = useState<string>('');
  const [newRule, setNewRule] = useState({
    name: '',
    keyword: '',
    replyMessage: '',
    replyType: 'text' as 'text' | 'template',
    templateName: '',
    templateLanguageCode: 'en',
    matchMode: 'contains' as 'contains' | 'exact' | 'starts_with',
    businessHoursOnly: false,
  });

  const [editRule, setEditRule] = useState({
    name: '',
    keyword: '',
    replyMessage: '',
    replyType: 'text' as 'text' | 'template',
    templateName: '',
    templateLanguageCode: 'en',
    matchMode: 'contains' as 'contains' | 'exact' | 'starts_with',
    businessHoursOnly: false,
    enabled: true,
  });

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['auto-replies'],
    queryFn: () => fetchRules('auto_reply')
  });

  const { data: templatesData } = useQuery({
    queryKey: ['approved-templates-for-auto-replies'],
    queryFn: () => fetchTemplates({ status: 'APPROVED', limit: 100 }),
  });

  const rules: AutomationRule[] = rulesData?.data?.rules || [];
  const approvedTemplates: any[] =
    (templatesData as any)?.data?.data ||
    (templatesData as any)?.data ||
    [];

  const buildAction = (payload: {
    replyType: 'text' | 'template';
    replyMessage: string;
    templateName: string;
    templateLanguageCode: string;
  }) => {
    if (payload.replyType === 'template') {
      return {
        type: 'send_template',
        config: {
          templateName: payload.templateName,
          languageCode: payload.templateLanguageCode || 'en',
          components: [],
        },
        order: 0,
        continueOnFailure: true,
      };
    }

    return {
      type: 'send_message',
      config: { body: payload.replyMessage },
      order: 0,
      continueOnFailure: true,
    };
  };
  
  const toggleMutation = useMutation({
    mutationFn: (payload: { id: string, enabled: boolean }) => toggleRule(payload.id, payload.enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-replies'] });
      toast.success('Status updated');
    },
    onError: (err: any) => toast.error(err.message || 'Toggle failed')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-replies'] });
      toast.success('Rule deleted');
    },
    onError: (err: any) => toast.error(err.message || 'Delete failed')
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateRule(editingRuleId, {
        name: editRule.name,
        enabled: editRule.enabled,
        trigger: {
          event: 'customer.message.received',
          filters: {
            keywords: [editRule.keyword],
            keywordMatchMode: editRule.matchMode,
            businessHoursOnly: editRule.businessHoursOnly,
          },
        },
        actions: [buildAction(editRule)],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-replies'] });
      toast.success('Auto-reply updated');
      setIsEditModalOpen(false);
      setEditingRuleId('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Update failed')
  });

  const createMutation = useMutation({
    mutationFn: () => createRule({
      name: newRule.name,
      category: 'auto_reply',
      enabled: true,
      priority: 0,
      trigger: {
        event: 'customer.message.received',
        filters: {
          keywords: [newRule.keyword],
          keywordMatchMode: newRule.matchMode,
          businessHoursOnly: newRule.businessHoursOnly,
        }
      },
      conditions: [],
      actions: [
        buildAction(newRule)
      ]
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-replies'] });
      toast.success('Auto-reply created');
      setIsModalOpen(false);
      setNewRule({
        name: '',
        keyword: '',
        replyMessage: '',
        replyType: 'text',
        templateName: '',
        templateLanguageCode: 'en',
        matchMode: 'contains',
        businessHoursOnly: false,
      });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Create failed')
  });

  const duplicateMutation = useMutation({
    mutationFn: (rule: AutomationRule) => {
      const keyword = rule.trigger?.filters?.keywords?.[0] || '';
      const keywordMatchMode = (rule.trigger?.filters?.keywordMatchMode || 'contains') as 'contains' | 'exact' | 'starts_with';
      const body = rule.actions?.[0]?.config?.body || rule.actions?.[0]?.config?.message || '';

      return createRule({
        name: `${rule.name} Copy`,
        category: 'auto_reply',
        enabled: false,
        priority: 0,
        trigger: {
          event: rule.trigger?.event || 'customer.message.received',
          filters: {
            keywords: keyword ? [keyword] : [],
            keywordMatchMode,
            businessHoursOnly: !!rule.trigger?.filters?.businessHoursOnly,
          },
        },
        conditions: rule.conditions || [],
        actions: rule.actions || [
          {
            type: 'send_message',
            config: { body },
            order: 0,
            continueOnFailure: true,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-replies'] });
      toast.success('Rule duplicated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err.message || 'Duplicate failed')
  });

  const bulkToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const targets = rules.filter((r) => Boolean(r.enabled) !== enabled);
      await Promise.all(targets.map((rule) => toggleRule(rule._id, enabled)));
      return targets.length;
    },
    onSuccess: (count: number, enabled: boolean) => {
      queryClient.invalidateQueries({ queryKey: ['auto-replies'] });
      toast.success(`${count} rules ${enabled ? 'activated' : 'paused'}`);
      setIsGlobalOptionsOpen(false);
    },
    onError: (err: any) => toast.error(err.message || 'Bulk update failed')
  });

  const filteredRules = rules.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.trigger?.filters?.keywords?.some((k: string) => k.toLowerCase().includes(search.toLowerCase()));

    const enabled = Boolean(r.enabled);
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && enabled) ||
      (filterStatus === 'paused' && !enabled);

    const mode = (r.trigger?.filters?.keywordMatchMode || 'contains') as string;
    const matchesMode = filterMatchMode === 'all' || mode === filterMatchMode;

    return matchesSearch && matchesStatus && matchesMode;
  });

  const openEditModal = (rule: AutomationRule) => {
    const keyword = rule.trigger?.filters?.keywords?.[0] || '';
    const matchMode = (rule.trigger?.filters?.keywordMatchMode || 'contains') as 'contains' | 'exact' | 'starts_with';
    const primaryAction = rule.actions?.[0];
    const isTemplateReply = primaryAction?.type === 'send_template';
    const replyMessage = primaryAction?.config?.body || primaryAction?.config?.message || '';
    const templateName = primaryAction?.config?.templateName || '';
    const templateLanguageCode = primaryAction?.config?.languageCode || 'en';

    setEditingRuleId(rule._id);
    setEditRule({
      name: rule.name,
      keyword,
      replyMessage,
      replyType: isTemplateReply ? 'template' : 'text',
      templateName,
      templateLanguageCode,
      matchMode,
      businessHoursOnly: !!rule.trigger?.filters?.businessHoursOnly,
      enabled: Boolean(rule.enabled),
    });
    setIsEditModalOpen(true);
  };

  const getTriggerLabel = (ar: AutomationRule) => {
    const keywords = ar.trigger?.filters?.keywords;
    if (keywords && keywords.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {keywords.slice(0, 3).map((kw: string, i: number) => (
            <Badge key={i} className="bg-primary/5 text-primary border-primary/10 text-[9px] font-black uppercase py-0 px-2 h-5">
              {kw}
            </Badge>
          ))}
          {keywords.length > 3 && <span className="text-[10px] text-muted-foreground font-black opacity-40">+{keywords.length - 3}</span>}
        </div>
      );
    }
    if (ar.trigger?.filters?.businessHoursOnly) return <Badge variant="outline" className="text-[9px] font-black uppercase text-amber-600 border-amber-500/20 bg-amber-500/5">After Office Hours</Badge>;
    return <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-500 border-slate-500/20 bg-slate-500/5">Always Active</Badge>;
  };

  if (isLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-4">
            Instant Auto-Replies
            <Badge variant="secondary" className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest bg-emerald-500/5 text-emerald-600 border-emerald-500/10">
               {rules.filter(r => r.enabled).length} Active Rules
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Setup instant keyword responses to handle frequent customer queries automatically.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="rounded-2xl h-12 px-6 font-black shadow-lg shadow-primary/20 bg-primary group">
          <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" /> Create New Reply
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full lg:w-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or keyword..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-13 rounded-[20px] bg-card border-border/50 focus-visible:ring-primary/20 shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setIsFilterOpen(true)} className="rounded-xl h-13 px-4 border-border/50 font-bold bg-card shadow-sm"><Filter className="h-4 w-4 mr-2" /> Filters</Button>
          <Button variant="outline" onClick={() => setIsGlobalOptionsOpen(true)} className="rounded-xl h-13 px-4 border-border/50 font-bold bg-card shadow-sm"><Settings className="h-4 w-4 mr-2" /> Global Options</Button>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
         {filteredRules.length === 0 ? (
           <div className="py-24 text-center bg-card border border-dashed border-border/50 rounded-[40px] space-y-6">
              <div className="w-20 h-20 rounded-[30px] bg-muted flex items-center justify-center mx-auto opacity-30">
                 <Reply className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">No auto-replies configured</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium mt-1">Automate your responses to common questions like pricing, availability, or location.</p>
              </div>
              <Button onClick={() => setIsModalOpen(true)} className="rounded-2xl h-12 px-8 font-black">
                 + Create First Reply
              </Button>
           </div>
         ) : (
           filteredRules.map((ar, i) => (
             <motion.div 
               key={ar._id}
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: i * 0.05 }}
               className="group bg-card border border-border/50 rounded-3xl p-2 pr-6 hover:shadow-premium transition-all flex items-center gap-6"
             >
               {/* Icon */}
               <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center text-xl shadow-inner transition-all ${
                 Boolean(ar.enabled) ? 'bg-primary/5 text-primary' : 'bg-muted text-muted-foreground opacity-50'
               }`}>
                 {Boolean(ar.enabled) ? <Zap className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
               </div>

               <div className="flex-1 py-4">
                 <div className="flex items-center gap-3 mb-1.5">
                   <h3 className="text-lg font-black tracking-tight text-foreground group-hover:text-primary transition-colors">{ar.name}</h3>
                   <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                     Boolean(ar.enabled) ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                   }`}>
                     {Boolean(ar.enabled) ? 'Live' : 'Paused'}
                   </span>
                 </div>
                 
                 <div className="flex items-center gap-8">
                    <div className="flex flex-col gap-1">
                       <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Triggers on</p>
                       <div className="flex items-center gap-2">
                          {getTriggerLabel(ar)}
                       </div>
                    </div>
                    <div className="h-8 w-px bg-border/20 self-center" />
                    <div className="flex flex-col gap-1">
                       <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Action</p>
                       <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                          <MessageSquare className="h-3 w-3 text-primary" /> Send: {ar.actions?.[0]?.config?.body || ar.actions?.[0]?.config?.message || ar.actions?.[0]?.config?.templateName || 'Direct Message'}
                       </p>
                    </div>
                 </div>
               </div>

               {/* Performance */}
               <div className="hidden xl:flex items-center gap-12 px-10 border-x border-border/10">
                  <div className="flex flex-col">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60 mb-1">Total Hits</p>
                    <p className="text-xl font-black text-foreground">{ar.stats?.totalExecutions || 0}</p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60 mb-1">Last Run</p>
                    <p className="text-[11px] font-bold text-foreground">
                       {ar.stats?.lastExecutedAt ? new Date(ar.stats.lastExecutedAt).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
               </div>

               {/* Actions */}
               <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleMutation.mutate({ id: ar._id, enabled: !Boolean(ar.enabled) })}
                    disabled={toggleMutation.isPending}
                    className={`p-3 rounded-xl transition-all ${
                      Boolean(ar.enabled) 
                        ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {Boolean(ar.enabled) ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                  <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                        <button className="p-3 bg-muted/50 text-muted-foreground hover:bg-primary/5 hover:text-primary rounded-xl transition-all">
                           <MoreVertical className="h-5 w-5" />
                        </button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-premium border-border/50">
                        <DropdownMenuItem className="rounded-xl font-bold" onClick={() => openEditModal(ar)}>Edit Logic</DropdownMenuItem>
                        <DropdownMenuItem className="rounded-xl font-bold" onClick={() => duplicateMutation.mutate(ar)}>Duplicate Rule</DropdownMenuItem>
                        <DropdownMenuItem className="rounded-xl font-bold" onClick={() => setAnalyticsRule(ar)}><BarChart3 className="h-4 w-4 mr-2" /> View Analytics</DropdownMenuItem>
                        <DropdownMenuItem 
                          className="rounded-xl font-bold text-destructive focus:bg-destructive/10"
                          onClick={() => {
                            if (confirm('Delete this auto-reply rule?')) {
                              deleteMutation.mutate(ar._id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                     </DropdownMenuContent>
                  </DropdownMenu>
               </div>
             </motion.div>
           ))
         )}
      </div>

      {/* Global Performance Summary */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/5 rounded-[40px] p-8 border border-emerald-500/20 flex items-center justify-between">
         <div className="flex items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
               <TrendingUp className="h-7 w-7" />
            </div>
            <div>
               <h3 className="text-xl font-black tracking-tight text-foreground">Auto-Response Efficiency</h3>
               <p className="text-sm font-medium text-muted-foreground">Your logic rules are handling <span className="text-emerald-600 font-bold">4.2k messages</span> monthly without human intervention.</p>
            </div>
         </div>
         <Button variant="outline" className="rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6 border-emerald-500/20 hover:bg-emerald-500/10 transition-all">
            Optimize Speed
         </Button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl bg-card border border-border/60 rounded-3xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black">Create Auto-Reply</h3>
                <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                  <Plus className="h-4 w-4 rotate-45" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold mb-2">Rule Name</p>
                  <Input
                    value={newRule.name}
                    onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Pricing instant reply"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold mb-2">Keyword Trigger</p>
                  <Input
                    value={newRule.keyword}
                    onChange={(e) => setNewRule((p) => ({ ...p, keyword: e.target.value }))}
                    placeholder="e.g. price"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold mb-2">Reply Type</p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="new-reply-type"
                        checked={newRule.replyType === 'text'}
                        onChange={() => setNewRule((p) => ({ ...p, replyType: 'text' }))}
                      />
                      Text Message
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="new-reply-type"
                        checked={newRule.replyType === 'template'}
                        onChange={() => setNewRule((p) => ({ ...p, replyType: 'template' }))}
                      />
                      Approved Template
                    </label>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold mb-2">Match Mode</p>
                  <select
                    value={newRule.matchMode}
                    onChange={(e) => setNewRule((p) => ({ ...p, matchMode: e.target.value as 'contains' | 'exact' | 'starts_with' }))}
                    className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm"
                  >
                    <option value="contains">Contains</option>
                    <option value="exact">Exact</option>
                    <option value="starts_with">Starts With</option>
                  </select>
                </div>
                {newRule.replyType === 'text' ? (
                  <div>
                    <p className="text-xs font-bold mb-2">Reply Message</p>
                    <textarea
                      value={newRule.replyMessage}
                      onChange={(e) => setNewRule((p) => ({ ...p, replyMessage: e.target.value }))}
                      placeholder="Type the instant reply message"
                      className="w-full min-h-[110px] rounded-xl border border-border/60 bg-background p-3 text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-bold mb-2">Approved Template</p>
                      <select
                        value={newRule.templateName}
                        onChange={(e) => {
                          const selected = approvedTemplates.find((t) => t.name === e.target.value);
                          setNewRule((p) => ({
                            ...p,
                            templateName: e.target.value,
                            templateLanguageCode: selected?.language || 'en',
                          }));
                        }}
                        className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm"
                      >
                        <option value="">Select approved template</option>
                        {approvedTemplates.map((template) => (
                          <option key={template._id} value={template.name}>
                            {template.name} ({template.language})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs font-bold mb-2">Language Code</p>
                      <Input
                        value={newRule.templateLanguageCode}
                        onChange={(e) => setNewRule((p) => ({ ...p, templateLanguageCode: e.target.value }))}
                        placeholder="e.g. en, en_US"
                      />
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={newRule.businessHoursOnly}
                    onChange={(e) => setNewRule((p) => ({ ...p, businessHoursOnly: e.target.checked }))}
                  />
                  Trigger only during business hours
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={
                    createMutation.isPending ||
                    !newRule.name.trim() ||
                    !newRule.keyword.trim() ||
                    (newRule.replyType === 'text'
                      ? !newRule.replyMessage.trim()
                      : !newRule.templateName.trim())
                  }
                >
                  Create Rule
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setIsEditModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-xl bg-card border border-border/60 rounded-3xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black">Edit Auto-Reply</h3>
                <Button variant="ghost" size="icon" onClick={() => setIsEditModalOpen(false)}>
                  <Plus className="h-4 w-4 rotate-45" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold mb-2">Rule Name</p>
                  <Input value={editRule.name} onChange={(e) => setEditRule((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs font-bold mb-2">Keyword Trigger</p>
                  <Input value={editRule.keyword} onChange={(e) => setEditRule((p) => ({ ...p, keyword: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs font-bold mb-2">Reply Type</p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="edit-reply-type"
                        checked={editRule.replyType === 'text'}
                        onChange={() => setEditRule((p) => ({ ...p, replyType: 'text' }))}
                      />
                      Text Message
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="edit-reply-type"
                        checked={editRule.replyType === 'template'}
                        onChange={() => setEditRule((p) => ({ ...p, replyType: 'template' }))}
                      />
                      Approved Template
                    </label>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold mb-2">Match Mode</p>
                  <select
                    value={editRule.matchMode}
                    onChange={(e) => setEditRule((p) => ({ ...p, matchMode: e.target.value as 'contains' | 'exact' | 'starts_with' }))}
                    className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm"
                  >
                    <option value="contains">Contains</option>
                    <option value="exact">Exact</option>
                    <option value="starts_with">Starts With</option>
                  </select>
                </div>
                {editRule.replyType === 'text' ? (
                  <div>
                    <p className="text-xs font-bold mb-2">Reply Message</p>
                    <textarea
                      value={editRule.replyMessage}
                      onChange={(e) => setEditRule((p) => ({ ...p, replyMessage: e.target.value }))}
                      className="w-full min-h-[110px] rounded-xl border border-border/60 bg-background p-3 text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-bold mb-2">Approved Template</p>
                      <select
                        value={editRule.templateName}
                        onChange={(e) => {
                          const selected = approvedTemplates.find((t) => t.name === e.target.value);
                          setEditRule((p) => ({
                            ...p,
                            templateName: e.target.value,
                            templateLanguageCode: selected?.language || 'en',
                          }));
                        }}
                        className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm"
                      >
                        <option value="">Select approved template</option>
                        {approvedTemplates.map((template) => (
                          <option key={template._id} value={template.name}>
                            {template.name} ({template.language})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs font-bold mb-2">Language Code</p>
                      <Input
                        value={editRule.templateLanguageCode}
                        onChange={(e) => setEditRule((p) => ({ ...p, templateLanguageCode: e.target.value }))}
                        placeholder="e.g. en, en_US"
                      />
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={editRule.businessHoursOnly} onChange={(e) => setEditRule((p) => ({ ...p, businessHoursOnly: e.target.checked }))} />
                  Trigger only during business hours
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={editRule.enabled} onChange={(e) => setEditRule((p) => ({ ...p, enabled: e.target.checked }))} />
                  Rule enabled
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={
                    updateMutation.isPending ||
                    !editRule.name.trim() ||
                    !editRule.keyword.trim() ||
                    (editRule.replyType === 'text'
                      ? !editRule.replyMessage.trim()
                      : !editRule.templateName.trim())
                  }
                >
                  Save Changes
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setIsFilterOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md bg-card border border-border/60 rounded-3xl shadow-2xl p-6"
            >
              <h3 className="text-lg font-black mb-4">Filters</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold mb-2">Status</p>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'paused')} className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm">
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div>
                  <p className="text-xs font-bold mb-2">Match Mode</p>
                  <select value={filterMatchMode} onChange={(e) => setFilterMatchMode(e.target.value as 'all' | 'contains' | 'exact' | 'starts_with')} className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm">
                    <option value="all">All</option>
                    <option value="contains">Contains</option>
                    <option value="exact">Exact</option>
                    <option value="starts_with">Starts With</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setFilterStatus('all'); setFilterMatchMode('all'); }}>Reset</Button>
                <Button onClick={() => setIsFilterOpen(false)}>Apply</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGlobalOptionsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setIsGlobalOptionsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md bg-card border border-border/60 rounded-3xl shadow-2xl p-6"
            >
              <h3 className="text-lg font-black mb-4">Global Options</h3>
              <div className="space-y-3">
                <Button className="w-full" variant="outline" onClick={() => bulkToggleMutation.mutate(true)} disabled={bulkToggleMutation.isPending}>
                  Enable All Rules
                </Button>
                <Button className="w-full" variant="outline" onClick={() => bulkToggleMutation.mutate(false)} disabled={bulkToggleMutation.isPending}>
                  Pause All Rules
                </Button>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setIsGlobalOptionsOpen(false)}>Close</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {analyticsRule && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setAnalyticsRule(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md bg-card border border-border/60 rounded-3xl shadow-2xl p-6"
            >
              <h3 className="text-lg font-black mb-4">Rule Analytics</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-bold">Rule:</span> {analyticsRule.name}</p>
                <p><span className="font-bold">Total Executions:</span> {analyticsRule.stats?.totalExecutions || 0}</p>
                <p><span className="font-bold">Last Executed:</span> {analyticsRule.stats?.lastExecutedAt ? new Date(analyticsRule.stats.lastExecutedAt).toLocaleString() : 'Never'}</p>
                <p><span className="font-bold">Status:</span> {Boolean(analyticsRule.enabled) ? 'Live' : 'Paused'}</p>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setAnalyticsRule(null)}>Close</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrendingUp(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
