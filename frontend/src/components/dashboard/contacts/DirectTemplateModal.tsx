"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  MessageSquare, 
  CheckCircle2, 
  Sparkles, 
  Send,
  Loader2,
  Info,
  ArrowRight,
  User as UserIcon,
  Phone,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

import { fetchTemplates, Template } from '@/lib/api/templates';
import { fetchContacts, Contact } from '@/lib/api/contacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import api from '@/lib/axios';

interface DirectTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: Contact | null;
  initialTemplateId?: string | null;
}

export default function DirectTemplateModal({ 
  isOpen, 
  onClose, 
  contact: externalContact, 
  initialTemplateId 
}: DirectTemplateModalProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Sync internal state with props
  useEffect(() => {
    if (isOpen) {
      if (externalContact) setSelectedContact(externalContact);
      if (initialTemplateId) setSelectedTemplateId(initialTemplateId);
    } else {
      // Reset on close
      setSelectedContact(null);
      setSelectedTemplateId(null);
      setVariables({});
      setSearchTerm('');
      setContactSearch('');
    }
  }, [isOpen, externalContact, initialTemplateId]);

  // Queries
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['templates', 'APPROVED'],
    queryFn: () => fetchTemplates({ status: 'APPROVED' }),
    enabled: isOpen
  });

  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', 'search', contactSearch],
    queryFn: () => fetchContacts(1, 20, { search: contactSearch }),
    enabled: isOpen && !externalContact && !selectedContact
  });

  const { data: pricingData } = useQuery({
    queryKey: ['workspace-pricing'],
    queryFn: async () => {
      const resp = await api.get('/workspace/pricing');
      return (resp as any).data;
    },
    enabled: isOpen
  });

  const wallet = useAuthStore((s) => s.wallet);
  const currentBalance = wallet?.balance || 0;
  const currency = wallet?.currency || 'INR';

  const templates: Template[] = templatesData?.data || [];
  const contacts: Contact[] = contactsData?.data || [];

  const filteredTemplates = templates.filter((t) => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeContact = externalContact || selectedContact;

  const selectedTemplate = useMemo(() => 
    templates.find(t => t._id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  const templateVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    const body = selectedTemplate.bodyText || selectedTemplate.body?.text || '';
    const matches = body.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  }, [selectedTemplate]);

  const estimatedCost = useMemo(() => {
    if (!selectedTemplate || !pricingData) return 0;
    const cat = selectedTemplate.category || 'MARKETING';
    // Mapping model categories to pricing categories
    const normalizedCat = (cat === 'PROMOTIONAL' ? 'MARKETING' : 
                          (cat === 'TRANSACTIONAL' ? 'UTILITY' : 
                          (cat === 'OTP' ? 'AUTHENTICATION' : cat))).toUpperCase();
    
    return (pricingData[normalizedCat] || pricingData['UTILITY'] || 40) / 100; // paise to absolute
  }, [selectedTemplate, pricingData]);

  const isInsufficientBalance = currentBalance < (estimatedCost * 100);

  // Mutation
  const sendMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post(`/contacts/${activeContact?._id}/send-template`, payload);
      return response;
    },
    onSuccess: (data: any) => {
      toast.success('Template message sent successfully!');
      
      // Refresh wallet balance in header & global state
      useAuthStore.getState().fetchSession(true);
      
      onClose();
      // user request: no need to redirect to inbox
      /*
      if (data.conversationId) {
        router.push(`/inbox?conversationId=${data.conversationId}`);
      }
      */
    },
    onError: (error: any) => {
      if (error?.status === 402) {
        toast.error('Insufficient wallet balance. Redirecting to billing...');
        setTimeout(() => router.push('/billing?action=recharge'), 1500);
      } else {
        toast.error(error?.message || 'Failed to send template message');
      }
    }
  });

  const handleSend = () => {
    if (!selectedTemplate || !activeContact) return;

    const structuredVariables = templateVariables.map((v) => ({
      type: 'text',
      text: variables[v] || ''
    }));

    sendMutation.mutate({
      templateName: selectedTemplate.name,
      languageCode: selectedTemplate.language || 'en',
      variables: [
        {
          type: 'body',
          parameters: structuredVariables
        }
      ]
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-5xl bg-card border border-border/50 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <MessageSquare className="h-5 w-5" />
             </div>
             <div>
                <h2 className="text-xl font-black tracking-tight text-foreground">Send Template</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Direct Messaging Interface
                </p>
             </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Left Panel: Selection (Template or Contact depending on flow) */}
          <div className="md:col-span-4 border-r border-border/40 flex flex-col h-full overflow-hidden bg-muted/5">
            {activeContact ? (
              // Case 1: Template Selection (Contact already known)
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-border/40 bg-background/50">
                  <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-primary/5 border border-primary/10">
                    <Avatar className="h-10 w-10 rounded-xl">
                      <AvatarFallback className="bg-primary/10 text-primary font-black">{activeContact.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black truncate">{activeContact.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground">{activeContact.phone}</p>
                    </div>
                    {!externalContact && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setSelectedContact(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search templates..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10 rounded-xl bg-background border-border/50 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1 p-2">
                   {loadingTemplates ? (
                     <div className="space-y-2 p-2">
                       {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                     </div>
                   ) : (
                     <div className="space-y-1">
                       {filteredTemplates.map((template) => (
                         <div 
                           key={template._id}
                           onClick={() => setSelectedTemplateId(template._id)}
                           className={`
                             p-3 rounded-xl border-2 transition-all cursor-pointer group relative overflow-hidden
                             ${selectedTemplateId === template._id 
                               ? 'border-primary bg-primary/5 shadow-premium-sm' 
                               : 'border-transparent bg-background/40 hover:bg-muted/50'}
                           `}
                         >
                           <p className={`text-xs font-bold truncate ${selectedTemplateId === template._id ? 'text-primary' : 'text-foreground'}`}>
                             {template.name}
                           </p>
                           <div className="flex items-center justify-between mt-1">
                              <Badge variant="outline" className="text-[8px] h-4 font-black uppercase opacity-60">
                                {template.category}
                              </Badge>
                              {selectedTemplateId === template._id && <CheckCircle2 className="h-3 w-3 text-primary" />}
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                </ScrollArea>
              </div>
            ) : (
              // Case 2: Contact Selection (Starting from Template)
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-border/40 bg-background/50">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block">Recipient Contact</Label>
                   <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search contacts..." 
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-background border-border/50 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1 p-2">
                   {loadingContacts ? (
                     <div className="space-y-2 p-2">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                     </div>
                   ) : contacts.length > 0 ? (
                     <div className="space-y-1">
                        {contacts.map((c) => (
                          <div 
                            key={c._id}
                            onClick={() => setSelectedContact(c)}
                            className="p-3 rounded-xl bg-background/40 hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-all cursor-pointer flex items-center gap-3"
                          >
                             <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">
                                  {c.name.charAt(0)}
                                </AvatarFallback>
                             </Avatar>
                             <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{c.name}</p>
                                <p className="text-[10px] text-muted-foreground font-medium">{c.phone}</p>
                             </div>
                          </div>
                        ))}
                     </div>
                   ) : (
                     <div className="p-8 text-center opacity-40">
                        <UserIcon className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No contacts found</p>
                     </div>
                   )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Right Panel: Template Preview & Configuration */}
          <div className="md:col-span-8 p-8 flex flex-col h-full overflow-y-auto space-y-8">
             {selectedTemplate ? (
               <>
                 <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Message Content Preview</Label>
                      {activeContact && (
                        <Badge variant="outline" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-primary/20">
                          To: {activeContact.phone}
                        </Badge>
                      )}
                    </div>
                    <div className="bg-slate-950 dark:bg-slate-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden border border-white/5">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <MessageSquare className="h-12 w-12 text-white" />
                        </div>
                        <div className="text-slate-100 text-[15px] leading-relaxed font-medium whitespace-pre-wrap relative z-10 selection:bg-primary/30">
                          {selectedTemplate.bodyText || selectedTemplate.body?.text}
                        </div>
                    </div>
                 </div>

                 {templateVariables.length > 0 && (
                   <div className="space-y-6">
                      <div className="flex items-center gap-2 text-amber-500">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Personalize Variables</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {templateVariables.map((variable) => (
                           <div key={variable} className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{`Parameter {{${variable}}}`}</Label>
                              <Input 
                                placeholder={`Value for {{${variable}}}`}
                                value={variables[variable] || ''}
                                onChange={(e) => setVariables(v => ({ ...v, [variable]: e.target.value }))}
                                className="h-12 rounded-xl bg-muted/20 border-border/50 focus:ring-primary/20 font-bold"
                              />
                           </div>
                        ))}
                      </div>
                   </div>
                 )}

                 <div className="pt-6 flex flex-col gap-4">
                    {isInsufficientBalance ? (
                       <div className="flex flex-col gap-4">
                          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4">
                             <div className="h-10 w-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                                <Info className="h-5 w-5" />
                             </div>
                             <div className="flex-1">
                                <p className="text-[11px] font-black text-red-600 uppercase tracking-widest">Insufficient Balance</p>
                                <p className="text-[10px] text-muted-foreground font-medium">You need at least {currency} {estimatedCost.toFixed(2)} to send this message.</p>
                             </div>
                          </div>
                          <Button 
                            onClick={() => router.push('/billing?action=recharge')}
                            className="rounded-2xl h-16 font-black shadow-lg shadow-primary/20 bg-primary group w-full text-lg uppercase tracking-tight"
                          >
                            Top Up Balance
                            <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                          </Button>
                       </div>
                    ) : (
                      <Button 
                        onClick={handleSend}
                        disabled={sendMutation.isPending || !activeContact || templateVariables.some(v => !variables[v])}
                        className="rounded-2xl h-16 font-black shadow-lg shadow-primary/20 bg-primary group w-full text-lg uppercase tracking-tight"
                      >
                        {sendMutation.isPending ? (
                          <>
                            <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Send Official Template
                            <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </Button>
                    )}

                    <div className="flex items-center justify-between gap-3 bg-muted/20 px-6 py-4 rounded-3xl border border-border/40">
                       <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center text-primary shadow-sm border border-border/50">
                             <Sparkles className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Est. Message Cost</span>
                             <span className="text-sm font-black text-foreground">{currency} {estimatedCost.toFixed(2)}</span>
                          </div>
                       </div>
                       
                       <div className="h-8 w-px bg-border/50 mx-2" />

                       <div className="flex items-center gap-3 text-right">
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Wallet Balance</span>
                             <span className={`text-sm font-black ${isInsufficientBalance ? 'text-red-500' : 'text-emerald-500'}`}>
                               {currency} {(currentBalance / 100).toFixed(2)}
                             </span>
                          </div>
                          <div className={`h-8 w-8 rounded-lg bg-background flex items-center justify-center shadow-sm border border-border/50 ${isInsufficientBalance ? 'text-red-500' : 'text-emerald-500'}`}>
                             {isInsufficientBalance ? <Info className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </div>
                       </div>
                    </div>
                 </div>
               </>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <div className="h-20 w-20 rounded-[30px] bg-muted/50 flex items-center justify-center border border-border/50">
                    <Zap className="h-10 w-10" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tighter">Ready to dispatch</h3>
                    <p className="text-sm font-medium max-w-[280px] mx-auto">
                      {activeContact 
                        ? "Select a template from the library to configure your message."
                        : "Please select a recipient contact first."}
                    </p>
                  </div>
               </div>
             )}
          </div>
        </div>

        <div className="px-8 py-4 bg-muted/40 border-t border-border/40 flex items-center justify-center gap-3">
           <div className="flex -space-x-2">
              {[1, 2, 3].map(i => <div key={i} className="h-5 w-5 rounded-full border-2 border-background bg-slate-200" />)}
           </div>
           <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-70">
             Official Meta Cloud API Business Provider
           </span>
        </div>
      </motion.div>
    </div>
  );
}
