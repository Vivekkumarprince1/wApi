'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Rocket, Users, FileText, Clock, CheckCircle2, Search,
  Upload, X, Tag, ChevronDown, AlertTriangle, Loader2, Send, Calendar,
  Eye, Plus, Filter, UserCheck, FileUp, Zap, ChevronRight, Info,
  Smartphone, MessageSquare, Mail
} from 'lucide-react';
import { fetchContacts, fetchTemplates, post, get } from '@/lib/api';
import { toast } from '@/lib/toast';
import FeatureGate from '@/components/features/FeatureGate';
import QuotaWarning from '@/components/features/QuotaWarning';

// ═══════════════════════════════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════
import DetailsStep from '@/components/dashboard/campaign/steps/DetailsStep';
import AudienceStep from '@/components/dashboard/campaign/steps/AudienceStep';
import MessageStep from '@/components/dashboard/campaign/steps/MessageStep';
import ScheduleStep from '@/components/dashboard/campaign/steps/ScheduleStep';
import OptimizationStep from '@/components/dashboard/campaign/steps/OptimizationStep';
import ReviewStep from '@/components/dashboard/campaign/steps/ReviewStep';

// ═══════════════════════════════════════════════════════════════════════════════
// STEP DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════
const STEPS = [
  { id: 1, label: 'Campaign Details', icon: FileText },
  { id: 2, label: 'Choose Audience', icon: Users },
  { id: 3, label: 'Create Message', icon: Send },
  { id: 4, label: 'Schedule', icon: Clock },
  { id: 5, label: 'Optimization', icon: Zap },
  { id: 6, label: 'Review & Launch', icon: Rocket },
];

