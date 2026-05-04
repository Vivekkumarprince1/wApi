import React from 'react';
import { Package, Shield, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StepProps } from './types';

export const StepProtocol: React.FC<StepProps> = ({ watch }) => {
  const planFeatures = watch('features') || [];

  return (
    <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500">
      <div className="p-10 rounded-[40px] bg-indigo-600 text-white shadow-2xl shadow-indigo-500/30 space-y-8 relative overflow-hidden">
        <Shield className="absolute -right-10 -bottom-10 h-64 w-64 text-white/5 rotate-12" />
        <div className="relative space-y-6 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <div className="space-y-2">
            <h3 className="text-4xl font-black uppercase tracking-tighter">{watch('name')}</h3>
            <Badge variant="secondary" className="bg-white/20 text-white border-none font-black text-xs px-6 rounded-full py-1.5 uppercase tracking-widest">{watch('slug')}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 relative">
          <div className="bg-white/10 rounded-3xl p-6 backdrop-blur-sm border border-white/10 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60 italic">Monthly Commitment</p>
            <p className="text-3xl font-black tabular-nums tracking-tighter">₹{(watch('monthlyBaseFeeCents') / 100).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-3xl p-6 backdrop-blur-sm border border-white/10 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60 italic">Yearly Commitment</p>
            <p className="text-3xl font-black tabular-nums tracking-tighter">₹{(watch('yearlyBaseFeeCents') / 100).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 text-center space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contacts</p>
          <p className="text-2xl font-black tabular-nums">{watch('limits.maxContacts')}</p>
        </div>
        <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 text-center space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Volume</p>
          <p className="text-2xl font-black tabular-nums">{watch('limits.maxMessagesPerMonth')}</p>
        </div>
        <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 text-center space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Features</p>
          <p className="text-2xl font-black tabular-nums">{planFeatures.length}</p>
        </div>
      </div>

      <div className="p-8 rounded-[32px] bg-amber-500/5 border border-amber-500/20 flex items-center gap-6">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
          <Info className="h-7 w-7" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-xs font-black uppercase tracking-widest text-amber-900">Legal Acknowledgement</p>
          <p className="text-[10px] text-amber-700 font-medium">By launching this plan, you authorize the immediate availability of these tier specifics in the platform registry. This may affect subscriber discovery.</p>
        </div>
      </div>
    </div>
  );
};
