'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import {
  MATCH_MODES,
  TRIGGER_TYPES,
  fetchTemplates,
  Template,
  TemplateRule,
  TemplateRuleFormData,
  TemplateRuleFormPayload,
  TemplateRuleMatchMode,
  TemplateRuleTriggerType,
} from '@/lib/api/templates';

/**
 * TemplateRuleEditor
 * Form for creating and editing template rules
 */
interface TemplateRuleEditorProps {
  rule?: Partial<TemplateRule> | null;
  templates?: Template[];
  onSave: (rule: TemplateRuleFormPayload) => void;
  onCancel: () => void;
}

export default function TemplateRuleEditor({ rule = null, templates = [], onSave, onCancel }: TemplateRuleEditorProps) {
  const [templateList, setTemplateList] = useState<Template[]>(templates);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'template' | 'keywords', string>>>({});

  const [formData, setFormData] = useState<TemplateRuleFormData>({
    name: rule?.name || '',
    description: rule?.description || '',
    triggerType: (rule?.triggerType || 'message_keyword') as TemplateRuleTriggerType,
    keywords: rule?.keywords?.length ? rule.keywords : [''],
    matchMode: (rule?.matchMode || 'contains') as TemplateRuleMatchMode,
    template: typeof rule?.template === 'string' ? rule.template : rule?.template?._id || '',
    conditions: {
      conversationStatus: rule?.conditions?.conversationStatus || '',
      timeWindow: rule?.conditions?.timeWindow || { startTime: '', endTime: '', timezone: 'UTC' },
      country: rule?.conditions?.country || '',
      requiresTags: rule?.conditions?.requiresTags?.length ? rule.conditions.requiresTags : [''],
    },
    rateLimit: {
      enabled: rule?.rateLimit?.enabled ?? false,
      window: rule?.rateLimit?.window ?? 24,
      maxTriggers: rule?.rateLimit?.maxTriggers ?? 5,
    },
    priority: rule?.priority ?? 100,
    enabled: rule?.enabled ?? true,
  });

  useEffect(() => {
    if (templates.length === 0) {
      loadTemplates();
    }
  }, [templates]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetchTemplates({ limit: 100 });
      setTemplateList(response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Partial<Record<'name' | 'template' | 'keywords', string>> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.template) newErrors.template = 'Template is required';
    if (formData.keywords.filter((keyword) => keyword.trim()).length === 0 && formData.triggerType === 'message_keyword') {
      newErrors.keywords = 'At least one keyword is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave({
        ...formData,
        keywords: formData.keywords.filter((keyword) => keyword.trim()),
        conditions: {
          ...formData.conditions,
          requiresTags: formData.conditions.requiresTags.filter((tag) => tag.trim()),
        },
        ...(rule?._id && { id: rule._id })
      });
    }
  };

  const addKeyword = () => {
    setFormData({
      ...formData,
      keywords: [...formData.keywords, '']
    });
  };

  const removeKeyword = (index: number) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter((_: any, i: number) => i !== index)
    });
  };

  const addTag = () => {
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        requiresTags: [...formData.conditions.requiresTags, '']
      }
    });
  };

  const removeTag = (index: number) => {
    setFormData({
      ...formData,
      conditions: {
        ...formData.conditions,
        requiresTags: formData.conditions.requiresTags.filter((_: any, i: number) => i !== index)
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 border-b border-gray-200 p-6 flex items-center justify-between bg-white">
          <h2 className="text-xl font-bold text-gray-900">
            {rule ? 'Edit Rule' : 'Create New Rule'}
          </h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  (errors as any).name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Help Request Handler"
              />
              {errors && (errors as any).name && <p className="text-red-600 text-xs mt-1">{(errors as any).name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                placeholder="Optional description of what this rule does"
                rows={2}
              />
            </div>
          </div>

          {/* Trigger Configuration */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Trigger Setup</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trigger Type *
              </label>
              <select
                value={formData.triggerType}
                onChange={(e) => setFormData({ ...formData, triggerType: e.target.value as TemplateRuleTriggerType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
              >
                {TRIGGER_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Keywords for message_keyword trigger */}
            {formData.triggerType === 'message_keyword' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords to Match *
                </label>
                <select
                  value={formData.matchMode}
                  onChange={(e) => setFormData({ ...formData, matchMode: e.target.value as TemplateRuleMatchMode })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 mb-3"
                >
                  {MATCH_MODES.map(mode => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
                
                <div className="space-y-2">
                  {formData.keywords.map((keyword: any, idx: number) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => {
                          const newKeywords = [...formData.keywords];
                          newKeywords[idx] = e.target.value;
                          setFormData({ ...formData, keywords: newKeywords });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                        placeholder={`Keyword ${idx + 1}`}
                      />
                      {formData.keywords.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeKeyword(idx)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addKeyword}
                  className="mt-2 flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Plus size={16} /> Add Keyword
                </button>
                {errors && (errors as any).keywords && <p className="text-red-600 text-xs mt-1">{(errors as any).keywords}</p>}
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Template *
              </label>
              <select
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  (errors as any).template ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Choose a template...</option>
                {templateList.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {errors && (errors as any).template && <p className="text-red-600 text-xs mt-1">{(errors as any).template}</p>}
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Conditions (Optional)</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conversation Status
              </label>
              <select
                value={formData.conditions.conversationStatus}
                onChange={(e) => setFormData({
                  ...formData,
                  conditions: { ...formData.conditions, conversationStatus: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
              >
                <option value="">Any status</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Required Tags
              </label>
              <div className="space-y-2">
                {formData.conditions.requiresTags.map((tag: any, idx: number) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={tag}
                      onChange={(e) => {
                        const newTags = [...formData.conditions.requiresTags];
                        newTags[idx] = e.target.value;
                        setFormData({
                          ...formData,
                          conditions: { ...formData.conditions, requiresTags: newTags }
                        });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                      placeholder="Tag name"
                    />
                    {formData.conditions.requiresTags.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTag(idx)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTag}
                className="mt-2 flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Plus size={16} /> Add Tag
              </button>
            </div>
          </div>

          {/* Rate Limiting */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Rate Limiting</h3>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.rateLimit.enabled}
                onChange={(e) => setFormData({
                  ...formData,
                  rateLimit: { ...formData.rateLimit, enabled: e.target.checked }
                })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Enable rate limiting</span>
            </label>

            {formData.rateLimit.enabled && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Window (hours)
                  </label>
                  <input
                    type="number"
                    value={formData.rateLimit.window}
                    onChange={(e) => setFormData({
                      ...formData,
                      rateLimit: { ...formData.rateLimit, window: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Triggers
                  </label>
                  <input
                    type="number"
                    value={formData.rateLimit.maxTriggers}
                    onChange={(e) => setFormData({
                      ...formData,
                      rateLimit: { ...formData.rateLimit, maxTriggers: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
            >
              {rule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
