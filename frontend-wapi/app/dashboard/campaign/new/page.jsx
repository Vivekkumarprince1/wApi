'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Rocket, Users, FileText, Clock, CheckCircle2, Search,
  Upload, X, Tag, ChevronDown, AlertTriangle, Loader2, Send, Calendar,
  Eye, Plus, Filter, UserCheck, FileUp, Zap, ChevronRight, Info
} from 'lucide-react';
import { fetchContacts, fetchTemplates, post, get } from '@/lib/api';
import { toast } from '@/lib/toast';
import FeatureGate from '@/components/features/FeatureGate';
import QuotaWarning from '@/components/features/QuotaWarning';

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

// ═══════════════════════════════════════════════════════════════════════════════
// HORIZONTAL STEP INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════
function StepIndicator({ currentStep, steps }) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN WIZARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function CampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // ─── Campaign Data ─────────────────────────────────────────────────────────
  const [campaignData, setCampaignData] = useState({
    name: '',
    description: '',
    type: 'one-time',
    // Audience
    audienceMode: 'all', // 'all' | 'tags' | 'csv'
    selectedTags: [],
    selectedContactIds: [],
    csvContacts: [],
    // Template
    templateId: '',
    variableMapping: {},
    variableFallbacks: {},
    // Schedule
    scheduleType: 'now',
    scheduleDate: '',
    scheduleTime: '',
    // Delivery Optimization
    deliveryOptimization: {
      enabled: false,
      type: 'NONE', // 'NONE' | 'RCS_FALLBACK' | 'AUTOMATED_RETRY'
      rcsConfig: {
        templateId: '',
        mapping: {}
      },
      retryConfig: {
        maxAttempts: 1,
        retryDelayHours: 24
      }
    }
  });

  // ─── Loaded Data ───────────────────────────────────────────────────────────
  const [contacts, setContacts] = useState([]);
  const [contactCount, setContactCount] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);
  const [filteredContactCount, setFilteredContactCount] = useState(0);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  // ─── Load Initial Data ─────────────────────────────────────────────────────
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([loadContacts(), loadTemplates(), loadTags()]);
  };

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const res = await fetchContacts(1, 10000);
      const all = res.data || res.contacts || [];
      setContacts(all);
      setContactCount(all.length);
    } catch (e) {
      console.error('Failed to load contacts:', e);
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await fetchTemplates();
      setTemplates(res.templates || []);
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadTags = async () => {
    try {
      setLoadingTags(true);
      const res = await get('/tags');
      setTags(res.data || res.tags || []);
    } catch (e) {
      console.error('Failed to load tags:', e);
    } finally {
      setLoadingTags(false);
    }
  };

  // ─── Tag filtering ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (campaignData.audienceMode === 'tags' && campaignData.selectedTags.length > 0) {
      const filtered = contacts.filter(c =>
        c.tags && campaignData.selectedTags.some(tag => c.tags.includes(tag))
      );
      setFilteredContactCount(filtered.length);
    } else {
      setFilteredContactCount(0);
    }
  }, [campaignData.selectedTags, campaignData.audienceMode, contacts]);

  // ─── Derived ───────────────────────────────────────────────────────────────
  const selectedTemplate = useMemo(
    () => templates.find(t => (t._id || t.id) === campaignData.templateId),
    [templates, campaignData.templateId]
  );

  const approvedTemplates = useMemo(
    () => templates.filter(t => t.status === 'APPROVED'),
    [templates]
  );

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return approvedTemplates;
    const q = templateSearch.toLowerCase();
    return approvedTemplates.filter(t =>
      t.name?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      t.bodyText?.toLowerCase().includes(q)
    );
  }, [approvedTemplates, templateSearch]);

  const templateVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    // Extract {{N}} or {{variable}} from template bodyText
    const body = selectedTemplate.bodyText || selectedTemplate.body || '';
    const matches = body.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  }, [selectedTemplate]);

  const audienceCount = useMemo(() => {
    if (campaignData.audienceMode === 'all') return contactCount;
    if (campaignData.audienceMode === 'tags') return filteredContactCount;
    if (campaignData.audienceMode === 'csv') return campaignData.csvContacts.length;
    return 0;
  }, [campaignData.audienceMode, contactCount, filteredContactCount, campaignData.csvContacts]);

  // ─── Contact field options for variable mapping ────────────────────────────
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

  // ─── CSV Upload Handler ────────────────────────────────────────────────────
  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast?.error?.('CSV file must have a header row and at least one data row');
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const phoneIdx = headers.findIndex(h =>
        ['phone', 'phone_number', 'phonenumber', 'mobile', 'whatsapp', 'number'].includes(h)
      );
      if (phoneIdx === -1) {
        toast?.error?.('CSV must contain a "phone" column');
        return;
      }
      const nameIdx = headers.findIndex(h => ['name', 'first_name', 'firstname'].includes(h));

      const parsed = lines.slice(1).map((line, i) => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        return {
          id: `csv-${i}`,
          phone: vals[phoneIdx] || '',
          name: nameIdx >= 0 ? vals[nameIdx] : '',
          raw: vals,
        };
      }).filter(c => c.phone);

      setCampaignData(prev => ({ ...prev, csvContacts: parsed }));
      toast?.success?.(`Loaded ${parsed.length} contacts from CSV`);
    };
    reader.readAsText(file);
  };

  // ─── Step Validation ───────────────────────────────────────────────────────
  const isStepValid = (s) => {
    switch (s) {
      case 1: return campaignData.name.trim().length > 0;
      case 2: return audienceCount > 0;
      case 3: return !!campaignData.templateId;
      case 4:
        if (campaignData.scheduleType === 'later') {
          return !!(campaignData.scheduleDate && campaignData.scheduleTime);
        }
        return true;
      case 5: return true; // Optimization is optional by default
      case 6: return true;
      default: return true;
    }
  };

  // ─── Submit Campaign ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (quotaExceeded) {
      toast?.error?.('Campaign limit reached. Please upgrade your plan.');
      return;
    }
    try {
      setLoading(true);

      // Resolve contact IDs
      let contactIds = [];
      if (campaignData.audienceMode === 'all') {
        contactIds = contacts.map(c => c._id || c.id);
      } else if (campaignData.audienceMode === 'tags') {
        const filtered = contacts.filter(c =>
          c.tags && campaignData.selectedTags.some(tag => c.tags.includes(tag))
        );
        contactIds = filtered.map(c => c._id || c.id);
      } else if (campaignData.audienceMode === 'csv') {
        // For CSV, we need to match by phone or use raw phone numbers
        // The backend createCampaign accepts contacts array of ObjectIds
        // For CSV-uploaded contacts, they may not exist yet. We pass phone numbers
        // and let the backend handle resolving or creating contacts.
        const csvPhones = campaignData.csvContacts.map(c => c.phone);
        const matched = contacts.filter(c =>
          csvPhones.some(p => c.phone?.includes(p) || p.includes(c.phone))
        );
        contactIds = matched.map(c => c._id || c.id);

        // If no matches found, we'll pass the phone numbers
        if (contactIds.length === 0) {
          toast?.error?.('No matching contacts found in your contacts list for the CSV phones. Please import contacts first.');
          setLoading(false);
          return;
        }
      }

      const payload = {
        name: campaignData.name,
        description: campaignData.description,
        campaignType: campaignData.type === 'one-time' ? 'one-time' : 'scheduled',
        template: campaignData.templateId,
        contacts: contactIds,
        variableMapping: campaignData.variableMapping,
        ...(campaignData.audienceMode === 'tags' && {
          recipientFilter: {
            type: 'tags',
            tags: campaignData.selectedTags,
          }
        }),
        ...(campaignData.scheduleType === 'later' && {
          scheduledAt: new Date(`${campaignData.scheduleDate}T${campaignData.scheduleTime}`).toISOString()
        }),
        // Delivery Optimization
        deliveryOptimization: campaignData.deliveryOptimization
      };

      const result = await post('/campaigns', payload);

      if (result.success || result.campaign) {
        // If "send now", also start the campaign
        if (campaignData.scheduleType === 'now') {
          try {
            const campaignId = result.campaign?._id || result.campaign?.id;
            await post(`/campaigns/${campaignId}/start`, {});
            toast?.success?.('Campaign launched successfully!');
          } catch (startErr) {
            console.error('Failed to auto-start campaign:', startErr);
            toast?.success?.('Campaign created as draft. Start it manually from the campaign list.');
          }
        } else {
          toast?.success?.('Campaign scheduled successfully!');
        }
        router.push('/dashboard/campaign');
      } else {
        throw new Error(result.message || 'Failed to create campaign');
      }
    } catch (err) {
      console.error('Campaign creation error:', err);
      toast?.error?.(err.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: CAMPAIGN DETAILS
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep1 = () => (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <label className="block text-sm font-bold text-foreground mb-2">
          Campaign Name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={campaignData.name}
          onChange={(e) => setCampaignData(d => ({ ...d, name: e.target.value }))}
          placeholder="e.g., Diwali Sale Announcement, Welcome Offer..."
          className="input-premium text-sm w-full"
          autoFocus
        />
        <p className="text-xs text-muted-foreground mt-1.5">Give your campaign a clear, descriptive name for easy identification.</p>
      </div>

      <div>
        <label className="block text-sm font-bold text-foreground mb-2">
          Description <span className="text-muted-foreground font-normal">(Optional)</span>
        </label>
        <textarea
          value={campaignData.description}
          onChange={(e) => setCampaignData(d => ({ ...d, description: e.target.value }))}
          placeholder="Brief description of this campaign's goal..."
          rows={3}
          className="input-premium text-sm w-full resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-foreground mb-3">
          Campaign Type
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { value: 'one-time', label: 'One-Time', desc: 'Send a single broadcast to your audience', icon: Send },
            { value: 'ongoing', label: 'Ongoing', desc: 'Schedule recurring campaign sends', icon: Zap },
          ].map(opt => {
            const Icon = opt.icon;
            const isSelected = campaignData.type === opt.value;
            return (
              <button key={opt.value}
                onClick={() => setCampaignData(d => ({ ...d, type: opt.value }))}
                className={`group relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-border hover:border-primary/40 hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground group-hover:text-primary'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: CHOOSE AUDIENCE
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep2 = () => (
    <div className="space-y-6 animate-fade-in-up">
      {/* Audience Mode Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { value: 'all', label: 'All Contacts', desc: `Send to all ${contactCount} contacts`, icon: Users, color: 'blue' },
          { value: 'tags', label: 'Filter by Tags', desc: 'Target contacts with specific tags', icon: Tag, color: 'purple' },
          { value: 'csv', label: 'Upload CSV', desc: 'Upload a list of phone numbers', icon: FileUp, color: 'emerald' },
        ].map(opt => {
          const Icon = opt.icon;
          const isSelected = campaignData.audienceMode === opt.value;
          return (
            <button key={opt.value}
              onClick={() => setCampaignData(d => ({ ...d, audienceMode: opt.value, selectedTags: [], csvContacts: [] }))}
              className={`group relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                : 'border-border hover:border-primary/40 hover:bg-accent/50'
              }`}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground group-hover:text-primary'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-foreground">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-2.5 right-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tag Filter UI */}
      {campaignData.audienceMode === 'tags' && (
        <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Filter by Tags
            </h4>
            {campaignData.selectedTags.length > 0 && (
              <button onClick={() => setCampaignData(d => ({ ...d, selectedTags: [] }))}
                className="text-xs text-destructive hover:underline">Clear All</button>
            )}
          </div>

          {loadingTags ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading tags...
            </div>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No tags found. Create tags in Contacts first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const tagName = typeof tag === 'string' ? tag : tag.name;
                const isSelected = campaignData.selectedTags.includes(tagName);
                return (
                  <button key={tagName}
                    onClick={() => {
                      setCampaignData(d => ({
                        ...d,
                        selectedTags: isSelected
                          ? d.selectedTags.filter(t => t !== tagName)
                          : [...d.selectedTags, tagName]
                      }));
                    }}
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-all ${isSelected
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : 'bg-card border-border text-foreground hover:border-primary/40 hover:bg-accent/50'
                    }`}
                  >
                    <Tag className="h-3 w-3 inline mr-1.5 -mt-0.5" />
                    {tagName}
                  </button>
                );
              })}
            </div>
          )}

          {campaignData.selectedTags.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
              <UserCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">{filteredContactCount}</span>
              <span className="text-sm text-foreground">contacts match selected tags</span>
            </div>
          )}
        </div>
      )}

      {/* CSV Upload UI */}
      {campaignData.audienceMode === 'csv' && (
        <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4 animate-fade-in-up">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Upload Contacts CSV
          </h4>

          {campaignData.csvContacts.length === 0 ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-10 cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-all group">
              <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-all">
                <FileUp className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Click to upload CSV file</p>
              <p className="text-xs text-muted-foreground">Must include a "phone" column. Supports name, email columns.</p>
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-bold text-foreground">{campaignData.csvContacts.length} contacts loaded</span>
                </div>
                <button onClick={() => setCampaignData(d => ({ ...d, csvContacts: [] }))}
                  className="text-xs text-destructive hover:underline flex items-center gap-1">
                  <X className="h-3 w-3" /> Remove
                </button>
              </div>

              {/* Preview Table */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-4 py-2 text-left text-xs font-bold text-muted-foreground uppercase">#</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Phone</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignData.csvContacts.slice(0, 5).map((c, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-2 font-mono text-foreground">{c.phone}</td>
                        <td className="px-4 py-2 text-foreground">{c.name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {campaignData.csvContacts.length > 5 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground text-center bg-muted/30 border-t border-border">
                    ...and {campaignData.csvContacts.length - 5} more contacts
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All Contacts mode info */}
      {campaignData.audienceMode === 'all' && (
        <div className="flex items-center gap-3 px-5 py-4 bg-primary/5 border border-primary/20 rounded-xl animate-fade-in-up">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">All Contacts Selected</p>
            <p className="text-xs text-muted-foreground">Campaign will be sent to <strong className="text-primary">{contactCount}</strong> contacts</p>
          </div>
        </div>
      )}

      {/* Audience Summary */}
      {audienceCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {audienceCount} recipient{audienceCount !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: CREATE MESSAGE (TEMPLATE SELECTION + VARIABLE MAPPING)
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep3 = () => (
    <div className="space-y-6 animate-fade-in-up">
      {/* Template Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={templateSearch}
          onChange={(e) => setTemplateSearch(e.target.value)}
          placeholder="Search approved templates..."
          className="input-premium pl-10 text-sm w-full"
        />
      </div>

      {loadingTemplates ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No Approved Templates</p>
          <p className="text-xs text-muted-foreground">Create and approve templates before creating a campaign.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredTemplates.map(template => {
            const tId = template._id || template.id;
            const isSelected = campaignData.templateId === tId;
            return (
              <button key={tId}
                onClick={() => setCampaignData(d => ({
                  ...d,
                  templateId: tId,
                  variableMapping: {},
                  variableFallbacks: {},
                }))}
                className={`group relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                  : 'border-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-foreground truncate">{template.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.bodyText || template.body}</p>
                    <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                      template.category === 'MARKETING'
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        : template.category === 'UTILITY'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-muted text-muted-foreground'
                    }`}>{template.category}</span>
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Variable Mapping Section */}
      {selectedTemplate && templateVariables.length > 0 && (
        <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4 animate-fade-in-up">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Map Template Variables
          </h4>
          <p className="text-xs text-muted-foreground">
            Map each variable in the template to a contact field. Set fallback text if a contact lacks the field.
          </p>

          <div className="space-y-3">
            {templateVariables.map((varName, i) => (
              <div key={varName} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-lg">
                  <code className="text-xs font-bold text-primary">{`{{${varName}}}`}</code>
                </div>
                <select
                  value={campaignData.variableMapping[varName] || ''}
                  onChange={(e) => setCampaignData(d => ({
                    ...d,
                    variableMapping: { ...d.variableMapping, [varName]: e.target.value }
                  }))}
                  className="input-premium text-sm"
                >
                  <option value="">Select field...</option>
                  {contactFields.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={campaignData.variableFallbacks[varName] || ''}
                  onChange={(e) => setCampaignData(d => ({
                    ...d,
                    variableFallbacks: { ...d.variableFallbacks, [varName]: e.target.value }
                  }))}
                  placeholder="Fallback value..."
                  className="input-premium text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template Preview */}
      {selectedTemplate && (
        <div className="bg-card border border-border rounded-xl p-5 animate-fade-in-up">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-primary" /> Template Preview
          </h4>
          <div className="bg-[#e5ddd5] dark:bg-gray-800 rounded-xl p-4 max-w-sm">
            <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm">
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                {(selectedTemplate.bodyText || selectedTemplate.body || '').replace(
                  /\{\{(\w+)\}\}/g,
                  (match, varName) => {
                    const field = campaignData.variableMapping[varName];
                    const fallback = campaignData.variableFallbacks[varName];
                    if (field && field !== 'custom') return `[${contactFields.find(f => f.value === field)?.label || field}]`;
                    if (fallback) return fallback;
                    return match;
                  }
                )}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 text-right mt-2">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: SCHEDULE
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep4 = () => (
    <div className="space-y-6 animate-fade-in-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { value: 'now', label: 'Send Now', desc: 'Launch campaign immediately', icon: Rocket, color: 'emerald' },
          { value: 'later', label: 'Schedule for Later', desc: 'Pick a date and time', icon: Calendar, color: 'blue' },
        ].map(opt => {
          const Icon = opt.icon;
          const isSelected = campaignData.scheduleType === opt.value;
          return (
            <button key={opt.value}
              onClick={() => setCampaignData(d => ({ ...d, scheduleType: opt.value }))}
              className={`group relative p-6 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                : 'border-border hover:border-primary/40 hover:bg-accent/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground group-hover:text-primary'}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-foreground">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {campaignData.scheduleType === 'later' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up">
          <div>
            <label className="block text-sm font-bold text-foreground mb-2">Date</label>
            <input
              type="date"
              value={campaignData.scheduleDate}
              onChange={(e) => setCampaignData(d => ({ ...d, scheduleDate: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              className="input-premium text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-foreground mb-2">Time</label>
            <input
              type="time"
              value={campaignData.scheduleTime}
              onChange={(e) => setCampaignData(d => ({ ...d, scheduleTime: e.target.value }))}
              className="input-premium text-sm w-full"
            />
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: DELIVERY OPTIMIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep5 = () => (
    <div className="space-y-6 animate-fade-in-up">
      <div className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
        campaignData.deliveryOptimization.enabled 
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
          : 'border-border bg-card'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              campaignData.deliveryOptimization.enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Delivery Optimization</h3>
              <p className="text-xs text-muted-foreground">Maximize your reach with automated failover and retries.</p>
            </div>
          </div>
          <button
            onClick={() => setCampaignData(d => ({
              ...d,
              deliveryOptimization: { ...d.deliveryOptimization, enabled: !d.deliveryOptimization.enabled }
            }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              campaignData.deliveryOptimization.enabled ? 'bg-emerald-500' : 'bg-muted'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              campaignData.deliveryOptimization.enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {campaignData.deliveryOptimization.enabled && (
          <div className="space-y-6 pt-4 border-t border-border/50 animate-fade-in">
            <label className="block text-sm font-bold text-foreground mb-3">Optimization Method</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { 
                  value: 'AUTOMATED_RETRY', 
                  label: 'Automated Retry', 
                  desc: 'Retry via WhatsApp after 24h if Frequency Cap (131051) error occurs.',
                  icon: Clock
                },
                { 
                  value: 'RCS_FALLBACK', 
                  label: 'RCS Fallback', 
                  desc: 'Send via RCS channel if WhatsApp delivery fails for any reason.',
                  icon: Rocket
                },
              ].map(opt => {
                const isSelected = campaignData.deliveryOptimization.type === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setCampaignData(d => ({
                      ...d,
                      deliveryOptimization: { ...d.deliveryOptimization, type: opt.value }
                    }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/10 shadow-sm' 
                        : 'border-border hover:border-primary/30 bg-card'
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                       <div className="flex items-center justify-between">
                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                           <Icon className="h-4 w-4" />
                         </div>
                         {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                       </div>
                       <div className="font-bold text-sm">{opt.label}</div>
                       <div className="text-[11px] text-muted-foreground leading-relaxed">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {campaignData.deliveryOptimization.type === 'AUTOMATED_RETRY' && (
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-bold mb-1">How it works:</p>
                  <p>Meta enforces frequency caps. If hit, we wait 24 hours and retry sending the same message automatically. This is ideal for high-volume marketing campaigns.</p>
                </div>
              </div>
            )}

            {campaignData.deliveryOptimization.type === 'RCS_FALLBACK' && (
              <div className="space-y-4 animate-fade-in-up">
                 <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                  <Rocket className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">
                    <p className="font-bold mb-1">Unified Reach:</p>
                    <p>If WhatsApp is unavailable on the recipient's phone, we'll fallback to RCS (Rich Communication Services) automatically using your connected Jio/Carrier channel.</p>
                  </div>
                </div>
                
                {/* RCS Template Mapping Simplified */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">RCS Template Mapping</h4>
                  <p className="text-[11px] text-muted-foreground mb-4">Select an RCS template to use for fallback. Variables will be mapped automatically based on your WhatsApp template selection.</p>
                  <select className="input-premium text-sm w-full">
                    <option>Auto-map from WhatsApp Template (Standard)</option>
                    <option disabled>Custom RCS Template (Advanced+ Plans)</option>
                  </select>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 italic">
                Note: Delivery optimization requires a pre-paid wallet balance. Credits will be "parked" when the campaign starts.
              </p>
            </div>
          </div>
        )}
      </div>

      {!campaignData.deliveryOptimization.enabled && (
        <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-10 text-center">
            <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Delivery optimization is disabled for this campaign.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Standard WhatsApp delivery logic will be applied.</p>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: REVIEW & LAUNCH
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep6 = () => (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6 space-y-5">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" /> Campaign Summary
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Campaign Name', value: campaignData.name, icon: FileText },
            { label: 'Type', value: campaignData.type === 'one-time' ? 'One-Time Broadcast' : 'Ongoing Campaign', icon: Zap },
            { label: 'Recipients', value: `${audienceCount} contact${audienceCount !== 1 ? 's' : ''} (${campaignData.audienceMode === 'all' ? 'All Contacts' : campaignData.audienceMode === 'tags' ? 'Filtered by Tags' : 'CSV Upload'})`, icon: Users },
            { label: 'Template', value: selectedTemplate?.name || 'Not selected', icon: FileText },
            { label: 'Schedule', value: campaignData.scheduleType === 'now' ? 'Send immediately' : `${campaignData.scheduleDate} at ${campaignData.scheduleTime}`, icon: Clock },
            { 
              label: 'Optimization', 
              value: campaignData.deliveryOptimization.enabled 
                ? (campaignData.deliveryOptimization.type === 'RCS_FALLBACK' ? 'RCS Fallback Enabled' : 'Automated Retries Enabled')
                : 'Disabled', 
              icon: Zap 
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-3 bg-card/80 rounded-xl border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5 break-words">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Tags Display */}
        {campaignData.audienceMode === 'tags' && campaignData.selectedTags.length > 0 && (
          <div className="px-4 py-3 bg-card/80 rounded-xl border border-border/50">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Selected Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {campaignData.selectedTags.map(tag => (
                <span key={tag} className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Variable Mapping Summary */}
        {templateVariables.length > 0 && Object.keys(campaignData.variableMapping).length > 0 && (
          <div className="px-4 py-3 bg-card/80 rounded-xl border border-border/50">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Variable Mapping</p>
            <div className="space-y-1">
              {templateVariables.map(v => (
                <div key={v} className="flex items-center gap-2 text-xs">
                  <code className="text-primary font-bold">{`{{${v}}}`}</code>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-foreground font-medium">
                    {campaignData.variableMapping[v]
                      ? contactFields.find(f => f.value === campaignData.variableMapping[v])?.label || campaignData.variableMapping[v]
                      : 'Not mapped'}
                  </span>
                  {campaignData.variableFallbacks[v] && (
                    <span className="text-muted-foreground">(fallback: {campaignData.variableFallbacks[v]})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {campaignData.description && (
          <div className="px-4 py-3 bg-card/80 rounded-xl border border-border/50">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-foreground">{campaignData.description}</p>
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {campaignData.scheduleType === 'now'
            ? 'Your campaign will start sending within 30–60 seconds after launch.'
            : 'Your campaign will be queued and sent at the scheduled time.'
          }
        </p>
      </div>
    </div>
  );

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
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderStep6()}

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