"use client";

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Smartphone, 
  MessageSquare, 
  Info, 
  MapPin, 
  Globe, 
  Mail, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle,
  RefreshCcw,
  Camera,
  Store,
  ChevronRight,
   Webhook
} from "lucide-react";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWhatsappProfile, syncWhatsappProfile, updateWhatsappDisplayName, updateWhatsappProfile } from '@/lib/api/settings';
import { toast } from 'sonner';

type WhatsAppProfileState = {
   displayName: string;
   description: string;
   address: string;
   email: string;
   websites: string[];
   vertical: string;
   status: string;
   quality: string;
   limit: string;
};

const EMPTY_PROFILE: WhatsAppProfileState = {
   displayName: '',
   description: '',
   address: '',
   email: '',
   websites: [],
   vertical: 'PROFESSIONAL_SERVICES',
   status: 'DISCONNECTED',
   quality: 'UNKNOWN',
   limit: 'UNKNOWN',
};

const BUSINESS_CATEGORY_OPTIONS = [
   'AUTOMOTIVE',
   'BEAUTY_SPA_SALON',
   'CLOTHING_APPAREL',
   'EDUCATION',
   'ENTERTAINMENT',
   'EVENT_PLANNING_SERVICE',
   'FINANCE_BANK',
   'FOOD_GROCERY',
   'HOTEL_LODGING',
   'MEDICAL_HEALTH',
   'NON_PROFIT',
   'PROFESSIONAL_SERVICES',
   'RETAIL',
   'SHOPPING_RETAIL',
   'TRAVEL_TRANSPORTATION',
].sort();

function normalizeVertical(value: string) {
   const raw = String(value || '').trim();
   if (!raw) return 'PROFESSIONAL_SERVICES';
   return raw.replace(/\s+/g, '_').toUpperCase();
}

function normalizeProfile(raw: any): WhatsAppProfileState {
   return {
      displayName: raw?.displayName || '',
      description: raw?.description || '',
      address: raw?.address || '',
      email: raw?.email || '',
      websites: Array.isArray(raw?.websites) ? raw.websites.filter(Boolean) : [],
      vertical: raw?.vertical || 'PROFESSIONAL_SERVICES',
      status: raw?.status || 'DISCONNECTED',
      quality: raw?.quality || 'UNKNOWN',
      limit: raw?.limit || 'UNKNOWN',
   };
}

