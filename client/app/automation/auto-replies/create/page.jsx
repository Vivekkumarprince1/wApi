'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaPlus, FaTrash, FaEye, FaClock, FaBolt, FaKeyboard } from 'react-icons/fa';
import Link from 'next/link';
import { createAutoReply, getTemplates, getTemplate } from '@/lib/api';
import { toast } from 'react-toastify';

export default function CreateAutoReplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplateData, setSelectedTemplateData] = useState(null);
  
  const [formData, setFormData] = useState({
    keywords: [''],
    template: '',
    matchMode: 'contains',
    triggerType: 'keyword',
    enabled: true
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (formData.template) {
      fetchTemplatePreview(formData.template);
    } else {
      setSelectedTemplateData(null);
    }
  }, [formData.template]);

  const loadTemplates = async () => {
    try {
      const data = await getTemplates({ status: 'APPROVED' });
      const templateList = Array.isArray(data) ? data : (data.templates || []);
      setTemplates(templateList);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchTemplatePreview = async (templateId) => {
    try {
      const template = await getTemplate(templateId);
      setSelectedTemplateData(template);
    } catch (err) {
      console.error('Error fetching template preview:', err);
    }
  };

  const handleKeywordChange = (index, value) => {
    const newKeywords = [...formData.keywords];
    newKeywords[index] = value.toLowerCase();
    setFormData({ ...formData, keywords: newKeywords });
  };

  const addKeyword = () => {
    if (formData.keywords.length < 10) {
      setFormData({ ...formData, keywords: [...formData.keywords, ''] });
    }
  };

  const removeKeyword = (index) => {
    const newKeywords = formData.keywords.filter((_, i) => i !== index);
    setFormData({ ...formData, keywords: newKeywords });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    let validKeywords = [];
    if (formData.triggerType === 'keyword') {
      validKeywords = formData.keywords.filter(k => k.trim());
      if (validKeywords.length === 0) {
        setError('Please add at least one keyword');
        return;
      }
      if (validKeywords.length > 10) {
        setError('Maximum 10 keywords allowed');
        return;
      }
    }

    if (!formData.template) {
      setError('Please select a template');
      return;
    }

    setLoading(true);

    try {
      await createAutoReply({
        keywords: validKeywords,
        template: formData.template,
        matchMode: formData.matchMode,
        triggerType: formData.triggerType,
        enabled: formData.enabled
      });

      toast?.success?.('Auto-reply created successfully');
      router.push('/automation/auto-replies');
    } catch (err) {
      setError(err.message || 'Failed to create auto-reply');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/automation/auto-replies"
            className="inline-flex items-center gap-2 text-primary hover:opacity-80 mb-4 transition-all"
          >
            <FaArrowLeft /> Back to Auto-Replies
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Create New Auto-Reply</h1>
          <p className="text-muted-foreground mt-1">Set up automatic responses for specific triggers</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Trigger Type */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">When should this reply trigger?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'keyword', label: 'Keyword Match', icon: FaKeyboard, desc: 'Specific keywords trigger the reply' },
                    { id: 'always', label: 'Always', icon: FaBolt, desc: 'Every inbound message triggers it' },
                    { id: 'outside_business_hours', label: 'Away Message', icon: FaClock, desc: 'Only outside business hours' }
                  ].map((trigger) => (
                    <label 
                      key={trigger.id}
                      className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${
                        formData.triggerType === trigger.id 
                          ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <trigger.icon className={`h-4 w-4 ${formData.triggerType === trigger.id ? 'text-primary' : 'text-muted-foreground'}`} />
                        <input
                          type="radio"
                          name="triggerType"
                          value={trigger.id}
                          checked={formData.triggerType === trigger.id}
                          onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
                          className="w-4 h-4 text-primary"
                        />
                      </div>
                      <span className="font-bold text-sm">{trigger.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight mt-1">
                        {trigger.desc}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Keywords Section - Only shown if triggerType is keyword */}
              {formData.triggerType === 'keyword' && (
                <>
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6 animate-fade-in">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Keywords</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add up to 10 keywords that will trigger this auto-reply.
                    </p>

                    <div className="space-y-3 mb-4">
                      {formData.keywords.map((keyword, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={keyword}
                            onChange={(e) => handleKeywordChange(index, e.target.value)}
                            placeholder={`Keyword ${index + 1}`}
                            className="input-premium py-2"
                          />
                          {formData.keywords.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeKeyword(index)}
                              className="px-4 py-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {formData.keywords.length < 10 && (
                      <button
                        type="button"
                        onClick={addKeyword}
                        className="flex items-center gap-2 px-4 py-2 text-primary hover:bg-primary/5 rounded-xl font-medium transition-colors"
                      >
                        <FaPlus /> Add Keyword
                      </button>
                    )}
                  </div>

                  {/* Match Mode */}
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6 animate-fade-in">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Match Mode</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {['contains', 'exact', 'starts_with'].map((mode) => (
                        <label 
                          key={mode}
                          className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${
                            formData.matchMode === mode 
                              ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                              : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm capitalize">{mode.replace('_', ' ')}</span>
                            <input
                              type="radio"
                              name="matchMode"
                              value={mode}
                              checked={formData.matchMode === mode}
                              onChange={(e) => setFormData({ ...formData, matchMode: e.target.value })}
                              className="w-4 h-4 text-primary"
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground leading-tight">
                            {mode === 'contains' && 'Match if message contains keyword anywhere.'}
                            {mode === 'exact' && 'Match if message is exactly the keyword.'}
                            {mode === 'starts_with' && 'Match if message starts with keyword.'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Template Selection */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Reply Template</h2>
                {templatesLoading ? (
                  <div className="h-10 w-full skeleton mb-2" />
                ) : templates.length === 0 ? (
                  <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
                    <p className="text-sm text-destructive">No approved templates found. Please create and approve a template first.</p>
                  </div>
                ) : (
                  <select
                    value={formData.template}
                    onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                    className="input-premium py-2"
                  >
                    <option value="">Select an approved template...</option>
                    {templates.map((template) => (
                      <option key={template._id} value={template._id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Status */}
              <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Enable Immediately</h2>
                    <p className="text-sm text-muted-foreground">Start responding to customers as soon as you save</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              {/* Submit Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading || templatesLoading}
                  className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {loading && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Create Auto-Reply
                </button>
                <Link
                  href="/automation/auto-replies"
                  className="flex-1 py-3 border border-border text-foreground rounded-xl font-medium hover:bg-accent/50 transition-colors text-center"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>

          {/* Preview Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              <div className="bg-card rounded-2xl border border-border shadow-premium overflow-hidden">
                <div className="px-6 py-4 bg-muted/30 border-b border-border flex items-center gap-2">
                  <FaEye className="text-primary" />
                  <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">Live Preview</h3>
                </div>
                <div className="p-6 bg-[#e5ddd5] dark:bg-gray-900 min-h-[300px] flex flex-col">
                  {selectedTemplateData ? (
                    <div className="self-start max-w-[85%] bg-white dark:bg-gray-800 rounded-lg rounded-tl-none shadow-sm p-3 relative mb-4">
                      <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-white dark:border-t-gray-800 border-l-[10px] border-l-transparent" />
                      
                      {/* Template Header */}
                      {selectedTemplateData.components?.find(c => c.type === 'HEADER')?.format === 'IMAGE' && (
                        <div className="aspect-video bg-muted rounded-md mb-2 flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Image Header</span>
                        </div>
                      )}
                      
                      {/* Template Body */}
                      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                        {selectedTemplateData.components?.find(c => c.type === 'BODY')?.text?.replace(/\{\{(\d+)\}\}/g, (match, p1) => `[Var ${p1}]`) || 'No content'}
                      </p>
                      
                      {/* Template Footer */}
                      {selectedTemplateData.components?.find(c => c.type === 'FOOTER')?.text && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          {selectedTemplateData.components.find(c => c.type === 'FOOTER').text}
                        </p>
                      )}
                      
                      <p className="text-[9px] text-gray-400 text-right mt-1">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-8">
                      <p className="text-sm text-muted-foreground italic">Select a template to see how it will look on WhatsApp</p>
                    </div>
                  )}
                  
                  {/* Template Buttons */}
                  {selectedTemplateData?.components?.find(c => c.type === 'BUTTONS')?.buttons?.map((btn, i) => (
                    <div key={i} className="self-start w-[85%] bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 rounded-lg shadow-sm py-2 px-4 mb-1 text-center">
                      <span className="text-primary text-xs font-medium">{btn.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
                <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2 uppercase tracking-wider">How it works</h4>
                <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-2 list-disc pl-4">
                  <li>Triggers based on your selected condition.</li>
                  <li>Respects a 24-hour window per contact to avoid spamming.</li>
                  <li>Evaluated before any other automation workflows.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
