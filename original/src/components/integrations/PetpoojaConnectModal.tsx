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
import axios from 'axios';

interface PetpoojaConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PetpoojaConnectModal({ isOpen, onClose, onSuccess }: PetpoojaConnectModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vendorId: '',
    apiKey: ''
  });

  const handleConnect = async () => {
    if (!formData.vendorId || !formData.apiKey) {
      toast.error("Please enter both Vendor ID and API Key");
      return;
    }

    setLoading(true);
    try {
      // We'll call a new API endpoint we'll create: /api/integrations/petpooja/connect
      await axios.post('/api/integrations/petpooja/connect', formData);
      toast.success("Petpooja connected successfully!");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to connect Petpooja");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-width-[450px] border-none bg-background/80 backdrop-blur-2xl shadow-2xl">
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
          <div className="space-y-2">
            <Label htmlFor="vendorId" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vendor ID</Label>
            <Input 
              id="vendorId" 
              placeholder="e.g. V-123456" 
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
              className="bg-accent/20 border-border/50 h-11 focus-visible:ring-orange-500/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">API Key</Label>
            <Input 
              id="apiKey" 
              type="password"
              placeholder="Enter your Petpooja API Key" 
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
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