export default function WhatsAppProfilePage() {
  const queryClient = useQueryClient();
   const [profile, setProfile] = useState<WhatsAppProfileState>(EMPTY_PROFILE);

  const { data: savedProfile, isLoading } = useQuery({
    queryKey: ['whatsapp-profile'],
    queryFn: async () => {
      const res = await getWhatsappProfile();
      return res || null;
    },
  });

  React.useEffect(() => {
    if (savedProfile) {
      setProfile(normalizeProfile(savedProfile));
    }
  }, [savedProfile]);

  const updateMutation = useMutation({
      mutationFn: () => updateWhatsappProfile({
         description: profile.description,
         address: profile.address,
         email: profile.email,
         vertical: normalizeVertical(profile.vertical),
         websites: Array.isArray(profile.websites) ? profile.websites.filter(Boolean) : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-profile'] });
      toast.success("Profile updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
    }
  });

   const displayNameMutation = useMutation({
      mutationFn: () => updateWhatsappDisplayName(profile.displayName),
      onSuccess: (res: any) => {
         queryClient.invalidateQueries({ queryKey: ['whatsapp-profile'] });
         toast.success(res?.message || 'Display name update sent');
      },
      onError: (error: any) => {
         toast.error(error.message || 'Failed to update display name');
      }
   });

   const syncMutation = useMutation({
      mutationFn: () => syncWhatsappProfile(),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['whatsapp-profile'] });
         toast.success("Synced latest profile from Meta/Gupshup");
      },
      onError: (error: any) => {
         toast.error(error.message || "Failed to sync profile");
      }
  });

   return (
         <div className="flex flex-col gap-8 pb-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight uppercase">WhatsApp Profile</h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2">
              <Store className="h-4 w-4" /> Manage how your business appears to customers on WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-3">
             <Button
               variant="outline"
               onClick={() => syncMutation.mutate()}
               disabled={syncMutation.isPending}
               className="border-border/50 h-11 text-xs font-bold uppercase tracking-widest px-6 flex items-center gap-2"
             >
                <RefreshCcw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {syncMutation.isPending ? 'Syncing...' : 'Sync from Meta'}
             </Button>
             <Button 
               disabled={updateMutation.isPending || isLoading}
               onClick={() => updateMutation.mutate()}
               className="bg-slate-900 border-none hover:bg-slate-800 text-white font-bold h-11 rounded-xl px-8 shadow-lg shadow-slate-900/20 transition-all active:scale-95"
             >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Editor */}
          <div className="lg:col-span-12 xl:col-span-8 space-y-8">
            
            {/* Status & Health Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {[
                 { label: 'Connection', value: profile.status, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                 { label: 'Quality Rating', value: profile.quality, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-500/10' },
                 { label: 'Messaging Limit', value: profile.limit, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-500/10' },
               ].map((item) => (
                 <Card key={item.label} className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl shadow-sm overflow-hidden group">
                   <CardContent className="p-5 flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center`}>
                         <item.icon className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</span>
                         <span className="text-sm font-black tracking-tight">{item.value}</span>
                      </div>
                   </CardContent>
                 </Card>
               ))}
            </div>

            <Card className="border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-10 pb-0 space-y-2">
                 <CardTitle className="text-2xl font-black uppercase tracking-tight">Business Profile Info</CardTitle>
                 <CardDescription className="text-sm font-medium">Standard information synchronized with your WhatsApp Business Account.</CardDescription>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                 <div className="flex flex-col md:flex-row items-center gap-10 bg-accent/20 p-8 rounded-3xl border border-border/50">
                    <div className="relative group">
                       <div className="h-32 w-32 rounded-[2rem] bg-slate-900 flex items-center justify-center text-white font-black text-3xl shadow-2xl relative overflow-hidden">
                          WS
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                             <Camera className="h-8 w-8 text-white" />
                          </div>
                       </div>
                    </div>
                    <div className="flex-1 space-y-2">
                       <h3 className="text-lg font-black tracking-tight">Profile Picture</h3>
                       <p className="text-xs text-muted-foreground font-medium leading-relaxed max-w-sm">
                          Use a clear logo or brand image. WhatsApp recommends a 640x640px image.
                       </p>
                       <div className="space-y-3 pt-2 max-w-md">
                          <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                             <Store className="h-3.5 w-3.5" /> Display Name
                          </label>
                          <div className="flex gap-2">
                             <Input
                               value={profile.displayName || ''}
                               placeholder="Enter display name"
                               className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary shadow-inner font-medium"
                               onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                             />
                             <Button
                               onClick={() => displayNameMutation.mutate()}
                               disabled={displayNameMutation.isPending || !profile.displayName.trim()}
                               className="h-12 rounded-xl px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                             >
                               {displayNameMutation.isPending ? 'Saving...' : 'Save Name'}
                             </Button>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                       <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Store className="h-3.5 w-3.5" /> Business Description
                       </label>
                       <Textarea 
                         placeholder="Describe your business..." 
                         className="min-h-[120px] rounded-2xl bg-accent/20 border-none focus-visible:ring-primary shadow-inner font-medium p-4"
                         value={profile.description || ''}
                         onChange={(e) => setProfile({...profile, description: e.target.value})}
                       />
                       <p className="text-[10px] text-muted-foreground font-bold italic ml-1">Visible to customers in the business profile.</p>
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-3">
                          <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                             <MapPin className="h-3.5 w-3.5" /> Business Address
                          </label>
                          <Input 
                            value={profile.address || ''} 
                            placeholder="Enter physical address" 
                            className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary shadow-inner font-medium" 
                            onChange={(e) => setProfile({...profile, address: e.target.value})}
                          />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                             <Globe className="h-3.5 w-3.5" /> Websites
                          </label>
                          <Input 
                            value={profile.websites?.[0] || ''} 
                            placeholder="https://yourwebsite.com" 
                            className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary shadow-inner font-medium" 
                            onChange={(e) => setProfile({...profile, websites: [e.target.value]})}
                          />
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-3">
                       <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" /> Business Email
                       </label>
                       <Input 
                         value={profile.email || ''} 
                         type="email" 
                         placeholder="hello@yourbusiness.com" 
                         className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary shadow-inner font-medium" 
                         onChange={(e) => setProfile({...profile, email: e.target.value})}
                       />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Info className="h-3.5 w-3.5" /> Business Category
                       </label>
                                  <Input
                                     list="business-category-options"
                                     value={profile.vertical || ''}
                                     placeholder="PROFESSIONAL_SERVICES"
                                     className="h-12 rounded-xl bg-accent/20 border-none focus-visible:ring-primary shadow-inner font-medium uppercase tracking-wide"
                                     onChange={(e) => setProfile({ ...profile, vertical: normalizeVertical(e.target.value) })}
                                  />
                                  <datalist id="business-category-options">
                                     {BUSINESS_CATEGORY_OPTIONS.map((category) => (
                                        <option key={category} value={category} />
                                     ))}
                                  </datalist>
                                  <p className="text-[9px] text-muted-foreground font-bold ml-1 uppercase tracking-tighter">Saved to business info and synced to Meta via Gupshup</p>
                    </div>
                 </div>
              </CardContent>
            </Card>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 flex items-start gap-4">
               <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
               <div className="space-y-1">
                  <h4 className="font-black text-amber-900 tracking-tight">Display Name Review</h4>
                  <p className="text-sm text-amber-800/80 font-medium leading-relaxed">
                     Changing your Display Name requires an official review by Meta. Your status may temporarily change to "Review" and messaging capability might be limited during this period.
                  </p>
               </div>
            </div>

            {/* Webhook Management Shortcut */}
            <Card className="border-none ring-1 ring-border/50 bg-indigo-50/50 backdrop-blur-3xl shadow-xl rounded-[2.5rem] overflow-hidden border-t-4 border-t-indigo-600">
               <CardContent className="p-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-start gap-4 flex-1">
                     <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20">
                        <Webhook className="h-6 w-6" />
                     </div>
                     <div className="space-y-1">
                        <h3 className="text-xl font-black uppercase tracking-tight">Technical Webhooks</h3>
                        <p className="text-sm text-muted-foreground font-medium max-w-md">
                           Manage your API endpoints, payload signing, and real-time synchronization in the Developer Hub.
                        </p>
                     </div>
                  </div>
                  <Button 
                     onClick={() => window.location.href = '/settings/developer/webhooks'}
                     className="bg-slate-900 border-none hover:bg-slate-800 text-white font-black h-12 rounded-xl px-8 shadow-lg shadow-slate-900/20 transition-all uppercase tracking-widest text-[10px]"
                  >
                     Manage in Developer Hub <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
               </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Mockup */}
          <div className="lg:col-span-12 xl:col-span-4 flex justify-center">
             <div className="sticky top-10 w-full max-w-[360px]">
                <div className="relative mx-auto border-8 border-slate-900 rounded-[3rem] h-[680px] w-full shadow-2xl overflow-hidden bg-white group">
                   {/* Notch */}
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-slate-900 rounded-b-2xl z-20" />
                   
                   {/* Status Bar */}
                   <div className="h-12 bg-slate-900 pt-6 px-6 flex justify-between items-center text-white">
                      <span className="text-xs font-bold">15:19</span>
                      <div className="flex items-center gap-1.5 opacity-80">
                         <div className="h-2 w-4 bg-white/40 rounded-sm" />
                         <div className="h-3 w-5 border border-white/40 rounded-sm" />
                      </div>
                   </div>

                   {/* WhatsApp Header */}
                   <div className="h-20 bg-[#075E54] flex items-center px-6 gap-4 text-white shadow-lg">
                      <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center font-black">WS</div>
                      <div className="flex flex-col">
                         <span className="font-bold text-sm tracking-tight">{profile.displayName}</span>
                         <span className="text-[10px] opacity-80 font-medium">Business Account</span>
                      </div>
                   </div>

                   {/* Profile Content */}
                   <div className="p-6 space-y-6 bg-slate-50 h-full overflow-y-auto pb-40">
                      <div className="space-y-2">
                         <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">About</h4>
                         <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white p-4 rounded-2xl shadow-sm italic">
                            {profile.description || "No description set..."}
                         </p>
                      </div>

                      <div className="space-y-3">
                         <div className="flex items-start gap-4 bg-white p-4 rounded-2xl shadow-sm">
                            <MapPin className="h-4 w-4 text-emerald-600 mt-0.5" />
                            <span className="text-[11px] font-bold text-slate-600">{profile.address || "Address not set"}</span>
                         </div>
                         <div className="flex items-start gap-4 bg-white p-4 rounded-2xl shadow-sm">
                            <Mail className="h-4 w-4 text-emerald-600 mt-0.5" />
                            <span className="text-[11px] font-bold text-slate-600">{profile.email || "Email not set"}</span>
                         </div>
                         <div className="flex items-start gap-4 bg-white p-4 rounded-2xl shadow-sm">
                            <Globe className="h-4 w-4 text-emerald-600 mt-0.5" />
                            <span className="text-[11px] font-bold text-slate-600">{profile.websites[0] || "Website not set"}</span>
                         </div>
                         <div className="flex items-start gap-4 bg-white p-4 rounded-2xl shadow-sm">
                            <Store className="h-4 w-4 text-emerald-600 mt-0.5" />
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">{profile.vertical}</span>
                         </div>
                      </div>

                      <div className="pt-6">
                         <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-black py-6 rounded-2xl flex items-center justify-center gap-2 text-sm shadow-xl shadow-[#25D366]/20">
                            <MessageSquare className="h-5 w-5" /> Message Business
                         </Button>
                      </div>
                   </div>

                   {/* Mockup Overlay Label */}
                   <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900 rounded-full text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Smartphone className="h-3 w-3" /> Live Mobile Preview
                   </div>
                </div>
             </div>
          </div>
        </div>

         </div>
  );
}

