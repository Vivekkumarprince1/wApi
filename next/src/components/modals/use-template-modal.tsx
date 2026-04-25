"use client";

import React, { useState } from 'react';
import { 
  X, 
  Rocket, 
  ArrowRight, 
  Send, 
  MessageSquare,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

import { Template } from '@/lib/api/templates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface UseTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template;
  onDirectSend?: (templateId: string) => void;
}

export default function UseTemplateModal({ isOpen, onClose, template, onDirectSend }: UseTemplateModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleStartCampaign = () => {
    // Redirect to wizard with template pre-selected
    router.push(`/dashboard/campaign/new?templateId=${template._id}`);
    onClose();
  };

  const handleDirectSend = () => {
    if (onDirectSend) {
      onDirectSend(template._id);
    }
  };

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
        className="relative w-full max-w-md bg-card border border-border/50 rounded-[32px] shadow-2xl overflow-hidden"
      >
        <div className="p-8 space-y-8 text-center">
           <div className="mx-auto h-20 w-20 rounded-[28px] bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Rocket className="h-10 w-10" />
           </div>

           <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-foreground">Use This Template?</h2>
              <p className="text-sm text-muted-foreground font-medium">
                Pick how you want to deliver <span className="text-primary font-bold">&quot;{template.name}&quot;</span>.
              </p>
           </div>

           <div className="grid grid-cols-1 gap-3">
              <Button 
                onClick={handleStartCampaign}
                className="rounded-2xl h-16 font-black shadow-lg shadow-primary/20 bg-primary group flex flex-col items-center justify-center py-0"
              >
                <div className="flex items-center">
                  Launch Bulk Campaign
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Broadcast to multiple segments</span>
              </Button>

              <Button 
                onClick={handleDirectSend}
                variant="outline"
                className="rounded-2xl h-16 font-black border-border/50 hover:bg-muted group flex flex-col items-center justify-center py-0"
              >
                <div className="flex items-center">
                  <Send className="mr-2 h-4 w-4" />
                  Send to Individual
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Message a single contact directly</span>
              </Button>
           </div>

           <div className="pt-2">
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="rounded-2xl h-10 font-bold text-muted-foreground underline underline-offset-4"
              >
                Cancel
              </Button>
           </div>
        </div>

        <div className="px-8 py-3 bg-muted/30 border-t border-border/40 flex items-center justify-center gap-2">
           <Sparkles className="h-3 w-3 text-primary opacity-60" />
           <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 italic">Official WhatsApp Marketing</span>
        </div>
      </motion.div>
    </div>
  );
}
