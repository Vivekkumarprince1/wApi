"use client";

import React from 'react';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Tag, 
  Calendar, 
  MessageSquare,
  Clock,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  User
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { Contact, fetchContactById, fetchContactFormSubmissions, fetchContacts } from '@/lib/api/contacts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import FlashLoader from '@/components/ui/flash-loader';

export default function ContactProfilePage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: contactData, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const resp = await fetchContactById(String(id));
      return (resp as any).data;
    },
    enabled: !!id
  });

  const { data: formSubmissionData } = useQuery({
    queryKey: ['contact', id, 'form-submissions'],
    queryFn: async () => {
      const resp = await fetchContactFormSubmissions(String(id));
      return (resp as any).data?.data ?? [];
    },
    enabled: !!id,
  });

  const formSubmissions = (formSubmissionData || []) as Array<{
    _id: string;
    flowToken?: string;
    flowId?: string;
    receivedAt?: string;
    data?: Record<string, unknown>;
  }>;

  const contact = contactData as any;

  if (isLoading) return <FlashLoader />;
  if (!contact) return <div className="p-12 text-center font-bold">Contact not found</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">
      {/* Navigation */}
      <div className="flex items-center gap-4">
	        <Button 
	          variant="ghost" 
	          size="icon" 
	          onClick={() => router.back()}
	          aria-label="Back to contacts"
	          className="rounded-xl hover:bg-muted"
	        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground opacity-60">Contact Profile</h2>
          <h1 className="text-2xl font-black tracking-tight text-foreground">{contact.name}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-card border border-border/50 rounded-[32px] p-8 shadow-sm flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 rounded-[32px] border-4 border-background shadow-xl mb-4">
              <AvatarImage src={contact.avatar || contact.avatarUrl} />
              <AvatarFallback className="bg-primary/5 text-primary text-3xl font-black uppercase">
                {contact.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-black text-foreground mb-1">{contact.name}</h3>
            <div className="flex items-center gap-2 mb-6">
              <Badge variant="secondary" className="bg-primary/5 text-primary border-none rounded-lg text-[10px] font-black px-3 h-6 uppercase tracking-widest">
                {contact.leadStatus || 'Lead'}
              </Badge>
            </div>

            <div className="w-full space-y-3">
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-border/20 group hover:border-primary/30 transition-all">
                <div className="h-9 w-9 rounded-xl bg-background flex items-center justify-center text-primary shadow-sm">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Phone</p>
                  <p className="text-sm font-bold truncate">{contact.phone}</p>
                </div>
              </div>

              {contact.metadata?.email && (
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl border border-border/20 group hover:border-primary/30 transition-all">
                  <div className="h-9 w-9 rounded-xl bg-background flex items-center justify-center text-emerald-500 shadow-sm">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Email</p>
                    <p className="text-sm font-bold truncate">{contact.metadata.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-[32px] p-6 shadow-sm space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Tags & Segments</h4>
            <div className="flex flex-wrap gap-2 px-2">
              {contact.tags?.map((tag: string) => (
                <Badge key={tag} className="bg-primary/5 text-primary border-none rounded-xl text-[10px] font-black px-3 h-7 uppercase">
                  {tag}
                </Badge>
              ))}
              {(!contact.tags || contact.tags.length === 0) && (
                <p className="text-sm text-muted-foreground italic px-1 font-medium">No tags assigned</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Stats */}
        <div className="lg:col-span-8 space-y-8">
           {/* Quick Stats */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                 <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-sm">
                    <MessageSquare className="h-6 w-6" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Messages</p>
                    <p className="text-2xl font-black text-foreground">--</p>
                 </div>
              </div>
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                 <div className="h-12 w-12 rounded-2xl bg-emerald-500/5 flex items-center justify-center text-emerald-500 shadow-sm">
                    <TrendingUp className="h-6 w-6" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Deals Value</p>
                    <p className="text-2xl font-black text-foreground">₹0</p>
                 </div>
              </div>
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                 <div className="h-12 w-12 rounded-2xl bg-amber-500/5 flex items-center justify-center text-amber-500 shadow-sm">
                    <Clock className="h-6 w-6" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Last Seen</p>
                    <p className="text-lg font-black text-foreground truncate">Recently</p>
                 </div>
              </div>
           </div>

           {/* Activity timeline: WhatsApp Flow / form submissions */}
           <div className="bg-card border border-border/50 rounded-[32px] overflow-hidden shadow-sm flex flex-col h-full min-h-[400px]">
              <div className="px-8 py-6 border-b border-border/40 bg-muted/10 flex items-center justify-between">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground flex items-center gap-3">
                   <Clock className="h-4 w-4 text-primary" />
                   Activity timeline
                 </h4>
                 <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                   Form submissions
                 </span>
              </div>
              <ScrollArea className="flex-1 max-h-[480px]">
                <div className="p-6 space-y-4">
                  {formSubmissions.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
                      <Calendar className="h-10 w-10 mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium max-w-[320px]">
                        No WhatsApp Flow submissions are linked to this contact yet. Submissions appear here after automation records them.
                      </p>
                    </div>
                  ) : (
                    formSubmissions.map((sub) => (
                      <div
                        key={sub._id}
                        className="rounded-2xl border border-border/40 bg-muted/20 p-4 text-left"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                            Flow
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                            {sub.flowId || sub.flowToken || sub._id}
                          </span>
                        </div>
                        {sub.receivedAt && (
                          <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                            {new Date(sub.receivedAt).toLocaleString()}
                          </p>
                        )}
                        <pre className="text-xs font-mono bg-background/80 rounded-xl p-3 overflow-x-auto border border-border/30 max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(sub.data ?? {}, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
           </div>
        </div>
      </div>
    </div>
  );
}
