"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  ShoppingBag, 
  FileSpreadsheet, 
  MessageSquare, 
  Zap, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  RefreshCcw,
  ShieldCheck,
  Code,
  Search,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PetpoojaConnectModal } from "@/components/integrations/PetpoojaConnectModal";
import { GoogleSheetsConfigModal } from "@/components/integrations/GoogleSheetsConfigModal";
import { UtensilsCrossed } from "lucide-react";
import { getIntegrations, syncIntegration } from '@/lib/api/integrations';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const INTEGRATIONS_METADATA = [
  { 
    id: "shopify", 
    name: "Shopify", 
    description: "Sync orders, customers, and abandoned carts to WhatsApp.", 
    icon: ShoppingBag, 
    color: "text-emerald-500", 
    bgColor: "bg-emerald-500/10",
    category: "E-Commerce",
    isComingSoon: true
  },
  { 
    id: "petpooja", 
    name: "Petpooja POS", 
    description: "Official restaurant POS integration. Sync orders and send digital bills.", 
    icon: UtensilsCrossed, 
    color: "text-orange-500", 
    bgColor: "bg-orange-500/10",
    category: "F&B / Retail"
  },
  { 
    id: "google_sheets", 
    name: "Google Sheets", 
    description: "Trigger WhatsApp messages from new rows in your spreadsheets.", 
    icon: FileSpreadsheet, 
    color: "text-green-600", 
    bgColor: "bg-green-500/10",
    category: "Productivity"
  },
  { 
    id: "meta_ads", 
    name: "Meta Lead Ads", 
    description: "Automatically trigger messages when a new lead is captured.", 
    icon: MessageSquare, 
    color: "text-blue-600", 
    bgColor: "bg-blue-500/10",
    category: "Marketing",
    isComingSoon: true
  },
  { 
    id: "woocommerce", 
    name: "WooCommerce", 
    description: "Native integration for WordPress e-commerce stores.", 
    icon: ShoppingBag, 
    color: "text-purple-600", 
    bgColor: "bg-purple-500/10",
    category: "E-Commerce",
    isComingSoon: true
  },
  { 
    id: "zapier", 
    name: "Zapier", 
    description: "Connect WhatsApp to 5,000+ apps in your stack.", 
    icon: Zap, 
    color: "text-orange-500", 
    bgColor: "bg-orange-500/10",
    category: "Automation",
    isComingSoon: true
  }
];

const CATEGORIES = ['All Apps', 'E-Commerce', 'Marketing', 'Automation', 'Productivity', 'F&B / Retail'];

