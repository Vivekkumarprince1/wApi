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
  Zap,
  BrainCircuit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { createCampaign, performCampaignAction } from '@/lib/api/campaigns';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// Wizard Step Components (Shells for now)
import DetailsStep from '@/components/dashboard/campaign/steps/details-step';
import AudienceStep from '@/components/dashboard/campaign/steps/audience-step';
import MessageStep from '@/components/dashboard/campaign/steps/message-step';
import ScheduleStep from '@/components/dashboard/campaign/steps/schedule-step';
import ReviewStep from '@/components/dashboard/campaign/steps/review-step';
import { CampaignPreviewSidebar } from '@/components/dashboard/campaign/CampaignPreviewSidebar';

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
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/30">
      {/* Main Content - Two Column Layout (starts from top) */}
      <div className="flex-1 flex overflow-hidden gap-0 min-h-0">
        {/* Left: Header + Form - Scrollable */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col bg-gradient-to-b from-transparent via-muted/5 to-muted/10">
          {/* Header - Inside Left Column */}
          <div className="px-6 py-2.5 border-b border-border/50 bg-gradient-to-b from-card/60 to-card/20 backdrop-blur-sm shrink-0 sticky top-0 z-10">
            {/* Title Section */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
	                <Button
	                  variant="ghost"
	                  size="sm"
	                  onClick={() => router.push('/campaign')}
	                  aria-label="Back to campaigns"
	                  className="h-9 px-3 gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
	                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {React.createElement(STEPS[step - 1].icon, { className: 'h-4 w-4 text-primary' })}
                <h1 className="text-lg font-bold tracking-tight">{STEPS[step - 1].title}</h1>
              </div>
              <p className="text-xs text-muted-foreground font-medium">{STEPS[step - 1].subtitle}</p>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 px-6 py-4">
            <div className="max-w-2xl mx-auto">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md border border-border/60 rounded-xl p-6 shadow-xl shadow-black/5 hover:shadow-2xl hover:shadow-black/10 transition-all duration-300"
              >
                {step === 1 && <DetailsStep campaignData={campaignData} setCampaignData={setCampaignData} />}
                {step === 2 && <AudienceStep campaignData={campaignData} setCampaignData={setCampaignData} />}
                {step === 3 && <MessageStep campaignData={campaignData} setCampaignData={setCampaignData} />}
                {step === 4 && <ScheduleStep campaignData={campaignData} setCampaignData={setCampaignData} />}
                {step === 5 && <ReviewStep campaignData={campaignData} />}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Right: Preview Sidebar - Fixed from top */}
        <aside className="hidden lg:flex w-96 border-l border-border/50 bg-gradient-to-b from-muted/20 via-muted/10 to-muted/5 backdrop-blur-sm flex-col shrink-0 ">
          <CampaignPreviewSidebar campaignData={campaignData} />
        </aside>
      </div>

      {/* Footer Navigation - Enhanced */}
      <div className="px-6 py-3 border-t border-border/50 bg-gradient-to-t from-card/60 to-card/20 backdrop-blur-sm shrink-0 sticky bottom-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || loading}
            className="h-10 px-5 rounded-lg font-semibold uppercase tracking-wide text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border/50 hover:border-border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Prev
          </Button>

          <div className="flex items-center gap-2">
            {/* Progress indicator text */}
            <span className="text-[11px] text-muted-foreground font-medium">Step {step}/5</span>
            
            {step < 5 ? (
              <Button
                onClick={handleNext}
                disabled={!isStepValid(step)}
                className="h-10 px-6 rounded-lg font-semibold uppercase tracking-wide text-xs bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:from-primary hover:to-primary active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                Continue
                <ChevronRight className="ml-1.5 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="h-10 px-6 rounded-lg font-semibold uppercase tracking-wide text-xs bg-gradient-to-r from-foreground to-foreground/80 text-background shadow-lg shadow-foreground/20 hover:shadow-xl hover:shadow-foreground/30 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Launch...
                  </>
                ) : (
                  <>
                    Launch
                    <Rocket className="ml-1.5 h-3.5 w-3.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



export default function CampaignWizardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Wizard...</div>}>
      <CampaignWizardContent />
    </Suspense>
  );
}
