"use client";

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
   CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
   DialogFooter
} from "@/components/ui/dialog";
import {
   Webhook,
   Plus,
   Settings2,
   Activity,
   CheckCircle2,
   RefreshCcw,
   Send,
   Lock,
   ChevronRight,
   MoreVertical,
   Play,
   Trash2,
   Zap,
   AlertCircle,
   Smartphone,
   Activity as ActivityIcon
} from "lucide-react";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
   getWhatsappSubscriptions, 
   createWhatsappSubscription, 
   updateWhatsappSubscription,
   deleteWhatsappSubscription 
} from '@/lib/api/settings';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

const EVENT_TYPES = [
   { id: 'MESSAGE', label: 'Message', description: "Incoming messages (text, media, interactive)." },
   { id: 'SENT', label: 'Sent', description: "Confirmation that message was sent to WhatsApp." },
   { id: 'DELIVERED', label: 'Delivered', description: "Message delivered to user device." },
   { id: 'READ', label: 'Read', description: "Message read by the recipient." },
   { id: 'FAILED', label: 'Failed', description: "Message delivery failure alerts." },
   { id: 'DELETED', label: 'Deleted', description: "User deleted a message." },
   { id: 'TEMPLATE', label: 'Template', description: "WhatsApp template status approvals/rejections." },
   { id: 'ACCOUNT', label: 'Account', description: "Business account status changes." },
   { id: 'BILLING', label: 'Billing', description: "Conversation charges and billing events." },
   { id: 'PAYMENTS', label: 'Payments', description: "WhatsApp Payment status updates." },
   { id: 'FLOWS_MESSAGE', label: 'Flows', description: "Interactive flow submission events." },
   { id: 'ENQUEUED', label: 'Enqueued', description: "Message enqueued in provider network." },
   { id: 'OTHERS', label: 'Others', description: "System and miscellaneous events." },
   { id: 'COEXISTENCE', label: 'Coexistence', description: "SMB mobile app echo events (smb_message_echoes)." },
   { id: 'ALL', label: 'All Events', description: "Subscribe to every available trigger." }
];