export default function IntegrationsPage() {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Apps');

  const fetchIntegrations = async () => {
    try {
      const resp = await getIntegrations();
      setIntegrations(resp.integrations || []);
    } catch (err) {
      console.error("Failed to fetch integrations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleConnect = (id: string) => {
    setActiveModal(id);
  };

  const handleManualSync = async (type: string) => {
    setSyncingId(type);
    const toastId = toast.loading(`Initiating ${type} sync...`);
    try {
      const resp = await syncIntegration(type);
      toast.success(resp.message || "Sync completed!", { id: toastId });
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err.message || "Sync failed", { id: toastId });
    } finally {
      setSyncingId(null);
    }
  };

  const filteredApps = useMemo(() => {
    return INTEGRATIONS_METADATA.filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           app.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All Apps' || app.category === selectedCategory;
      return matchesSearch && matchesCategory;
    }).map(app => {
      const active = integrations.find(i => i.type === app.id);
      return { ...app, active };
    });
  }, [searchQuery, selectedCategory, integrations]);

  return (
    <div className="flex flex-col gap-8 pb-10">
      
      {/* Modals */}
      <PetpoojaConnectModal 
        isOpen={activeModal === 'petpooja'} 
        onClose={() => setActiveModal(null)}
        onSuccess={fetchIntegrations}
      />
      <GoogleSheetsConfigModal 
        isOpen={activeModal === 'google_sheets'} 
        onClose={() => setActiveModal(null)}
        onSuccess={fetchIntegrations}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter uppercase transition-all hover:tracking-widest cursor-default">Integrations</h1>
          <p className="text-muted-foreground font-medium max-w-md">
            The nerve center for your data. Connect your ecosystem to automate engagement.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-64 md:w-80 group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
             <Input 
                placeholder="Search integrations..." 
                className="pl-11 h-12 bg-background/50 border-border/50 rounded-2xl focus-visible:ring-primary/20 transition-all font-bold text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
          <Button asChild variant="outline" className="border-border/50 h-12 text-[10px] font-black uppercase tracking-widest px-6 shadow-sm hover:bg-accent/50 transition-all rounded-2xl whitespace-nowrap">
             <Link href="/settings/developer">
                <Code className="h-4 w-4 mr-2" /> Custom Apps
             </Link>
          </Button>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide py-1">
         {CATEGORIES.map((cat) => (
           <Badge 
             key={cat} 
             onClick={() => setSelectedCategory(cat)}
             className={`h-10 px-6 rounded-2xl font-black text-[9px] uppercase tracking-[0.15em] border-none cursor-pointer whitespace-nowrap transition-all duration-300 active:scale-95 ${
               selectedCategory === cat 
                 ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/20' 
                 : 'bg-accent/40 text-muted-foreground/70 hover:bg-accent hover:text-foreground hover:shadow-md'
             }`}
           >
              {cat}
           </Badge>
         ))}
      </div>

      {/* App Grid */}
      {loading ? (
        <div className="h-96 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {filteredApps.map((app) => (
             <Card key={app.id} className={`group border-none ring-1 ring-border/50 bg-background/50 backdrop-blur-xl shadow-lg hover:shadow-2xl hover:ring-primary/30 transition-all duration-500 relative overflow-hidden rounded-[2.5rem] ${
               app.isComingSoon ? 'opacity-60 pointer-events-none' : ''
             }`}>
                {app.active && (
                  <div className="absolute top-6 right-6 h-9 w-9 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 z-10 animate-in zoom-in slide-in-from-top-4 duration-700">
                     <CheckCircle2 className="h-5 w-5" />
                  </div>
                )}
  
                <CardContent className="p-10">
                   <div className={`h-22 w-22 rounded-[2rem] ${app.bgColor} flex items-center justify-center ${app.color} mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner relative overflow-hidden`}>
                      <app.icon className="h-11 w-11 relative z-10" />
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute -bottom-4 -right-4 h-12 w-12 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                   </div>
                   
                   <div className="space-y-4 mb-10">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">{app.category}</span>
                         {app.isComingSoon && <Badge variant="secondary" className="bg-slate-500/10 text-slate-500 border-none font-black text-[8px] uppercase tracking-widest px-2.5 h-5">Beta</Badge>}
                      </div>
                      <h3 className="text-3xl font-black tracking-tighter group-hover:text-primary transition-colors">{app.name}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed font-semibold opacity-80 min-h-[60px]">
                         {app.description}
                      </p>
                   </div>
  
                   {app.active && (
                      <div className="mb-8 p-5 rounded-3xl bg-accent/30 border border-border/40 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Last Synced</p>
                          <p className="text-xs font-bold truncate">
                            {app.active.lastSyncAt ? formatDistanceToNow(new Date(app.active.lastSyncAt), { addSuffix: true }) : 'Never'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">Records</p>
                          <p className="text-xs font-bold text-primary">
                            {app.active.usage?.totalRecordsSynced || 0}
                          </p>
                        </div>
                      </div>
                   )}
  
                   <div className="flex items-center gap-3">
                      {app.active ? (
                         <>
                           <Button 
                             variant="secondary" 
                             onClick={() => handleConnect(app.id)}
                             className="flex-1 bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-black h-12 rounded-2xl transition-all uppercase tracking-[0.1em] shadow-lg shadow-slate-900/10"
                           >
                              Configure
                           </Button>
                           <Button 
                             variant="outline" 
                             size="icon" 
                             onClick={() => handleManualSync(app.id)}
                             disabled={syncingId === app.id}
                             className={`h-12 w-12 border-border/50 rounded-2xl hover:bg-accent transition-all shadow-sm ${syncingId === app.id ? 'opacity-50' : ''}`}
                           >
                              {syncingId === app.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCcw className="h-5 w-5" />}
                           </Button>
                         </>
                      ) : app.isComingSoon ? (
                         <Button disabled className="w-full bg-accent/20 border-none text-muted-foreground/50 font-black h-12 rounded-2xl uppercase tracking-widest text-[10px]">
                            Coming Soon
                         </Button>
                      ) : (
                         <Button 
                           onClick={() => handleConnect(app.id)}
                           className="w-full bg-primary border-none hover:bg-primary/90 text-primary-foreground font-black h-13 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/20 group-hover:scale-[1.02] uppercase tracking-widest text-[10px]"
                         >
                            Connect Dashboard
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                         </Button>
                      )}
                   </div>
                </CardContent>
             </Card>
           ))}
  
           {/* Custom Connection Card */}
           <Link href="/settings/developer" className="block h-full group">
              <Card className="border-4 border-dashed border-border/30 bg-transparent flex flex-col items-center justify-center text-center p-12 h-full min-h-[420px] hover:border-primary/40 hover:bg-primary/5 transition-all duration-700 cursor-pointer group rounded-[3.5rem]">
                 <div className="h-24 w-24 rounded-full bg-accent/20 flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary group-hover:scale-110 group-hover:rotate-12 transition-all mb-8 shadow-inner shadow-black/5">
                    <Plus className="h-10 w-10 transition-transform group-hover:rotate-90 duration-700" />
                 </div>
                 <h3 className="font-black text-2xl mb-4 tracking-tighter uppercase tracking-widest">Build Custom</h3>
                 <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed font-bold opacity-60 group-hover:opacity-100 transition-opacity">
                    Need a specialized workflow? Use our Webhooks & Developer APIs.
                 </p>
                 <div className="mt-8 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-y-0 translate-y-4">
                    <Badge variant="outline" className="text-primary border-primary/20 px-4 py-1.5 rounded-full flex items-center gap-2">
                       <ExternalLink className="h-3 w-3" /> View Docs
                    </Badge>
                 </div>
              </Card>
           </Link>
        </div>
      )}

      {/* Security / Trust Footer */}
      <div className="bg-slate-900 rounded-[3.5rem] p-16 mt-16 text-white relative overflow-hidden group shadow-3xl">
         <div className="absolute -bottom-20 -right-20 opacity-10 group-hover:scale-125 group-hover:rotate-12 transition-all duration-1000">
            <ShieldCheck className="h-[500px] w-[500px]" />
         </div>
         <div className="max-w-3xl space-y-8 relative z-10">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
               <ShieldCheck className="h-4 w-4" /> Enterprise Security Grade
            </div>
            <h2 className="text-5xl font-black uppercase tracking-tighter leading-none">
               Military-Grade <br/>
               <span className="text-emerald-400">Security Layers.</span>
            </h2>
            <p className="text-xl font-medium text-slate-400 leading-relaxed max-w-xl">
               All integrations utilize <span className="text-white font-black underline decoration-emerald-500/30 underline-offset-4">AES-256 Bit Encryption</span> for your credentials and strictly follow Meta's OAuth2.0 standards. Your data stays in your ecosystem.
            </p>
            <div className="flex items-center gap-14 pt-8">
               <div className="flex flex-col gap-2">
                  <span className="text-5xl font-black text-white tracking-tighter">99.99%</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Infrastructure Uptime</span>
               </div>
               <div className="h-20 w-[1px] bg-slate-800" />
               <div className="flex flex-col gap-2">
                  <span className="text-5xl font-black text-white tracking-tighter">Zero</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Data Sharing Policy</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
