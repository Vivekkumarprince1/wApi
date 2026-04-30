/**
 * PLAN EDITOR MODAL (WIZARD EDITION)
 * 
 * Sequential multi-step flow for defining subscription tiers.
 * Supports dual billing intervals (Monthly/Yearly) and categorized feature gating.
 */

"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { 
  Package, 
  Zap, 
  Layers, 
  Shield, 
  CheckCircle2, 
  Info,
  DollarSign,
  Users,
  ChevronRight,
  ChevronLeft,
  Settings,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';

import { StepIdentity } from './plan-editor/step-identity';
import { StepEconomics } from './plan-editor/step-economics';
import { StepQuotas } from './plan-editor/step-quotas';
import { StepServices } from './plan-editor/step-services';
import { StepProtocol } from './plan-editor/step-protocol';

interface PlanEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: any;
}

const STEPS = [
  { id: 1, title: 'Identity', desc: 'Classification & Branding' },
  { id: 2, title: 'Economics', desc: 'Monthly & Yearly Pricing' },
  { id: 3, title: 'Quotas', desc: 'Usage & Resource Limits' },
  { id: 4, title: 'Services', desc: 'Feature Entitlements' },
  { id: 5, title: 'Protocol', desc: 'Final Review & Launch' },
];

export default function PlanEditorModal({ isOpen, onClose, plan }: PlanEditorModalProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const isEditing = !!plan;

  const { register, handleSubmit, reset, setValue, watch, trigger } = useForm({
    defaultValues: plan || {
      name: '',
      slug: '',
      monthlyBaseFeeCents: 0,
      yearlyBaseFeeCents: 0,
      billingIntervalMonths: 1,
      currency: 'INR',
      limits: {
        maxContacts: 1000,
        maxMessagesPerMonth: 5000,
        maxAutomations: 2,
        maxTemplates: 10,
        maxCampaigns: 50
      },
      conversationPricing: {
        marketingMarkupPercent: 0,
        utilityMarkupPercent: 0,
        authenticationMarkupPercent: 0,
        serviceMarkupPercent: 0
      },
      fixedPricePaise: {
        marketing: 80,
        utility: 40,
        authentication: 30,
        service: 0
      },
      features: [],
      isActive: true,
      isDefault: false
    }
  });

  useEffect(() => {
    if (plan) {
      reset(plan);
    } else {
        reset({
            name: '',
            slug: '',
            monthlyBaseFeeCents: 0,
            yearlyBaseFeeCents: 0,
            billingIntervalMonths: 1,
            currency: 'INR',
            limits: {
              maxContacts: 1000,
              maxMessagesPerMonth: 5000,
              maxAutomations: 2,
              maxTemplates: 10,
              maxCampaigns: 50
            },
            conversationPricing: {
              marketingMarkupPercent: 0,
              utilityMarkupPercent: 0,
              authenticationMarkupPercent: 0,
              serviceMarkupPercent: 0
            },
            fixedPricePaise: {
              marketing: 80,
              utility: 40,
              authentication: 30,
              service: 0
            },
            features: [],
            isActive: true,
            isDefault: false
        });
    }
    setCurrentStep(1);
  }, [plan, reset, isOpen]);

  const onSubmit = async (data: any) => {
    try {
      if (isEditing) {
        await apiClient.patch(`/super-admin/plans/${plan._id}`, data);
        toast.success('Plan architecture updated');
      } else {
        await apiClient.post('/super-admin/plans', data);
        toast.success('New plan tier deployed');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Operation aborted');
    }
  };

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (currentStep === 1) fieldsToValidate = ['name', 'slug'];
    
    const isValid = await trigger(fieldsToValidate);
    if (isValid) setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  };

  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const stepProps = { register, watch, setValue, trigger };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl h-[90vh] p-0 overflow-hidden border-none shadow-[0_0_50px_rgba(0,0,0,0.3)] rounded-[40px] bg-background">
        <div className="flex h-full min-h-0 overflow-hidden">
          {/* Sidebar Wizard Navigation */}
          <div className="w-64 bg-muted/30 border-r border-border/50 p-8 flex flex-col gap-10 shrink-0">
            <div className="space-y-1">
              <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-4">
                <Settings className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tighter">Plan Engine</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Configuration Wizard</p>
            </div>

            <div className="flex-1 space-y-6">
              {STEPS.map((step) => (
                <div key={step.id} className={`flex items-center gap-4 transition-all duration-300 ${currentStep === step.id ? 'translate-x-2' : 'opacity-40 grayscale'}`}>
                   <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-colors ${currentStep === step.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-muted-foreground/30'}`}>
                      {currentStep > step.id ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                   </div>
                   <div className="space-y-0.5">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${currentStep === step.id ? 'text-indigo-600' : ''}`}>{step.title}</p>
                      <p className="text-[8px] font-medium text-muted-foreground leading-none">{step.desc}</p>
                   </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
               <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Status</p>
               <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full animate-pulse ${watch('isActive') ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-[10px] font-black uppercase">{watch('isActive') ? 'Ready for Deployment' : 'Suspended State'}</span>
               </div>
            </div>
          </div>

          {/* Main Content Area */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background h-full">
            <DialogHeader className="p-10 border-b border-border/40 shrink-0">
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <DialogTitle className="text-3xl font-black tracking-tight uppercase">{STEPS[currentStep - 1].title}</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{STEPS[currentStep - 1].desc}</DialogDescription>
                    </div>
                    <Badge variant="outline" className="h-10 px-6 rounded-xl border-dashed border-border/60 text-[10px] font-black uppercase tracking-widest">
                        Step {currentStep} of {STEPS.length}
                    </Badge>
                </div>
            </DialogHeader>

            <div className="flex-1 relative min-h-0">
                <ScrollArea className="h-full">
                    <div className="px-10 py-8">
                        <div className="max-w-3xl mx-auto pb-10">
                            {currentStep === 1 && <StepIdentity {...stepProps} />}
                            {currentStep === 2 && <StepEconomics {...stepProps} />}
                            {currentStep === 3 && <StepQuotas {...stepProps} />}
                            {currentStep === 4 && <StepServices {...stepProps} />}
                            {currentStep === 5 && <StepProtocol {...stepProps} />}
                        </div>
                    </div>
                </ScrollArea>
            </div>

            <DialogFooter className="p-10 border-t border-border/40 bg-muted/10 flex items-center justify-between sm:justify-between w-full h-32 shrink-0">
                <div className="flex items-center gap-4">
                    {currentStep > 1 && (
                        <Button type="button" variant="outline" onClick={prevStep} className="h-14 px-8 rounded-2xl font-black text-xs uppercase tracking-widest border-border/60 hover:bg-background group">
                           <ChevronLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back
                        </Button>
                    )}
                    <Button type="button" variant="ghost" onClick={onClose} className="h-14 px-8 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-red-500 hover:bg-red-500/5">
                        Cancel Sequence
                    </Button>
                </div>

                <div className="flex items-center gap-4">
                    {currentStep < STEPS.length ? (
                        <Button type="button" onClick={nextStep} className="h-14 px-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/20 rounded-2xl font-black text-xs uppercase tracking-[0.1em] group">
                           Next Phase <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    ) : (
                        <Button type="submit" className="h-14 px-14 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/20 rounded-2xl font-black text-xs uppercase tracking-widest animate-pulse hover:animate-none">
                           Commit Plan Architecture
                        </Button>
                    )}
                </div>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