export default function WebhooksPage() {
   const queryClient = useQueryClient();
   const currentUserRole = useAuthStore((state) => state.user?.role);
   const isSuperAdmin = currentUserRole === 'super_admin';
   const [isAddModalOpen, setIsAddModalOpen] = useState(false);
   const [isEditModalOpen, setIsEditModalOpen] = useState(false);
   const [editingSubscription, setEditingSubscription] = useState<any>(null);
   const [mounted, setMounted] = useState(false);
   const [selectedEvents, setSelectedEvents] = useState<string[]>(['MESSAGE', 'TEMPLATE']);
   const [testTimestamp, setTestTimestamp] = useState<number>(0);

    useEffect(() => {
        setMounted(true);
        setTestTimestamp(Date.now());
    }, []);

   const { data: subsData, isLoading, error } = useQuery({
      queryKey: ['whatsapp-subscriptions'],
      queryFn: () => getWhatsappSubscriptions(),
      retry: (failureCount, error: any) => {
         if (error?.status === 403) return false;
         return failureCount < 2;
      }
   });

   const subscriptions = subsData?.data || [];
   const canManageSubscriptions = isSuperAdmin;
   const policyMeta = (subsData as any)?.meta?.policy;


   const updateMutation = useMutation({
      mutationFn: (data: { subscriptionId: string; events: string[]; tag?: string }) => updateWhatsappSubscription(data),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['whatsapp-subscriptions'] });
         setIsEditModalOpen(false);
         setEditingSubscription(null);
         toast.success("Endpoint updated successfully");
      },
      onError: (err: any) => {
         toast.error(err.message || "Failed to update endpoint");
      }
   });

   const createMutation = useMutation({
      mutationFn: (data: { events: string[] }) => createWhatsappSubscription(data),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['whatsapp-subscriptions'] });
         setIsAddModalOpen(false);
         toast.success("Endpoint added successfully");
      },
      onError: (err: any) => {
         toast.error(err.message || "Failed to add endpoint");
      }
   });


   const deleteMutation = useMutation({
      mutationFn: (id?: string) => deleteWhatsappSubscription(id),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['whatsapp-subscriptions'] });
         toast.success("Endpoint removed");
      },
      onError: (err: any) => {
         toast.error(err.message || "Failed to delete endpoint");
      }
   });

   const toggleEvent = (eventId: string) => {
      if (eventId === 'ALL') {
         setSelectedEvents(prev => prev.includes('ALL') ? [] : ['ALL']);
         return;
      }
      setSelectedEvents(prev => {
         const next = prev.filter(e => e !== 'ALL');
         return next.includes(eventId) ? next.filter(e => e !== eventId) : [...next, eventId];
      });
   };

   const handleOpenAdd = () => {
       setSelectedEvents(['MESSAGE', 'TEMPLATE']);
       setIsAddModalOpen(true);
   };

   const handleOpenEdit = (sub: any) => {
       setEditingSubscription(sub);
       const subEvents = sub.events || sub.modes || [];
       setSelectedEvents(subEvents.map((e: string) => e.toUpperCase()));
       setIsEditModalOpen(true);
   };

   return (
         <div className="flex flex-col gap-8 pb-10">

            {/* Webhooks Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex flex-wrap items-center gap-3">
                  {/* Tunnel Status Badge */}
                  {mounted && (
                     <div className={`px-4 py-2 rounded-xl flex items-center gap-2 border ${
                        window.location.protocol === 'https:' 
                           ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                           : (subsData as any)?.meta?.hasSecureTunnel
                              ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                     }`}>
                        <div className={`h-2 w-2 rounded-full animate-pulse ${
                           window.location.protocol === 'https:' || (subsData as any)?.meta?.hasSecureTunnel
                              ? 'bg-current'
                              : 'bg-amber-500'
                        }`} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                           {window.location.protocol === 'https:' 
                              ? 'Secure Connection' 
                              : (subsData as any)?.meta?.hasSecureTunnel 
                                 ? 'Smart Tunnel Active' 
                                 : 'Insecure (HTTPS Required)'}
                        </span>
                     </div>
                  )}

                  <h1 className="text-3xl font-black tracking-tight uppercase">Developer Webhooks</h1>
                  <p className="text-muted-foreground flex items-center gap-2 font-medium">
                     <Webhook className="h-4 w-4" /> Configure endpoints for real-time notifications. {(subsData as any)?.meta?.hasSecureTunnel && <span className="text-[10px] bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-lg border border-indigo-500/20">Using {new URL((subsData as any).meta.suggestedWebhookUrl).hostname}</span>}
                  </p>
               </div>
               <div className="flex flex-wrap gap-2">

                  {subscriptions.length > 0 && canManageSubscriptions && (
                     <Button 
                        variant="ghost"
                        onClick={() => {
                           if (window.confirm("Are you sure you want to remove ALL webhook endpoints?")) {
                              deleteMutation.mutate(undefined);
                           }
                        }}
                        disabled={deleteMutation.isPending}
                        className="rounded-xl text-red-500 hover:bg-red-500/10 font-black uppercase tracking-widest text-[10px] h-11 px-6"
                     >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Clear All
                     </Button>
                  )}

                  {canManageSubscriptions && (
                  <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                     <DialogTrigger asChild>
                        <Button 
                           onClick={handleOpenAdd}
                           className="bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-lg shadow-primary/20 h-11 px-6 rounded-xl uppercase tracking-widest text-[10px]"
                        >
                           <Plus className="h-4 w-4 mr-2" />
                           Add Endpoint
                        </Button>
                     </DialogTrigger>
                     <DialogContent className="sm:max-w-[500px] border-none bg-background/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl p-0 overflow-hidden">
                        <DialogHeader className="p-10 pb-4">
                           <DialogTitle className="text-2xl font-black uppercase tracking-tight">Add Webhook</DialogTitle>
                           <p className="text-sm text-muted-foreground font-medium">Configure a new endpoint for platform events.</p>
                        </DialogHeader>
                        <div className="p-10 pt-0 space-y-8">

                           <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                 <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Select Event Types</Label>
                                 <Badge 
                                    variant="outline" 
                                    onClick={() => toggleEvent('ALL')}
                                    className={`cursor-pointer border-none text-[9px] font-black uppercase px-2 py-1 rounded-lg transition-colors ${selectedEvents.includes('ALL') ? 'bg-primary text-primary-foreground' : 'bg-accent/20 text-muted-foreground'}`}
                                 >
                                    {selectedEvents.includes('ALL') ? 'All Selected' : 'Select All'}
                                 </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                                 {EVENT_TYPES.filter(ev => ev.id !== 'ALL').map((ev) => (
                                    <div 
                                       key={ev.id} 
                                       className={`flex items-start gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                                          selectedEvents.includes(ev.id) || selectedEvents.includes('ALL')
                                             ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' 
                                             : 'bg-accent/5 border-border/10 hover:bg-accent/10'
                                       }`} 
                                       onClick={() => toggleEvent(ev.id)}
                                    >
                                       <Checkbox 
                                          id={ev.id} 
                                          checked={selectedEvents.includes(ev.id) || selectedEvents.includes('ALL')}
                                          disabled={selectedEvents.includes('ALL') && ev.id !== 'ALL'}
                                          className="mt-0.5 h-3.5 w-3.5 border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                       />
                                       <div className="flex flex-col gap-0.5">
                                          <Label className="text-[10px] font-black tracking-tight cursor-pointer uppercase">{ev.label}</Label>
                                          <span className="text-[8px] text-muted-foreground font-medium leading-tight">{ev.description}</span>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                        <DialogFooter className="p-8 bg-accent/10 flex sm:justify-between items-center gap-4">
                           <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter hidden sm:block max-w-[200px]">
                              * Resilience mode automatically trials Path and Schema variations.
                           </p>
                           <div className="flex gap-3">
                              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="rounded-xl font-bold text-xs uppercase tracking-widest">Cancel</Button>
                              <Button 
                                 onClick={() => createMutation.mutate({ events: selectedEvents })}
                                 disabled={createMutation.isPending || selectedEvents.length === 0}
                                 className="bg-slate-900 border-none hover:bg-slate-800 text-white font-black h-11 rounded-xl px-8 shadow-lg shadow-slate-900/20 uppercase tracking-widest text-[10px]"
                              >
                                 {createMutation.isPending ? "Creating..." : "Save Endpoint"}
                              </Button>
                           </div>
                        </DialogFooter>
                     </DialogContent>
                  </Dialog>
                  )}

                  {/* Edit Endpoint Dialog */}
                  {canManageSubscriptions && (
                  <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                     <DialogContent className="sm:max-w-[500px] border-none bg-background/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl p-0 overflow-hidden">
                        <DialogHeader className="p-10 pb-4">
                           <DialogTitle className="text-2xl font-black uppercase tracking-tight">Edit Webhook</DialogTitle>
                           <p className="text-sm text-muted-foreground font-medium">Update endpoint configuration and events.</p>
                        </DialogHeader>
                        <div className="p-10 pt-0 space-y-8">

                           <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                 <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Select Event Types</Label>
                                 <Badge 
                                    variant="outline" 
                                    onClick={() => toggleEvent('ALL')}
                                    className={`cursor-pointer border-none text-[9px] font-black uppercase px-2 py-1 rounded-lg transition-colors ${selectedEvents.includes('ALL') ? 'bg-primary text-primary-foreground' : 'bg-accent/20 text-muted-foreground'}`}
                                 >
                                    {selectedEvents.includes('ALL') ? 'All Selected' : 'Select All'}
                                 </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                                 {EVENT_TYPES.filter(ev => ev.id !== 'ALL').map((ev) => (
                                    <div 
                                       key={ev.id} 
                                       className={`flex items-start gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                                          selectedEvents.includes(ev.id) || selectedEvents.includes('ALL')
                                             ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' 
                                             : 'bg-accent/5 border-border/10 hover:bg-accent/10'
                                       }`} 
                                       onClick={() => toggleEvent(ev.id)}
                                    >
                                       <Checkbox 
                                          id={ev.id} 
                                          checked={selectedEvents.includes(ev.id) || selectedEvents.includes('ALL')}
                                          disabled={selectedEvents.includes('ALL') && ev.id !== 'ALL'}
                                          className="mt-0.5 h-3.5 w-3.5 border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                       />
                                       <div className="flex flex-col gap-0.5">
                                          <Label className="text-[10px] font-black tracking-tight cursor-pointer uppercase">{ev.label}</Label>
                                          <span className="text-[8px] text-muted-foreground font-medium leading-tight">{ev.description}</span>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                        <DialogFooter className="p-8 bg-accent/10 flex sm:justify-between items-center gap-4">
                           <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter hidden sm:block max-w-[200px]">
                              * V3 configuration updates take effect within 60 seconds.
                           </p>
                           <div className="flex gap-3">
                              <Button variant="ghost" onClick={() => setIsEditModalOpen(false)} className="rounded-xl font-bold text-xs uppercase tracking-widest">Cancel</Button>
                              <Button 
                                 onClick={() => updateMutation.mutate({ 
                                    subscriptionId: editingSubscription?.id, 
                                    events: selectedEvents,
                                    tag: editingSubscription?.tag
                                 })}
                                 disabled={updateMutation.isPending || selectedEvents.length === 0}
                                 className="bg-primary border-none hover:bg-primary/90 text-primary-foreground font-black h-11 rounded-xl px-8 shadow-lg shadow-primary/20 uppercase tracking-widest text-[10px]"
                              >
                                 {updateMutation.isPending ? "Updating..." : "Update Endpoint"}
                              </Button>
                           </div>
                        </DialogFooter>
                     </DialogContent>
                  </Dialog>
                  )}
               </div>
            </div>

            {!canManageSubscriptions && (
               <Card className="border-none bg-amber-500/10 ring-1 ring-amber-500/20 rounded-[1.5rem]">
                  <CardContent className="p-5 flex items-start gap-3">
                     <Lock className="h-4 w-4 mt-0.5 text-amber-600" />
                     <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Read-Only Access</p>
                        <p className="text-xs text-amber-800/90 font-medium leading-relaxed">
                           Webhook configuration and subscription management are restricted to Super Admin. You can only view status based on assigned policy.
                        </p>
                     </div>
                  </CardContent>
               </Card>
            )}

            {policyMeta?.webhookEnabled === false && (
               <Card className="border-none bg-red-500/10 ring-1 ring-red-500/20 rounded-[1.5rem]">
                  <CardContent className="p-5 flex items-start gap-3">
                     <AlertCircle className="h-4 w-4 mt-0.5 text-red-600" />
                     <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-700">Policy Disabled</p>
                        <p className="text-xs text-red-800/90 font-medium leading-relaxed">
                           Subscriptions are currently disabled by Super Admin policy. Existing endpoints may remain visible but cannot be modified.
                        </p>
                     </div>
                  </CardContent>
               </Card>
            )}

            {error && (
               <Card className="border-none bg-red-500/10 ring-1 ring-red-500/20 rounded-[1.5rem]">
                  <CardContent className="p-5 flex items-start gap-3">
                     <AlertCircle className="h-4 w-4 mt-0.5 text-red-600" />
                     <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-700">Unable To Load Webhooks</p>
                        <p className="text-xs text-red-800/90 font-medium leading-relaxed">
                           {(error as any)?.message || 'The subscription status service is unavailable right now.'}
                        </p>
                     </div>
                  </CardContent>
               </Card>
            )}

            {/* Payload Signing Insight */}
            <Card className="border-none bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group rounded-[2rem]">
               <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Lock className="h-24 w-24" />
               </div>
               <CardContent className="p-8">
                  <div className="max-w-2xl">
                     <h3 className="text-xl font-black mb-2 flex items-center gap-2 uppercase tracking-tight">
                        <CheckCircle2 className="h-6 w-6" /> Security & Signing
                     </h3>
                     <p className="text-sm font-bold opacity-90 leading-relaxed mb-6">
                        Verify the authenticity of incoming webhooks using our payload signing. All requests include an <code>x-wapi-signature</code> HMAC SHA256 header.
                     </p>
                     <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none font-bold text-[10px] uppercase tracking-widest h-10 px-6 rounded-xl">
                        View Signing Secret
                     </Button>
                  </div>
               </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

               {/* Webhooks Endpoints List */}
               <div className="lg:col-span-2 space-y-6">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Live Endpoints</h2>
                  <div className="grid grid-cols-1 gap-4">
                     {isLoading ? (
                        <div className="flex items-center justify-center p-20 bg-accent/5 rounded-[2rem] border border-dashed border-border/50">
                           <RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground/30" />
                        </div>
                      ) : (subscriptions.length === 0) ? (
                        <div className="flex flex-col items-center justify-center p-20 bg-accent/5 rounded-[2rem] border border-dashed border-border/50 text-center space-y-4">
                           <ActivityIcon className="h-12 w-12 text-muted-foreground/20" />
                           <div className="space-y-1">
                              <p className="text-sm font-black uppercase tracking-tight text-muted-foreground">No active endpoints found</p>
                              <p className="text-[10px] text-muted-foreground/60 max-w-[200px] mx-auto font-medium leading-relaxed">
                                 Add a new endpoint to begin receiving real-time platform events.
                              </p>
                           </div>
                           <Button 
                              onClick={handleOpenAdd}
                              variant="outline"
                              className="rounded-xl border-dashed font-black uppercase tracking-widest text-[10px]"
                              disabled={!canManageSubscriptions}
                           >
                              <Plus className="h-3.5 w-3.5 mr-2" />
                              {canManageSubscriptions ? 'Configure Now' : 'Super Admin Required'}
                           </Button>
                        </div>
                     ) : (
                        subscriptions.map((hook: any) => (
                           <Card key={hook.id} className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl group hover:shadow-lg transition-all rounded-[1.5rem] overflow-hidden">
                              <CardContent className="p-6">
                                 <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-start gap-4 flex-1 overflow-hidden">
                                       <div className="h-12 w-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
                                          <Activity className="h-6 w-6" />
                                       </div>
                                       <div className="space-y-1 overflow-hidden">
                                          <h3 className="font-black text-sm tracking-tight truncate">{hook.url}</h3>
                                          <div className="flex items-center gap-2">
                                             <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] font-black uppercase tracking-widest px-2">V3 ACTIVE</Badge>
                                             <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                                <ActivityIcon className="h-3 w-3" /> Successfully synchronized
                                             </span>
                                          </div>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                       {canManageSubscriptions && (
                                       <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          onClick={() => deleteMutation.mutate(hook.id)}
                                          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                       >
                                          <Trash2 className="h-4 w-4" />
                                       </Button>
                                       )}
                                       {canManageSubscriptions && (
                                       <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                             <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical className="h-4 w-4" />
                                             </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-2xl bg-background/80 backdrop-blur-xl border-none ring-1 ring-border/50">
                                             <DropdownMenuItem 
                                                onClick={() => handleOpenEdit(hook)}
                                                className="font-black text-[10px] py-3 rounded-lg uppercase tracking-widest cursor-pointer"
                                             >
                                                Edit Settings
                                             </DropdownMenuItem>
                                             <DropdownMenuItem className="font-black text-[10px] py-3 rounded-lg uppercase tracking-widest cursor-pointer">Debug Payload</DropdownMenuItem>
                                          </DropdownMenuContent>
                                       </DropdownMenu>
                                          )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2 pt-4 border-t border-border/10">
                                     {hook.events?.length > 0 ? (
                                        hook.events.map((ev: string) => (
                                           <Badge key={ev} className="bg-slate-100 text-slate-600 border-none font-bold text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-lg">
                                              {ev}
                                           </Badge>
                                        ))
                                     ) : (
                                        <span className="text-[10px] text-muted-foreground font-medium italic">No events subscribed</span>
                                     )}
                                  </div>
                              </CardContent>
                           </Card>
                        ))
                     )}
                  </div>
               </div>

               {/* Event Tester Sidebar */}
               <Card className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl h-fit border-t-4 border-t-indigo-600 rounded-[2rem] overflow-hidden sticky top-24">
                  <CardHeader className="p-8">
                     <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-tight">
                        <Play className="h-5 w-5 text-indigo-600" />
                        Payload Tester
                     </CardTitle>
                     <CardDescription className="text-xs font-medium">Verify your endpoint receives the correct structure.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-6">
                     <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Endpoint</p>
                        <div className="relative group">
                           <Input 
                              value={subscriptions[0]?.url || "No active endpoint"} 
                              className="pr-10 h-11 border-border/50 bg-accent/20 font-bold text-[10px] rounded-xl text-muted-foreground" 
                              readOnly 
                           />
                           <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                        </div>
                     </div>

                     <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Event Type</p>
                        <select className="w-full h-11 bg-accent/20 border-border/50 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-600/20 appearance-none">
                           {EVENT_TYPES.map(ev => (
                              <option key={ev.id} value={ev.id}>{ev.label}</option>
                           ))}
                        </select>
                     </div>

                     <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">V3 Schema Preview</p>
                        <div className="bg-slate-950 rounded-2xl p-5 font-mono text-[9px] text-indigo-400 overflow-hidden shadow-inner border border-white/5">
                           <pre>
                              {`{
  "type": "message",
  "appId": "${subscriptions[0]?.appId || '...'}",
  "timestamp": ${testTimestamp || '...'},
  "version": "v3",
  "payload": {
    "id": "msg_12345",
    "text": "Hello World!"
  }
}`}
                           </pre>
                        </div>
                     </div>

                     <Button className="w-full bg-slate-900 border-none text-white font-black h-12 rounded-xl shadow-lg hover:shadow-indigo-500/10 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]">
                        <Send className="h-4 w-4" />
                        Send Test Trigger
                     </Button>
                  </CardContent>
               </Card>

            </div>

         </div>
   );
}
