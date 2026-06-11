"use client";

import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Settings, 
  Plus, 
  Link as LinkIcon, 
  FileText, 
  Database, 
  ShieldAlert, 
  Save, 
  ChevronDown, 
  X, 
  Check, 
  Search,
  Zap,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  MoreVertical,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';

import { 
  getAnswerBotSettings, 
  updateAnswerBotSettings, 
  getAnswerBotSources, 
  addAnswerBotSource, 
  getAnswerBotFAQs, 
  approveAnswerBotFAQs,
  AnswerBotSource,
  FAQ 
} from '@/lib/api/automation';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FlashLoader from '@/components/ui/flash-loader';

export default function AnswerBotPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const workspaceId = user?.workspace || '';

  const [activeTab, setActiveTab] = useState('knowledge');
  const [showAddSource, setShowAddSource] = useState(false);
  const [selectedFaqIds, setSelectedFaqIds] = useState<Set<string>>(new Set());
  const [expandedFaqIds, setExpandedFaqIds] = useState<Set<string>>(new Set());

  // Data Fetching
  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['answerbot-settings', workspaceId],
    queryFn: () => getAnswerBotSettings(workspaceId),
    enabled: !!workspaceId
  });

  const { data: sourcesData, isLoading: isSourcesLoading } = useQuery({
    queryKey: ['answerbot-sources', workspaceId],
    queryFn: () => getAnswerBotSources(workspaceId),
    enabled: !!workspaceId
  });

  const { data: faqsData, isLoading: isFaqsLoading } = useQuery({
    queryKey: ['answerbot-faqs', workspaceId],
    queryFn: () => getAnswerBotFAQs(workspaceId),
    enabled: !!workspaceId
  });

  const settings = settingsData || {};
  const sources: AnswerBotSource[] = Array.isArray(sourcesData) ? sourcesData : [];
  const faqs: FAQ[] = Array.isArray(faqsData) ? faqsData : [];

  // Mutations
  const saveSettingsMutation = useMutation({
    mutationFn: (data: any) => updateAnswerBotSettings(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answerbot-settings'] });
      toast.success('Settings updated');
    }
  });

  const approveMutation = useMutation({
    mutationFn: (ids: string[]) => approveAnswerBotFAQs(workspaceId, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answerbot-faqs'] });
      setSelectedFaqIds(new Set());
      toast.success('FAQs approved');
    }
  });

  const addSourceMutation = useMutation({
    mutationFn: (data: any) => addAnswerBotSource(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answerbot-sources'] });
      setShowAddSource(false);
      toast.success('Source added and training started');
    }
  });

  const toggleFaq = (id: string) => {
    const updated = new Set(selectedFaqIds);
    updated.has(id) ? updated.delete(id) : updated.add(id);
    setSelectedFaqIds(updated);
  };

  if (isSettingsLoading || isSourcesLoading) return <FlashLoader />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-4">
            Smart AnswerBot
            <div className="relative">
               <Badge className={`rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-widest ${settings.enabled ? 'bg-indigo-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                 {settings.enabled ? 'Live & Learning' : 'Offline'}
               </Badge>
               {settings.enabled && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span></span>}
            </div>
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Define a persona and feed your AI knowledge to automate 80% of support queries.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.open('https://developers.facebook.com/docs/whatsapp/cloud-api/overview', '_blank')} className="rounded-2xl h-12 px-6 border-border/50 font-bold flex items-center gap-2">
             <HelpCircle className="h-4 w-4" /> Resource Center
          </Button>
          <Button 
            onClick={() => saveSettingsMutation.mutate({ enabled: !settings.enabled })}
            className={`rounded-2xl h-12 px-6 font-black shadow-lg transition-all ${settings.enabled ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-destructive/10' : 'bg-indigo-600 text-white shadow-indigo-600/20'}`}
          >
            {settings.enabled ? 'Pause AnswerBot' : 'Activate AnswerBot'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="knowledge" className="space-y-8">
        <TabsList className="bg-muted/30 p-1.5 rounded-2xl border border-border/50">
          <TabsTrigger value="knowledge" className="rounded-xl px-8 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Knowledge Base</TabsTrigger>
          <TabsTrigger value="persona" className="rounded-xl px-8 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Persona & Tone</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl px-8 font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="space-y-8 animate-in fade-in slide-in-from-left-2 transition-all">
          {/* Data Sources Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                 <Database className="h-5 w-5 text-indigo-500" /> Trained Sources
               </h3>
               <Button onClick={() => setShowAddSource(true)} className="rounded-xl h-10 px-4 bg-primary font-bold shadow-lg shadow-primary/10">
                 <Plus className="h-4 w-4 mr-2" /> Add Data Source
               </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <AnimatePresence mode="popLayout">
                 {sources.length === 0 ? (
                    <div className="col-span-full py-16 text-center bg-card border border-dashed border-border/50 rounded-[32px] space-y-4">
                       <LinkIcon className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                       <p className="text-sm font-bold text-muted-foreground/60 uppercase tracking-widest">No training data yet</p>
                    </div>
                 ) : sources.map((src, i) => (
                    <motion.div 
                      key={src._id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-card border border-border/50 p-6 rounded-[28px] shadow-sm hover:shadow-premium transition-all group"
                    >
                       <div className="flex items-start justify-between mb-4">
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
                            src.sourceType === 'url' ? 'bg-blue-500/10 text-blue-500' :
                            src.sourceType === 'document' ? 'bg-indigo-500/10 text-indigo-500' :
                            'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            {src.sourceType === 'url' ? <LinkIcon className="h-6 w-6" /> :
                             src.sourceType === 'document' ? <Database className="h-6 w-6" /> :
                             <FileText className="h-6 w-6" />}
                          </div>
                          <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><MoreVertical className="h-4 w-4" /></Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-premium border-border/50">
                                <DropdownMenuItem
                                  onClick={() => addSourceMutation.mutate({ sourceType: src.sourceType, title: src.title, websiteUrl: src.websiteUrl, textContent: src.textContent })}
                                  className="rounded-xl font-bold cursor-pointer">Resync Data</DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    if (!window.confirm('Remove this knowledge source?')) return;
                                    try {
                                      await apiClient.delete(`/automation/engine/answerbot/sources/${src._id}`, { params: { workspaceId } });
                                      toast.success('Source removed');
                                      queryClient.invalidateQueries({ queryKey: ['answerbot-sources'] });
                                    } catch (err: any) {
                                      toast.error(err?.response?.data?.error || 'Failed to remove source');
                                    }
                                  }}
                                  className="rounded-xl font-bold text-destructive cursor-pointer">Remove Source</DropdownMenuItem>
                             </DropdownMenuContent>
                          </DropdownMenu>
                       </div>
                       <h4 className="font-black text-foreground truncate mb-1">{src.title || src.websiteUrl}</h4>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 mb-6">{src.sourceType} • {src.faqCount} FAQs</p>
                       <div className="flex items-center justify-between border-t border-border/10 pt-4 mt-auto">
                          <Badge variant="outline" className="bg-muted/30 border-none text-[8px] font-black uppercase">{src.crawlStatus}</Badge>
                          <span className="text-[9px] font-bold text-muted-foreground">{new Date(src.createdAt).toLocaleDateString()}</span>
                       </div>
                    </motion.div>
                 ))}
               </AnimatePresence>
            </div>
          </div>

          {/* FAQ Triage Section */}
          <div className="space-y-6 pt-8 border-t border-border/30">
             <div className="flex items-center justify-between">
                <div className="space-y-1">
                   <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                     <Sparkles className="h-5 w-5 text-amber-500" /> Extracted Q&A Drafts
                   </h3>
                   <p className="text-xs font-medium text-muted-foreground italic">AI-extracted questions awaiting your approval before going live.</p>
                </div>
                <Button 
                  disabled={selectedFaqIds.size === 0 || approveMutation.isPending}
                  onClick={() => approveMutation.mutate(Array.from(selectedFaqIds))}
                  className="rounded-xl h-11 px-6 bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20"
                >
                  {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Approve Selected ({selectedFaqIds.size})
                </Button>
             </div>

             <div className="space-y-3">
                {faqs.map(faq => (
                  <div key={faq._id} className={`bg-card border transition-all rounded-[24px] overflow-hidden ${selectedFaqIds.has(faq._id) ? 'border-primary shadow-premium-sm ring-1 ring-primary/20' : 'border-border/50 hover:border-primary/30'}`}>
                    <div className="p-4 flex items-center gap-4">
                       <input 
                        type="checkbox" 
                        checked={selectedFaqIds.has(faq._id)} 
                        onChange={() => toggleFaq(faq._id)} 
                        className="h-5 w-5 rounded-lg border-2 border-border/50 text-primary focus:ring-primary focus:ring-offset-0 bg-transparent cursor-pointer"
                       />
                       <div 
                        className="flex-1 cursor-pointer flex items-center justify-between"
                        onClick={() => setExpandedFaqIds(prev => { const n = new Set(prev); n.has(faq._id) ? n.delete(faq._id) : n.add(faq._id); return n; })}
                       >
                          <h4 className="text-sm font-black text-foreground">{faq.question}</h4>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedFaqIds.has(faq._id) ? 'rotate-180' : ''}`} />
                       </div>
                    </div>
                    <AnimatePresence>
                       {expandedFaqIds.has(faq._id) && (
                         <motion.div 
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: 'auto', opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           className="px-12 pb-6 pt-2 space-y-4 bg-muted/20 border-t border-border/10"
                         >
                            <p className="text-sm font-medium text-muted-foreground leading-relaxed">{faq.answer}</p>
                            
                            <div className="pt-4 border-t border-border/20">
                               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">WhatsApp Interactive (Optional)</p>
                               <div className="flex flex-wrap gap-2">
                                  {faq.interactive?.buttons?.map((btn) => (
                                    <Badge key={btn.id} className="bg-background text-foreground border-border/50 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase">
                                      {btn.title}
                                    </Badge>
                                  ))}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      const title = window.prompt('Button label (max 20 chars):');
                                      if (!title?.trim()) return;
                                      const buttons = [
                                        ...(faq.interactive?.buttons || []),
                                        { id: `btn_${Date.now()}`, title: title.trim().slice(0, 20) },
                                      ];
                                      try {
                                        await apiClient.patch(`/automation/engine/answerbot/faqs/${faq._id}`, { interactive: { buttons } }, { params: { workspaceId } });
                                        toast.success('Button added');
                                        queryClient.invalidateQueries({ queryKey: ['answerbot-faqs'] });
                                      } catch (err: any) {
                                        toast.error(err?.response?.data?.error || 'Failed to add button');
                                      }
                                    }}
                                    className="rounded-xl border border-dashed border-primary/40 text-primary text-[10px] font-black h-8 px-3">
                                    <Plus className="h-3 w-3 mr-1" /> Add Button
                                  </Button>
                               </div>
                            </div>
                         </motion.div>
                       )}
                    </AnimatePresence>
                  </div>
                ))}
             </div>
          </div>
        </TabsContent>

        <TabsContent value="persona" className="animate-in fade-in slide-in-from-right-2">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                 <div className="bg-card border border-border/50 rounded-[40px] p-8 space-y-8 shadow-sm">
                    <div className="space-y-6">
                       <h3 className="text-xl font-black text-foreground">Bot Personality</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Bot Identity Name</label>
                             <Input 
                              value={settings.personaName || ''} 
                              onChange={e => saveSettingsMutation.mutate({ personaName: e.target.value })}
                              placeholder="e.g. Sales Assistant" 
                              className="h-12 rounded-xl bg-muted/20 border-none font-bold"
                             />
                             <p className="text-[10px] text-muted-foreground italic px-1">Displayed when handover occurs.</p>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">AI Engine</label>
                             <select 
                               className="w-full h-12 rounded-xl bg-muted/20 border-none font-bold px-4 text-sm"
                               value={settings.aiModel || 'gpt-3.5-turbo'}
                               onChange={e => saveSettingsMutation.mutate({ aiModel: e.target.value })}
                             >
                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Standard)</option>
                                <option value="gpt-4o">GPT-4o (High Performance)</option>
                                <option value="claude-3-haiku">Claude 3 Haiku (Best Tone)</option>
                             </select>
                          </div>
                       </div>
                       
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">System Prompt / Role Definition</label>
                          <Textarea 
                            value={settings.systemPrompt || ''}
                            onChange={e => saveSettingsMutation.mutate({ systemPrompt: e.target.value })}
                            placeholder="You are an expert sales consultant for wApi. Your tone is professional yet friendly. Only answer based on the knowledge provided..."
                            className="min-h-[200px] rounded-2xl bg-muted/20 border-none font-medium p-4 focus-visible:ring-primary/20"
                          />
                       </div>
                    </div>
                 </div>
              </div>
              
              <div className="space-y-6">
                 <div className="bg-slate-900 rounded-[40px] p-8 border border-white/5 text-white shadow-2xl space-y-6">
                    <div className="flex items-center gap-3">
                       <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                          <Zap className="h-5 w-5 text-primary" />
                       </div>
                       <h3 className="font-black">Live Preview</h3>
                    </div>
                    <div className="space-y-4">
                       <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Incoming Message</p>
                          <p className="text-xs font-medium italic opacity-70">"What is your pricing model for small teams?"</p>
                       </div>
                       <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Bot Response</p>
                          <div className="flex gap-2">
                             <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center animate-pulse flex-shrink-0">
                                <Bot className="h-3 w-3 text-primary" />
                             </div>
                             <p className="text-xs font-semibold leading-relaxed">
                                (Generating based on your persona instructions...)
                             </p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </TabsContent>
        
        <TabsContent value="settings" className="animate-in fade-in zoom-in-95">
           <div className="bg-card border border-border/50 rounded-[40px] p-8 max-w-2xl shadow-sm space-y-8">
              <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" /> Operational Fallbacks
              </h3>
              
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Confidence Threshold</label>
                    <div className="flex items-center gap-4">
                       <input type="range" className="flex-1 accent-primary" />
                       <Badge className="bg-primary font-black">85%</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic px-1">Bot will only answer if confidence score exceeds this value.</p>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">If Bot confidence is low:</label>
                    <select 
                      className="w-full h-12 rounded-xl bg-muted/20 border-none font-bold px-4 text-sm"
                      value={settings.fallbackAction || 'send_fallback_message'}
                      onChange={e => saveSettingsMutation.mutate({ fallbackAction: e.target.value })}
                    >
                       <option value="send_fallback_message">Send Fallback Message</option>
                       <option value="assign_to_agent">Handover to Human immediately</option>
                    </select>
                 </div>

                 <AnimatePresence>
                    {settings.fallbackAction === 'send_fallback_message' && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-2 pt-2"
                      >
                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Fallback Message</label>
                         <Textarea 
                           value={settings.fallbackMessage || ''}
                           onChange={e => saveSettingsMutation.mutate({ fallbackMessage: e.target.value })}
                           placeholder="I'm sorry, I'm still learning. Let me connect you to a human agent who can help better..."
                           className="rounded-2xl bg-muted/20 border-none font-medium p-4 min-h-[100px]"
                         />
                      </motion.div>
                    )}
                 </AnimatePresence>
              </div>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
