"use client";

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { connectPetpooja } from '@/lib/api/integrations';

interface PetpoojaConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PetpoojaConnectModal({ isOpen, onClose, onSuccess }: PetpoojaConnectModalProps) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'official' | 'legacy'>('official');
  const [formData, setFormData] = useState({
    appKey: '',
    appSecret: '',
    accessToken: '',
    restId: '',
    vendorId: '',
    apiKey: '',
    baseUrl: ''
  });

  const handleConnect = async () => {
    const hasOfficialFields = formData.appKey && formData.appSecret && formData.accessToken && formData.restId;
    const hasLegacyFields = formData.vendorId && formData.apiKey;
    if ((mode === 'official' && !hasOfficialFields) || (mode === 'legacy' && !hasLegacyFields)) {
      toast.error(mode === 'official' ? "Please enter App Key, App Secret, Access Token, and Rest ID" : "Please enter both Vendor ID and API Key");
      return;
    }

    setLoading(true);
    try {
      await connectPetpooja(mode === 'official'
        ? {
            appKey: formData.appKey,
            appSecret: formData.appSecret,
            accessToken: formData.accessToken,
            restId: formData.restId,
            baseUrl: formData.baseUrl || undefined
          }
        : {
            vendorId: formData.vendorId,
            apiKey: formData.apiKey,
            baseUrl: formData.baseUrl || undefined
          }
      );
      toast.success("Petpooja connected successfully!");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to connect Petpooja");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] border-none bg-background/80 backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 mb-4">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Connect Petpooja POS</DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium leading-relaxed">
            Enter your Petpooja credentials to start syncing orders and customers to WhatsApp in real-time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-accent/20 p-1">
            <Button
              type="button"
              variant={mode === 'official' ? 'default' : 'ghost'}
              onClick={() => setMode('official')}
              className="h-10 rounded-lg text-[10px] font-black uppercase tracking-widest"
            >
              Official
            </Button>
            <Button
              type="button"
              variant={mode === 'legacy' ? 'default' : 'ghost'}
              onClick={() => setMode('legacy')}
              className="h-10 rounded-lg text-[10px] font-black uppercase tracking-widest"
            >
              Legacy
            </Button>
          </div>

          {mode === 'official' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appKey" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">App Key</Label>
                <Input id="appKey" value={formData.appKey} onChange={(e) => setFormData({ ...formData, appKey: e.target.value })} className="bg-accent/20 border-border/50 h-11 focus-visible:ring-orange-500/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restId" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rest ID</Label>
                <Input id="restId" value={formData.restId} onChange={(e) => setFormData({ ...formData, restId: e.target.value })} className="bg-accent/20 border-border/50 h-11 focus-visible:ring-orange-500/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appSecret" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">App Secret</Label>
                <Input id="appSecret" type="password" value={formData.appSecret} onChange={(e) => setFormData({ ...formData, appSecret: e.target.value })} className="bg-accent/20 border-border/50 h-11 focus-visible:ring-orange-500/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessToken" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Access Token</Label>
                <Input id="accessToken" type="password" value={formData.accessToken} onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })} className="bg-accent/20 border-border/50 h-11 focus-visible:ring-orange-500/50" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendorId" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vendor ID</Label>
                <Input id="vendorId" placeholder="e.g. V-123456" value={formData.vendorId} onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })} className="bg-accent/20 border-border/50 h-11 focus-visible:ring-orange-500/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">API Key</Label>
                <Input id="apiKey" type="password" value={formData.apiKey} onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })} className="bg-accent/20 border-border/50 h-11 focus-visible:ring-orange-500/50" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="baseUrl" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">API Base URL</Label>
            <Input
              id="baseUrl"
              placeholder="https://developerapi.petpooja.com/v2"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              className="bg-accent/20 border-border/50 h-11 focus-visible:ring-orange-500/50"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-[10px] text-slate-400 flex items-start gap-3 border border-white/5">
             <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
             <p className="leading-normal font-medium">
               Your API keys are encrypted with AES-256 and never shared. You can find these in your Petpooja Owner Dashboard under "Marketplace".
             </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="font-bold text-xs uppercase tracking-widest">Cancel</Button>
          <Button 
            onClick={handleConnect} 
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-orange-600/20 w-full sm:w-auto"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Authorize Connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
