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

  const planFeatures = watch('features') || [];

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
                {/* STEP 1: IDENTITY */}
                {currentStep === 1 && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Marketplace Name</Label>
                        <Input {...register('name', { required: true })} placeholder="e.g. Enterprise Growth" className="h-14 rounded-2xl bg-muted/20 border-border/50 font-bold text-lg px-6" />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">System Slug (Unique)</Label>
                        <Input {...register('slug', { required: true })} placeholder="e.g. growth-v2" className="h-14 rounded-2xl bg-muted/20 border-border/50 font-bold text-lg px-6" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 space-y-4 hover:border-indigo-500/30 transition-colors">
                        <div className="flex justify-between items-center">
                           <div className="space-y-0.5">
                              <p className="text-xs font-black uppercase tracking-widest">Visibility</p>
                              <p className="text-[10px] text-muted-foreground">Is this plan visible to users?</p>
                           </div>
                           <Switch 
                              checked={watch('isActive')} 
                              onCheckedChange={(v) => setValue('isActive', v)}
                              className="scale-110"
                           />
                        </div>
                      </div>

                      <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 space-y-4 hover:border-indigo-500/30 transition-colors">
                        <div className="flex justify-between items-center">
                           <div className="space-y-0.5">
                              <p className="text-xs font-black uppercase tracking-widest">Default Assignment</p>
                              <p className="text-[10px] text-muted-foreground">Assign this to all new signups?</p>
                           </div>
                           <Switch 
                              checked={watch('isDefault')} 
                              onCheckedChange={(v) => setValue('isDefault', v)}
                              className="scale-110"
                           />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: ECONOMICS */}
                {currentStep === 2 && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-2 gap-8">
                       <div className="p-8 rounded-[40px] bg-indigo-500/5 border border-indigo-500/20 space-y-6">
                          <div className="flex items-center gap-3">
                             <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600">
                                <DollarSign className="h-5 w-5" />
                             </div>
                             <p className="text-sm font-black uppercase tracking-widest">Monthly Billing</p>
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fee (INR)</Label>
                             <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-600">₹</span>
                                <Input 
                                    type="number"
                                    className="h-16 rounded-2xl bg-background border-border/50 font-black text-2xl pl-12 pr-6"
                                    defaultValue={watch('monthlyBaseFeeCents') / 100}
                                    onChange={(e) => setValue('monthlyBaseFeeCents', Math.round(parseFloat(e.target.value) * 100))}
                                />
                             </div>
                          </div>
                       </div>

                       <div className="p-8 rounded-[40px] bg-amber-500/5 border border-amber-500/20 space-y-6">
                          <div className="flex items-center gap-3">
                             <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                                <Zap className="h-5 w-5" />
                             </div>
                             <p className="text-sm font-black uppercase tracking-widest">Yearly Billing</p>
                          </div>
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Fee (INR)</Label>
                             <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-amber-600">₹</span>
                                <Input 
                                    type="number"
                                    className="h-16 rounded-2xl bg-background border-border/50 font-black text-2xl pl-12 pr-6"
                                    defaultValue={(watch('yearlyBaseFeeCents') || 0) / 100}
                                    onChange={(e) => setValue('yearlyBaseFeeCents', Math.round(parseFloat(e.target.value) * 100))}
                                />
                             </div>
                          </div>
                          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest pl-1 italic">Save ~{(1 - ((watch('yearlyBaseFeeCents') || 0) / (watch('monthlyBaseFeeCents') * 12 || 1))) * 100 | 0}% with yearly</p>
                       </div>
                    </div>

                    <div className="p-8 rounded-[40px] bg-muted/20 border border-border/50 space-y-8">
                       <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-4">Conversation Markups (%)</h4>
                       <div className="grid grid-cols-4 gap-6">
                          {['marketing', 'utility', 'authentication', 'service'].map((type) => (
                            <div key={type} className="space-y-3">
                               <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground capitalize">{type}</Label>
                               <div className="relative">
                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground/50 text-[10px]">%</span>
                                  <Input 
                                    type="number" 
                                    {...register(`conversationPricing.${type}MarkupPercent`)} 
                                    className="h-12 rounded-xl bg-background border-border/50 font-black text-lg px-4 pr-8"
                                  />
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: QUOTAS */}
                {currentStep === 3 && (
                   <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="grid grid-cols-2 gap-8">
                        <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 space-y-4 hover:border-indigo-500/30 transition-colors">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <Users className="h-4 w-4 text-indigo-600" /> Max Contact Capacity
                            </Label>
                            <Input type="number" {...register('limits.maxContacts')} className="h-14 rounded-2xl bg-background border-border/50 font-black text-2xl px-6" />
                        </div>
                        <div className="p-8 rounded-[32px] bg-muted/20 border border-border/50 space-y-4 hover:border-indigo-500/30 transition-colors">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <Layers className="h-4 w-4 text-indigo-600" /> Monthly Message Volume
                            </Label>
                            <Input type="number" {...register('limits.maxMessagesPerMonth')} className="h-14 rounded-2xl bg-background border-border/50 font-black text-2xl px-6" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-6">
                        <div className="p-6 rounded-3xl bg-muted/10 border border-border/40 space-y-3 hover:border-indigo-500/30 transition-colors">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <Zap className="h-3 w-3" /> Automations
                            </Label>
                            <Input type="number" {...register('limits.maxAutomations')} className="h-12 rounded-xl bg-background border-border/50 font-black text-xl px-4" />
                        </div>
                        <div className="p-6 rounded-3xl bg-muted/10 border border-border/40 space-y-3 hover:border-indigo-500/30 transition-colors">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <CheckCircle2 className="h-3 w-3" /> Meta Templates
                            </Label>
                            <Input type="number" {...register('limits.maxTemplates')} className="h-12 rounded-xl bg-background border-border/50 font-black text-xl px-4" />
                        </div>
                        <div className="p-6 rounded-3xl bg-muted/10 border border-border/40 space-y-3 hover:border-indigo-500/30 transition-colors">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <Shield className="h-3 w-3" /> Bulk Campaigns
                            </Label>
                            <Input type="number" {...register('limits.maxCampaigns')} className="h-12 rounded-xl bg-background border-border/50 font-black text-xl px-4" />
                        </div>
                      </div>
                   </div>
                )}

                {/* STEP 4: SERVICES */}
                {currentStep === 4 && (
                  <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {[
                      {
                        group: "Core Messaging",
                        items: [
                          { id: 'INBOX', label: 'Inbox', desc: 'Unified multi-channel message hub' },
                          { id: 'BILLING', label: 'Billing', desc: 'Wallet, recharge and invoice management' },
                          { id: 'CAMPAIGNS', label: 'Campaigns', desc: 'Broadcast marketing and messaging flows' },
                          { id: 'CONTACTS', label: 'Contacts', desc: 'Centralized customer directory & metadata' },
                          { id: 'ADS', label: 'Ads', desc: 'Click-to-WhatsApp ad monitoring' },
                          { id: 'TEMPLATES_LIBRARY', label: 'Templates & Library', desc: 'Meta-approved shared template vault' },
                        ]
                      },
                      {
                        group: "Automation Hub",
                        items: [
                          { id: 'FLOW_HUB', label: 'Flow Hub', desc: 'Visual builder for customer journeys' },
                          { id: 'WORKFLOWS', label: 'Workflows', desc: 'Advanced logic and trigger sequences' },
                          { id: 'AUTO_REPLIES', label: 'Auto Replies', desc: 'Keyword and intent based response' },
                          { id: 'INSTAGRAM_QUICKFLOWS', label: 'Instagram QuickFlows', desc: 'Rapid DM automation for IG' },
                          { id: 'WA_FORMS', label: 'WhatsApp Forms', desc: 'Structured data collection in chat' },
                          { id: 'ANSWERBOT', label: 'AnswerBot Training', desc: 'AI agent knowledge base & training' },
                          { id: 'AI_INTENT', label: 'AI Intent Match', desc: 'Natural language intent classification' },
                          { id: 'INTERAKTIVE_LIST', label: 'Interaktive List', desc: 'Interactive message menu controls' },
                        ]
                      },
                      {
                        group: "CRM & CRM Analysis",
                        items: [
                          { id: 'PIPELINE', label: 'Pipeline', desc: 'Visual sales funnel and stage tracking' },
                          { id: 'TASKS', label: 'Tasks', desc: 'Agent follow-ups and CRM to-do list' },
                          { id: 'REPORTS', label: 'Reports', desc: 'CRM performance and conversion data' },
                          { id: 'ANALYTICS', label: 'Chat Analytics', desc: 'In-depth message & response auditing' },
                          { id: 'CHAT_ASSIGNMENT', label: 'Chat Assignment', desc: 'Automated agent routing protocols' },
                          { id: 'TEAM_MGMT', label: 'Team Management', desc: 'RBAC and agent performance monitoring' },
                        ]
                      },
                      {
                        group: "Commerce & Tools",
                        items: [
                          { id: 'CATALOG', label: 'Catalog', desc: 'Meta product catalog integration' },
                          { id: 'ORDERS', label: 'Order Panel', desc: 'Order tracking and transaction hub' },
                          { id: 'CHECKOUT_BOT', label: 'Checkout Bot', desc: 'Self-serve checkout flow logic' },
                          { id: 'COMMERCE_SETTINGS', label: 'Settings', desc: 'Storefront and payment configuration' },
                          { id: 'INTEGRATIONS', label: 'Integrations', desc: 'External app and API connectivity' },
                          { id: 'WIDGET_CONFIG', label: 'Widget', desc: 'On-site chat widget customization' },
                          { id: 'MACROS', label: 'Macros', desc: 'Templated quick-responses for agents' },
                        ]
                      }
                    ].map((section) => (
                      <div key={section.group} className="space-y-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 border-l-4 border-indigo-600 pl-4 mb-2">{section.group}</p>
                        <div className="grid grid-cols-2 gap-4">
                          {section.items.map((feature) => {
                            const isChecked = planFeatures.includes(feature.id);
                            return (
                              <label 
                                key={feature.id} 
                                className={`flex items-start gap-4 p-6 rounded-[32px] border transition-all cursor-pointer select-none group ${isChecked ? 'bg-indigo-600/5 border-indigo-600 shadow-lg shadow-indigo-600/5' : 'bg-muted/20 border-border/50 opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}
                              >
                                <input 
                                  type="checkbox" 
                                  className="mt-1 h-5 w-5 rounded-lg border-2 border-border/50 checked:bg-indigo-600 checked:border-indigo-600 transition-all cursor-pointer accent-indigo-600"
                                  defaultChecked={isChecked}
                                  onChange={(e) => {
                                    const current = watch('features') || [];
                                    if (e.target.checked) setValue('features', [...current, feature.id]);
                                    else setValue('features', current.filter((f: any) => f !== feature.id));
                                  }}
                                />
                                <div className="space-y-1">
                                  <p className="text-xs font-black uppercase tracking-tight">{feature.label}</p>
                                  <p className="text-[10px] text-muted-foreground font-medium leading-tight">{feature.desc}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* STEP 5: REVIEW */}
                {currentStep === 5 && (
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
                )}
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
