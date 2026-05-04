"use client";

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, 
  Rocket, 
  Users, 
  FileText, 
  Clock, 
  CheckCircle2, 
  Send, 
  ChevronRight,
  Loader2,
  Sparkles,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { createCampaign, performCampaignAction } from '@/lib/api/campaigns';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Wizard Step Components (Shells for now)
import DetailsStep from '@/components/dashboard/campaign/steps/details-step';
import AudienceStep from '@/components/dashboard/campaign/steps/audience-step';
import MessageStep from '@/components/dashboard/campaign/steps/message-step';
import ScheduleStep from '@/components/dashboard/campaign/steps/schedule-step';
import ReviewStep from '@/components/dashboard/campaign/steps/review-step';

const STEPS = [
  { id: 1, label: 'Basics', icon: FileText, title: 'Campaign Details', subtitle: 'Set up your campaign identity' },
  { id: 2, label: 'Audience', icon: Users, title: 'Choose Audience', subtitle: 'Select who will receive this broadcast' },
  { id: 3, label: 'Message', icon: Send, title: 'Create Message', subtitle: 'Select a template and map variables' },
  { id: 4, label: 'Timing', icon: Clock, title: 'Schedule Send', subtitle: 'Choose when to launch your campaign' },
  { id: 5, label: 'Ready', icon: Rocket, title: 'Review & Launch', subtitle: 'One final check before blastoff' },
];

function CampaignWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTemplateId = searchParams.get('templateId') || '';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [campaignData, setCampaignData] = useState({
    name: '',
    description: '',
    type: 'one-time',
    audienceMode: 'specific',
    selectedTags: [],
    selectedContactIds: [],
    selectAllContacts: false,
    segmentId: null,
    csvContacts: [],
    templateId: initialTemplateId,
    variableMapping: {},
    variableFallbacks: {},
    googleSheetsConfig: { spreadsheetId: '', sheetName: '' },
    scheduleType: 'now',
    scheduleDate: '',
    scheduleTime: ''
  });

  const isStepValid = (s: number) => {
    switch (s) {
      case 1: return campaignData.name.trim().length > 0;
      case 2: 
        if (campaignData.audienceMode === 'specific') return campaignData.selectedContactIds.length > 0 || campaignData.selectAllContacts;
        if (campaignData.audienceMode === 'tags') return campaignData.selectedTags.length > 0;
        if (campaignData.audienceMode === 'segment') return !!campaignData.segmentId;
        if (campaignData.audienceMode === 'google_sheets') return !!(campaignData.googleSheetsConfig?.spreadsheetId && campaignData.googleSheetsConfig?.sheetName);
        if (campaignData.audienceMode === 'csv') return campaignData.csvContacts.length > 0;
        if (campaignData.audienceMode === 'petpooja') return true; // Defaulting to true for integrated syncs
        return false;
      case 3: return !!campaignData.templateId;
      case 4: return campaignData.scheduleType === 'later' ? !!(campaignData.scheduleDate && campaignData.scheduleTime) : true;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const payload = {
        name: campaignData.name,
        description: campaignData.description,
        campaignType: campaignData.type === 'one-time' ? 'one-time' : 'scheduled',
        template: campaignData.templateId,
        contacts: campaignData.selectedContactIds,
        recipientFilter: {
          type: campaignData.audienceMode,
          segmentId: campaignData.segmentId,
          googleSheetsConfig: campaignData.googleSheetsConfig,
          csvContacts: campaignData.audienceMode === 'csv' ? campaignData.csvContacts : undefined
        },
        variableMapping: campaignData.variableMapping,
        scheduledAt: campaignData.scheduleType === 'later' 
          ? new Date(`${campaignData.scheduleDate}T${campaignData.scheduleTime}`).toISOString() 
          : undefined
      };

      const result = await createCampaign(payload);
      
      if (campaignData.scheduleType === 'now') {
        const campaignId = result.campaign?._id || result.campaign?.id;
        await performCampaignAction(campaignId, 'start');
        toast.success('Campaign launched successfully!');
      } else {
        toast.success('Campaign scheduled successfully!');
      }
      
      router.push('/campaign');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/campaign')}
            className="rounded-2xl h-12 w-12 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
              {STEPS[step - 1].title}
              <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10">Step {step} of 5</Badge>
            </h1>
            <p className="text-muted-foreground text-sm font-medium">{STEPS[step - 1].subtitle}</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-2">
           <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Expert Mode</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Progress */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-sm sticky top-24">
            <div className="space-y-6">
              {STEPS.map((s, i) => {
                const isCompleted = step > s.id;
                const isActive = step === s.id;
                return (
                  <div key={s.id} className="relative flex items-center gap-4 group">
                    {i < STEPS.length - 1 && (
                      <div className={`absolute left-[15px] top-[30px] w-0.5 h-6 transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-border'}`} />
                    )}
                    <div className={`
                      w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 border-2
                      ${isCompleted 
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : isActive 
                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-110' 
                        : 'bg-background border-border text-muted-foreground'
                      }
                    `}>
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-3.5 w-3.5" />}
                    </div>
                    <span className={`text-xs font-black uppercase tracking-widest transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-10 space-y-4">
              <div className="h-[1px] bg-border/40 w-full" />
              <div className="flex items-center gap-3 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Growth Plan Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-card border border-border/50 rounded-3xl shadow-premium p-8 min-h-[500px] flex flex-col">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {step === 1 && <DetailsStep campaignData={campaignData} setCampaignData={setCampaignData} />}
                  {step === 2 && <AudienceStep campaignData={campaignData} setCampaignData={setCampaignData} />}
                  {step === 3 && <MessageStep campaignData={campaignData} setCampaignData={setCampaignData} />}
                  {step === 4 && <ScheduleStep campaignData={campaignData} setCampaignData={setCampaignData} />}
                  {step === 5 && <ReviewStep campaignData={campaignData} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-8 border-t border-border/40 mt-8">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={step === 1 || loading}
                className="rounded-xl px-6 h-12 font-bold text-muted-foreground"
              >
                Back
              </Button>

              {step < 5 ? (
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid(step)}
                  className="rounded-2xl px-8 h-12 font-black shadow-lg shadow-primary/20 bg-primary group"
                >
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-2xl px-10 h-12 font-black shadow-lg shadow-primary/30 bg-primary group"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      {campaignData.scheduleType === 'now' ? 'Launch Campaign' : 'Schedule Campaign'}
                      <Rocket className="ml-2 h-5 w-5 group-hover:-translate-y-1 transition-transform" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, variant = 'default', className = '' }: any) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
      variant === 'secondary' ? 'bg-secondary text-secondary-foreground border-transparent' : 'bg-primary text-primary-foreground border-transparent'
    } ${className}`}>
      {children}
    </span>
  );
}

export default function CampaignWizardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Wizard...</div>}>
      <CampaignWizardContent />
    </Suspense>
  );
}