function StepIndicator({ currentStep, steps }) {
  // ... (StepIndicator implementation remains same but I'll simplify it slightly in the main return if needed)
  return (
    <div className="flex items-center justify-between mb-10 px-2">
      {steps.map((s, i) => {
        const isCompleted = currentStep > s.id;
        const isActive = currentStep === s.id;
        const Icon = s.icon;
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
              <div className={`
                w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 border-2 shadow-sm
                ${isCompleted
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20'
                  : isActive
                    ? 'bg-primary border-primary text-white shadow-primary/30 scale-110'
                    : 'bg-card border-border text-muted-foreground'
                }
              `}>
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4.5 w-4.5" />}
              </div>
              <span className={`text-[11px] font-semibold text-center leading-tight ${isActive ? 'text-primary' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-shrink-0 h-0.5 w-8 md:w-14 mt-[-18px] rounded-full transition-all duration-500 ${currentStep > s.id ? 'bg-emerald-500' : 'bg-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // ─── Campaign Data State (omitted for brevity in replace call, but keeping all of it)
  const [campaignData, setCampaignData] = useState({
    name: '',
    description: '',
    type: 'one-time',
    audienceMode: 'specific',
    selectedTags: [],
    selectedContactIds: [],
    selectAllContacts: false,
    csvContacts: [],
    templateId: '',
    variableMapping: {},
    variableFallbacks: {},
    scheduleType: 'now',
    scheduleDate: '',
    scheduleTime: '',
    deliveryOptimization: {
      enabled: false,
      type: 'NONE',
      rcsConfig: { templateId: '', mapping: {} },
      retryConfig: { maxAttempts: 1, retryDelayHours: 24 },
      cascadetoSms: false,
      fallbackBody: ''
    }
  });

  const [contacts, setContacts] = useState([]);
  const [contactCount, setContactCount] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);
  const [filteredContactCount, setFilteredContactCount] = useState(0);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  // ─── Loaders & Effects (Keeping all logic) ───
  useEffect(() => { loadAllData(); }, []);
  const loadAllData = async () => { await Promise.all([loadContacts(), loadTemplates(), loadTags()]); };
  
  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const res = await fetchContacts(1, 10000);
      const all = res.data || res.contacts || [];
      setContacts(all);
      setContactCount(all.length);
    } catch (e) { console.error(e); } finally { setLoadingContacts(false); }
  };

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await fetchTemplates();
      setTemplates(res.templates || []);
    } catch (e) { console.error(e); } finally { setLoadingTemplates(false); }
  };

  const loadTags = async () => {
    try {
      setLoadingTags(true);
      const res = await get('/tags');
      setTags(res.data || res.tags || []);
    } catch (e) { console.error(e); } finally { setLoadingTags(false); }
  };

  useEffect(() => {
    if (campaignData.audienceMode === 'tags' && campaignData.selectedTags.length > 0) {
      const filtered = contacts.filter(c => c.tags && campaignData.selectedTags.some(tag => c.tags.includes(tag)));
      setFilteredContactCount(filtered.length);
    } else { setFilteredContactCount(0); }
  }, [campaignData.selectedTags, campaignData.audienceMode, contacts]);

  const selectedTemplate = useMemo(() => templates.find(t => (t._id || t.id) === campaignData.templateId), [templates, campaignData.templateId]);
  const approvedTemplates = useMemo(() => templates.filter(t => t.status === 'APPROVED'), [templates]);
  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return approvedTemplates;
    const q = templateSearch.toLowerCase();
    return approvedTemplates.filter(t => t.name?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q) || t.bodyText?.toLowerCase().includes(q));
  }, [approvedTemplates, templateSearch]);

  const templateVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    const body = selectedTemplate.bodyText || selectedTemplate.body || '';
    const matches = body.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  }, [selectedTemplate]);

  const audienceCount = useMemo(() => {
    if (campaignData.audienceMode === 'specific') return campaignData.selectAllContacts ? contactCount : campaignData.selectedContactIds.length;
    if (campaignData.audienceMode === 'tags') return filteredContactCount;
    if (campaignData.audienceMode === 'csv') return campaignData.csvContacts.length;
    return 0;
  }, [campaignData.audienceMode, campaignData.selectAllContacts, campaignData.selectedContactIds.length, contactCount, filteredContactCount, campaignData.csvContacts]);

  const contactFields = [
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'name', label: 'Full Name' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'email', label: 'Email' },
    { value: 'company', label: 'Company' },
    { value: 'city', label: 'City' },
    { value: 'custom', label: 'Custom Text (Fallback)' },
  ];

  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast?.error?.('CSV file must have a header row and at least one data row'); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const phoneIdx = headers.findIndex(h => ['phone', 'phone_number', 'phonenumber', 'mobile', 'whatsapp', 'number'].includes(h));
      if (phoneIdx === -1) { toast?.error?.('CSV must contain a "phone" column'); return; }
      const nameIdx = headers.findIndex(h => ['name', 'first_name', 'firstname'].includes(h));
      const parsed = lines.slice(1).map((line, i) => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        return { id: `csv-${i}`, phone: vals[phoneIdx] || '', name: nameIdx >= 0 ? vals[nameIdx] : '', raw: vals };
      }).filter(c => c.phone);
      setCampaignData(prev => ({ ...prev, csvContacts: parsed }));
      toast?.success?.(`Loaded ${parsed.length} contacts from CSV`);
    };
    reader.readAsText(file);
  };

  const isStepValid = (s) => {
    switch (s) {
      case 1: return campaignData.name.trim().length > 0;
      case 2: return audienceCount > 0;
      case 3: return !!campaignData.templateId;
      case 4: return campaignData.scheduleType === 'later' ? !!(campaignData.scheduleDate && campaignData.scheduleTime) : true;
      case 5: return true;
      case 6: return true;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    if (quotaExceeded) { toast?.error?.('Campaign limit reached. Please upgrade your plan.'); return; }
    try {
      setLoading(true);
      let contactIds = [];
      if (campaignData.audienceMode === 'specific') {
        contactIds = campaignData.selectAllContacts ? contacts.map(c => c._id || c.id) : campaignData.selectedContactIds;
      } else if (campaignData.audienceMode === 'tags') {
        const filtered = contacts.filter(c => c.tags && campaignData.selectedTags.some(tag => c.tags.includes(tag)));
        contactIds = filtered.map(c => c._id || c.id);
      } else if (campaignData.audienceMode === 'csv') {
        const csvPhones = campaignData.csvContacts.map(c => c.phone);
        const matched = contacts.filter(c => csvPhones.some(p => c.phone?.includes(p) || p.includes(c.phone)));
        contactIds = matched.map(c => c._id || c.id);
        if (contactIds.length === 0) {
          toast?.error?.('No matching contacts found. Please import contacts first.');
          setLoading(false); return;
        }
      }

      const payload = {
        name: campaignData.name,
        description: campaignData.description,
        campaignType: campaignData.type === 'one-time' ? 'one-time' : 'scheduled',
        template: campaignData.templateId,
        contacts: contactIds,
        variableMapping: campaignData.variableMapping,
        ...(campaignData.audienceMode === 'tags' && { recipientFilter: { type: 'tags', tags: campaignData.selectedTags } }),
        ...(campaignData.scheduleType === 'later' && { scheduledAt: new Date(`${campaignData.scheduleDate}T${campaignData.scheduleTime}`).toISOString() }),
        deliveryOptimization: campaignData.deliveryOptimization
      };

      const result = await post('/campaigns', payload);

      if (result.success || result.campaign) {
        if (campaignData.scheduleType === 'now') {
          try {
            const campaignId = result.campaign?._id || result.campaign?.id;
            await post(`/campaigns/${campaignId}/start`, {});
            toast?.success?.('Campaign launched successfully!');
          } catch (startErr) { toast?.success?.('Campaign created as draft.'); }
        } else { toast?.success?.('Campaign scheduled successfully!'); }
        router.push('/dashboard/campaign');
      } else { throw new Error(result.message || 'Failed to create campaign'); }
    } catch (err) { console.error(err); toast?.error?.(err.message); } finally { setLoading(false); }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: CAMPAIGN DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: CHOOSE AUDIENCE
  // ═══════════════════════════════════════════════════════════════════════════


  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 shadow-premium rounded-2xl mb-8">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/campaign')}
              className="p-2.5 bg-white/15 backdrop-blur-sm rounded-xl hover:bg-white/25 transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Create Campaign</h1>
              <p className="text-white/80 text-sm mt-0.5">Send WhatsApp messages to your audience</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto">
        {/* Quota Warning */}
        <QuotaWarning
          resourceType="campaigns"
          onLimitExceeded={() => setQuotaExceeded(true)}
        />

        <div className="bg-card border border-border/50 rounded-2xl shadow-premium p-6 md:p-8">
          {/* Step Indicator */}
          <StepIndicator currentStep={step} steps={STEPS} />

          {/* Step Title */}
          <div className="mb-7">
            <h2 className="text-xl font-bold text-foreground">{STEPS[step - 1].label}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 1 && 'Set up your campaign basics'}
              {step === 2 && 'Choose who will receive this campaign'}
              {step === 3 && 'Select an approved template and map variables'}
              {step === 4 && 'Choose when to send your campaign'}
              {step === 5 && 'Configure fallback and retry strategies'}
              {step === 6 && 'Review everything and launch your campaign'}
            </p>
          </div>

          {/* Step Content */}
          {step === 1 && <DetailsStep campaignData={campaignData} setCampaignData={setCampaignData} />}
          {step === 2 && (
            <AudienceStep 
              campaignData={campaignData} 
              setCampaignData={setCampaignData}
              contacts={contacts}
              contactCount={contactCount}
              loadingContacts={loadingContacts}
              tags={tags}
              loadingTags={loadingTags}
              filteredContactCount={filteredContactCount}
              handleCSVUpload={handleCSVUpload}
              audienceCount={audienceCount}
            />
          )}
          {step === 3 && (
            <MessageStep 
              templateSearch={templateSearch}
              setTemplateSearch={setTemplateSearch}
              loadingTemplates={loadingTemplates}
              filteredTemplates={filteredTemplates}
              campaignData={campaignData}
              setCampaignData={setCampaignData}
              selectedTemplate={selectedTemplate}
              templateVariables={templateVariables}
              contactFields={contactFields}
            />
          )}
          {step === 4 && <ScheduleStep campaignData={campaignData} setCampaignData={setCampaignData} />}
          {step === 5 && <OptimizationStep campaignData={campaignData} setCampaignData={setCampaignData} />}
          {step === 6 && (
            <ReviewStep 
              campaignData={campaignData}
              audienceCount={audienceCount}
              selectedTemplate={selectedTemplate}
              templateVariables={templateVariables}
              contactFields={contactFields}
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-foreground hover:bg-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Back
            </button>

            {step < 6 ? (
              <button
                onClick={() => setStep(s => Math.min(6, s + 1))}
                disabled={!isStepValid(step)}
                className="btn-primary px-7 py-2.5 text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || quotaExceeded}
                className="btn-primary px-8 py-3 text-sm font-bold flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    {campaignData.scheduleType === 'now' ? 'Set Campaign Live' : 'Schedule Campaign'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT WITH FEATURE GATE
// ═══════════════════════════════════════════════════════════════════════════════
export default function NewCampaignPage() {
  return (
    <FeatureGate feature="campaigns">
      <CampaignWizard />
    </FeatureGate>
  );
}