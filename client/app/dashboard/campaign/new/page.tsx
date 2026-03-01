'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaRocket, FaUsers, FaFileAlt, FaClock, FaArrowLeft } from 'react-icons/fa';
import { fetchContacts, fetchTemplates, post } from '../../../../lib/api';
import { toast } from 'react-toastify';
import FeatureGate from '../../../../components/FeatureGate';
import QuotaWarning from '../../../../components/QuotaWarning';

function CampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [campaignData, setCampaignData] = useState({
    name: '',
    type: 'one-time',
    template: '',
    audience: 'all',
    selectedContacts: [],
    scheduleType: 'now',
    scheduleDate: '',
    scheduleTime: ''
  });
  
  const [contacts, setContacts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [contactsRes, templatesRes] = await Promise.all([
        fetchContacts(),
        fetchTemplates()
      ]);
      setContacts(contactsRes.contacts || []);
      setTemplates(templatesRes.templates || []);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (quotaExceeded) {
      toast?.error?.('Campaign limit reached. Please upgrade your plan.') || alert('Campaign limit reached. Please upgrade your plan.');
      return;
    }
    
    try {
      setLoading(true);
      
      // Build campaign payload
      const payload = {
        name: campaignData.name,
        campaignType: campaignData.type,
        templateId: campaignData.template,
        contactIds: campaignData.audience === 'all' 
          ? contacts.map(c => c._id || c.id) 
          : campaignData.selectedContacts,
        scheduleType: campaignData.scheduleType,
        ...(campaignData.scheduleType === 'later' && {
          scheduledAt: new Date(`${campaignData.scheduleDate}T${campaignData.scheduleTime}`).toISOString()
        })
      };

      const result = await post('/campaigns', payload);
      
      if (result.success || result.campaign) {
        toast?.success?.('Campaign created successfully!') || alert('✅ Campaign created successfully!');
        router.push('/campaign');
      } else {
        throw new Error(result.message || 'Failed to create campaign');
      }
    } catch (err: any) {
      console.error('Campaign creation error:', err);
      toast?.error?.(err.message || 'Failed to create campaign') || alert('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4].map((num) => (
        <React.Fragment key={num}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              step >= num
                ? 'bg-gradient-to-r from-primary to-primary/80 text-white'
                : 'bg-gray-200 dark:bg-muted text-muted-foreground'
            }`}
          >
            {num}
          </div>
          {num < 4 && (
            <div
              className={`w-16 h-1 ${
                step > num ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Campaign Name *
        </label>
        <input
          type="text"
          value={campaignData.name}
          onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
          placeholder="e.g., Black Friday Sale 2024"
          className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Campaign Type
        </label>
        <div className="grid grid-cols-2 gap-4">
          {['one-time', 'recurring'].map((type) => (
            <button
              key={type}
              onClick={() => setCampaignData({ ...campaignData, type })}
              className={`p-4 rounded-xl border-2 transition-all ${
                campaignData.type === type
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary'
              }`}
            >
              <div className="font-semibold text-foreground capitalize">
                {type.replace('-', ' ')}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {type === 'one-time' ? 'Send once to audience' : 'Schedule multiple sends'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Select Template *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          {templates.filter(t => t.status === 'APPROVED').map((template) => (
            <button
              key={template.id}
              onClick={() => setCampaignData({ ...campaignData, template: template.id })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                campaignData.template === template.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary'
              }`}
            >
              <div className="font-semibold text-foreground">{template.name}</div>
              <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {template.body}
              </div>
              <div className="text-xs text-primary mt-2">{template.category}</div>
            </button>
          ))}
        </div>
        {templates.filter(t => t.status === 'APPROVED').length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No approved templates found. Create and approve templates first.
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Select Audience
        </label>
        <div className="space-y-4">
          <button
            onClick={() => setCampaignData({ ...campaignData, audience: 'all' })}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              campaignData.audience === 'all'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">All Contacts</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Send to {contacts.length} contacts
                </div>
              </div>
              <FaUsers className="text-2xl text-primary" />
            </div>
          </button>

          <button
            onClick={() => setCampaignData({ ...campaignData, audience: 'custom' })}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              campaignData.audience === 'custom'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Custom Selection</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Choose specific contacts
                </div>
              </div>
              <FaUsers className="text-2xl text-primary" />
            </div>
          </button>
        </div>

        {campaignData.audience === 'custom' && (
          <div className="mt-4 p-4 border border-border rounded-xl max-h-64 overflow-y-auto">
            {contacts.map((contact) => (
              <label key={contact.id} className="flex items-center gap-3 p-2 hover:bg-accent dark:hover:bg-gray-800 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={campaignData.selectedContacts.includes(contact.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCampaignData({
                        ...campaignData,
                        selectedContacts: [...campaignData.selectedContacts, contact.id]
                      });
                    } else {
                      setCampaignData({
                        ...campaignData,
                        selectedContacts: campaignData.selectedContacts.filter(id => id !== contact.id)
                      });
                    }
                  }}
                  className="w-4 h-4 text-primary rounded focus:ring-ring"
                />
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {contact.firstName} {contact.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">{contact.phone}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Schedule Campaign
        </label>
        <div className="space-y-4">
          <button
            onClick={() => setCampaignData({ ...campaignData, scheduleType: 'now' })}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              campaignData.scheduleType === 'now'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Send Now</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Send campaign immediately
                </div>
              </div>
              <FaRocket className="text-2xl text-primary" />
            </div>
          </button>

          <button
            onClick={() => setCampaignData({ ...campaignData, scheduleType: 'later' })}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              campaignData.scheduleType === 'later'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Schedule for Later</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Pick a date and time
                </div>
              </div>
              <FaClock className="text-2xl text-primary" />
            </div>
          </button>
        </div>

        {campaignData.scheduleType === 'later' && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date
              </label>
              <input
                type="date"
                value={campaignData.scheduleDate}
                onChange={(e) => setCampaignData({ ...campaignData, scheduleDate: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Time
              </label>
              <input
                type="time"
                value={campaignData.scheduleTime}
                onChange={(e) => setCampaignData({ ...campaignData, scheduleTime: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-muted dark:bg-card rounded-xl p-6 space-y-3">
        <h3 className="font-bold text-lg text-foreground mb-4">Campaign Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name:</span>
            <span className="font-medium text-foreground">{campaignData.name || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type:</span>
            <span className="font-medium text-foreground capitalize">{campaignData.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Template:</span>
            <span className="font-medium text-foreground">
              {templates.find(t => t.id === campaignData.template)?.name || 'Not selected'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recipients:</span>
            <span className="font-medium text-foreground">
              {campaignData.audience === 'all'
                ? `${contacts.length} contacts`
                : `${campaignData.selectedContacts.length} selected`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Schedule:</span>
            <span className="font-medium text-foreground">
              {campaignData.scheduleType === 'now'
                ? 'Send immediately'
                : `${campaignData.scheduleDate} at ${campaignData.scheduleTime}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const isStepValid = () => {
    if (step === 1) return campaignData.name.trim() !== '';
    if (step === 2) return campaignData.template !== '';
    if (step === 3) {
      return campaignData.audience === 'all' || campaignData.selectedContacts.length > 0;
    }
    if (step === 4) {
      if (campaignData.scheduleType === 'later') {
        return campaignData.scheduleDate && campaignData.scheduleTime;
      }
      return true;
    }
    return true;
  };

  return (
    <div className="">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 shadow-premium">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/campaign')}
              className="p-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all"
            >
              <FaArrowLeft className="text-white text-xl" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Create New Campaign</h1>
              <p className="text-white/90 text-sm mt-1">Send WhatsApp messages to your audience</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quota Warning */}
        <QuotaWarning 
          resourceType="campaigns" 
          onLimitExceeded={() => setQuotaExceeded(true)} 
        />
        
        <div className="bg-card rounded-2xl shadow-premium p-8">
          {renderStepIndicator()}

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {step === 1 && 'Campaign Details'}
              {step === 2 && 'Choose Template'}
              {step === 3 && 'Select Audience'}
              {step === 4 && 'Review & Schedule'}
            </h2>
            <p className="text-muted-foreground">
              {step === 1 && 'Enter the basic information about your campaign'}
              {step === 2 && 'Select an approved template for your message'}
              {step === 3 && 'Choose who will receive this campaign'}
              {step === 4 && 'Review your campaign and schedule it'}
            </p>
          </div>

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="px-6 py-3 rounded-xl font-semibold text-foreground hover:bg-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>

            {step < 4 ? (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-primary to-primary/80 text-white shadow-premium hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!isStepValid() || loading || quotaExceeded}
                className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-primary to-primary/80 text-white shadow-premium hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
              >
                {loading ? 'Creating...' : 'Launch Campaign'} <FaRocket />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap with FeatureGate to enforce phone connection and role requirements
export default function NewCampaignPage() {
  return (
    <FeatureGate feature="campaigns">
      <CampaignWizard />
    </FeatureGate>
  );
}