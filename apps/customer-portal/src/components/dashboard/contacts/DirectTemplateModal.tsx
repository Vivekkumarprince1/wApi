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
  Zap,
  Image as ImageIcon,
  Video,
  FileText as FileIcon,
  MapPin,
  ExternalLink,
  Globe,
  CornerDownLeft,
  RefreshCcw,
  Clock,
  ArrowLeft,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

import { fetchTemplates, Template } from '@/lib/api/templates';
import { fetchContacts, Contact, sendTemplateToContact, getContactsFromResponse } from '@/lib/api/contacts';
import { getWorkspacePricing } from '@/lib/api/billing';
import { formatWalletMoney, normalizeWalletBalanceForDisplay } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface DirectTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: Contact | null;
  initialTemplateId?: string | null;
}

const EMPTY_ARRAY: any[] = [];

const getDynamicPreviewText = (templateText: string = '', vars: Record<string, string>) => {
  if (!templateText) return '';
  return templateText.replace(/\{\{(\w+)\}\}/g, (match, p1) => {
    return vars[p1] !== undefined && vars[p1] !== '' ? vars[p1] : `{{${p1}}}`;
  });
};

const formatBodyTextWithPills = (text: string = '') => {
  if (!text) return '';
  const parts = text.split(/(\{\{\w+\}\})/g);
  return parts.map((part, index) => {
    if (part.startsWith('{{') && part.endsWith('}}')) {
      return (
        <span
          key={index}
          className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20 text-[10px] mx-0.5"
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

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
      const resp = await getWorkspacePricing();
      return (resp as any).data;
    },
    enabled: isOpen
  });

  const wallet = useAuthStore((s) => s.wallet);
  const currentBalance = wallet?.balance || 0;
  const displayBalance = normalizeWalletBalanceForDisplay(currentBalance);
  const currency = wallet?.currency || 'INR';

  const templates: Template[] = templatesData?.data || EMPTY_ARRAY;
  const contacts: Contact[] = getContactsFromResponse(contactsData) || EMPTY_ARRAY;

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

  const isInsufficientBalance = displayBalance < estimatedCost;

  // Mutation
  const sendMutation = useMutation({
    mutationFn: async (payload: any) => {
      const contactId = activeContact?._id;
      if (!contactId) {
        throw new Error('Contact is required to send a template');
      }
      const response = await sendTemplateToContact(contactId, payload);
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
      templatePreview: {
        id: selectedTemplate.id || selectedTemplate._id,
        name: selectedTemplate.name,
        category: selectedTemplate.category,
        language: selectedTemplate.language || 'en',
        bodyText: selectedTemplate.bodyText || selectedTemplate.body?.text || '',
        body: selectedTemplate.body,
        header: selectedTemplate.header,
        buttons: selectedTemplate.buttons,
        components: (selectedTemplate as any).components || [],
      },
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
        className="relative w-full max-w-5xl bg-card border border-border/50 rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[720px] max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div>
                <h2 className="text-xl font-black tracking-tight text-foreground">Send Template</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Direct Messaging Interface
                </p>
              </div>
              {selectedTemplate && (
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted border border-border/60 px-2 py-0.5 rounded-md flex items-center gap-1 self-start md:self-center mt-1 md:mt-0">
                  <span>Est. Cost:</span>
                  <span className="text-foreground font-extrabold">{currency} {estimatedCost.toFixed(2)}</span>
                </div>
              )}
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
                <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 scrollbar-thin">
                  {loadingTemplates ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredTemplates.map((template) => (
                        <div
                          key={template._id}
                          onClick={() => setSelectedTemplateId(template._id)}
                          className={`
                             p-3.5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden flex flex-col gap-1.5
                             ${selectedTemplateId === template._id
                              ? 'border-primary bg-primary/5 shadow-premium-sm ring-1 ring-primary/20'
                              : 'border-border/60 bg-card hover:bg-muted/50'}
                           `}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-xs font-bold break-words line-clamp-2 leading-snug ${selectedTemplateId === template._id ? 'text-primary' : 'text-foreground'}`}>
                              {template.name}
                            </p>
                            {selectedTemplateId === template._id && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[8px] h-4 font-black uppercase tracking-wider bg-card border-border/60 opacity-70">
                              {template.category}
                            </Badge>
                            <Badge variant="outline" className="text-[8px] h-4 font-black uppercase tracking-wider bg-card border-border/60 opacity-70 flex items-center gap-0.5">
                              <Globe className="h-2.5 w-2.5" />
                              {template.language || 'en'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 scrollbar-thin">
                  {loadingContacts ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                    </div>
                  ) : contacts.length > 0 ? (
                    <div className="space-y-2">
                      {contacts.map((c) => (
                        <div
                          key={c._id}
                          onClick={() => setSelectedContact(c)}
                          className="p-3 rounded-2xl bg-card border border-border/60 hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer flex items-center gap-3"
                        >
                          <Avatar className="h-9 w-9 rounded-xl">
                            <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">
                              {c.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate text-foreground">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground font-semibold">{c.phone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center opacity-40">
                      <UserIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No contacts found</p>
                    </div>
                  )}
                </div>
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

                  {/* Smartphone Mockup Window */}
                  <div className="w-[300px] mx-auto border-[6px] border-zinc-800 dark:border-zinc-700 rounded-[38px] shadow-2xl overflow-hidden bg-[#efeae2] dark:bg-zinc-950 flex flex-col h-[480px] relative">
                    {/* Phone Notch/Speaker */}
                    <div className="absolute top-1.5 inset-x-0 flex justify-center z-30 pointer-events-none">
                      <div className="w-20 h-3.5 bg-zinc-800 rounded-full" />
                    </div>

                    {/* WhatsApp Header Mock */}
                    <div className="bg-[#075e54] dark:bg-zinc-900 text-white pt-5 pb-2.5 px-4 flex items-center justify-between shrink-0 z-20 shadow-md">
                      <div className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4 opacity-80 cursor-pointer" />
                        <Avatar className="h-7 w-7 rounded-full border border-white/10 flex-shrink-0">
                          <AvatarFallback className="bg-white/20 text-white text-[9px] font-black">
                            {activeContact?.name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-bold truncate leading-tight">{activeContact?.name || 'Customer'}</span>
                          <span className="text-[7px] opacity-80 font-medium leading-none">online</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 opacity-80">
                        <Video className="h-3.5 w-3.5" />
                        <Phone className="h-3.5 w-3.5" />
                        <MoreVertical className="h-3.5 w-3.5" />
                      </div>
                    </div>

                    {/* Scrollable Message List / Feed */}
                    <div className="flex-1 overflow-y-auto p-4 relative scrollbar-thin select-none flex flex-col justify-start">
                      {/* WhatsApp wallpaper texture */}
                      <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-repeat bg-center" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }} />

                      {/* Time divider badge */}
                      <div className="mx-auto my-2 px-2.5 py-1 rounded bg-[#d1e8ef]/70 dark:bg-zinc-800 text-[#4a5568] dark:text-zinc-300 text-[8px] font-black uppercase tracking-wider z-10 shadow-sm border border-black/5">
                        Today
                      </div>

                      {/* WhatsApp Bubble Container */}
                      <div className="bg-background dark:bg-zinc-900 rounded-2xl rounded-tl-none shadow-md border border-border/10 p-3.5 relative z-10 max-w-[90%] my-2 animate-in slide-in-from-bottom-2 duration-300">
                        {/* Bubble Tail */}
                        <div className="absolute top-0 -left-1 w-2.5 h-2.5 bg-background dark:bg-zinc-900 border-l border-t border-border/10 -rotate-45" />

                        <div>
                          {/* Header Attachment Rendering */}
                          {selectedTemplate.header?.enabled && (
                            <div className="mb-2.5">
                              {selectedTemplate.header.format === 'TEXT' && selectedTemplate.header.text && (
                                <div className="text-[11px] font-bold text-foreground mb-1">
                                  {getDynamicPreviewText(selectedTemplate.header.text, variables)}
                                </div>
                              )}
                              {selectedTemplate.header.format === 'IMAGE' && (
                                <div className="aspect-[16/9] w-full rounded-xl bg-muted dark:bg-zinc-900 flex flex-col items-center justify-center border border-border/30 mb-2 text-muted-foreground/60">
                                  <ImageIcon className="h-5 w-5 mb-0.5 text-muted-foreground/40" />
                                  <span className="text-[8px] font-black uppercase tracking-wider">Image</span>
                                </div>
                              )}
                              {selectedTemplate.header.format === 'VIDEO' && (
                                <div className="aspect-[16/9] w-full rounded-xl bg-muted dark:bg-zinc-900 flex flex-col items-center justify-center border border-border/30 mb-2 text-muted-foreground/60 relative">
                                  <Video className="h-5 w-5 mb-0.5 text-muted-foreground/40" />
                                  <span className="text-[8px] font-black uppercase tracking-wider">Video</span>
                                </div>
                              )}
                              {selectedTemplate.header.format === 'DOCUMENT' && (
                                <div className="py-2 px-3 rounded-xl bg-muted dark:bg-zinc-900 flex items-center gap-2 border border-border/30 mb-2 text-muted-foreground/75">
                                  <FileIcon className="h-4 w-4 text-primary/70 flex-shrink-0" />
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-[9px] font-bold truncate">document.pdf</span>
                                    <span className="text-[7px] opacity-75 font-semibold">PDF Document</span>
                                  </div>
                                </div>
                              )}
                              {(selectedTemplate.header.format as string) === 'LOCATION' && (
                                <div className="aspect-[16/9] w-full rounded-xl bg-muted dark:bg-zinc-900 flex flex-col items-center justify-center border border-border/30 mb-2 text-muted-foreground/60">
                                  <MapPin className="h-5 w-5 mb-0.5 text-muted-foreground/40" />
                                  <span className="text-[8px] font-black uppercase tracking-wider">Location</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Body Text */}
                          <div className="text-[12px] font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                            {formatBodyTextWithPills(
                              getDynamicPreviewText(selectedTemplate.bodyText || selectedTemplate.body?.text || '', variables)
                            )}
                          </div>

                          {/* Footer Text */}
                          {selectedTemplate.bodyText && selectedTemplate.bodyText.includes('\n\n') && (
                            <div className="text-[8px] text-muted-foreground mt-1.5 font-medium">
                              {selectedTemplate.name}
                            </div>
                          )}

                          {/* Time Stamp */}
                          <div className="text-right text-[8px] text-muted-foreground mt-1 font-semibold">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        {/* WhatsApp Style Buttons */}
                        {selectedTemplate.buttons && selectedTemplate.buttons.items.length > 0 && (
                          <div className="border-t border-border/10 mt-3 pt-1 divide-y divide-border/10">
                            {selectedTemplate.buttons.items.map((btn, i) => (
                              <div
                                key={i}
                                className="py-2 text-[10px] font-bold text-primary hover:bg-primary/5 cursor-pointer flex items-center justify-center gap-1.5 select-none transition-colors border-border/10"
                              >
                                {btn.type === 'URL' && <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />}
                                {btn.type === 'PHONE_NUMBER' && <Phone className="h-3.5 w-3.5 flex-shrink-0" />}
                                {btn.type === 'QUICK_REPLY' && <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0" />}
                                {btn.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Simulated Bottom Message Input Bar */}
                    <div className="bg-[#f0f2f5] dark:bg-zinc-900 px-3 py-2 flex items-center gap-2 border-t border-border/20 shrink-0">
                      <div className="flex-1 bg-white dark:bg-zinc-800 rounded-full px-3 py-1 flex items-center justify-between border border-border/20 shadow-sm">
                        <span className="text-[10px] text-muted-foreground/60">Type a message...</span>
                      </div>
                      <button
                        onClick={handleSend}
                        disabled={sendMutation.isPending || !activeContact || templateVariables.some(v => !variables[v])}
                        className="h-7 w-7 rounded-full bg-[#128c7e] hover:bg-[#0b5c53] active:scale-95 flex items-center justify-center text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        title="Send Official Template"
                      >
                        {sendMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3 fill-white" />
                        )}
                      </button>
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
