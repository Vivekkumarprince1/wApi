/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INTERAKT-STYLE STEP-BASED TEMPLATE BUILDER (Stage 2 - Task 5)
 * 
 * Multi-step wizard for creating WhatsApp templates:
 * Step 1: Template Details (Name, Category, Language)
 * Step 2: Message Content (Header, Body, Footer)
 * Step 3: Buttons (Optional)
 * Step 4: Review & Submit
 * 
 * Users NEVER edit raw JSON - everything is guided UI
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FaArrowRight, 
  FaArrowLeft, 
  FaCheck, 
  FaPaperPlane,
  FaSave,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaImage,
  FaVideo,
  FaFileAlt,
  FaFont,
  FaPlus,
  FaTrash,
  FaReply,
  FaExternalLinkAlt,
  FaPhone,
  FaCopy
} from 'react-icons/fa';
import WhatsAppPreview from './WhatsAppPreview';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STEPS = [
  { id: 1, name: 'Details', description: 'Name, category & language' },
  { id: 2, name: 'Content', description: 'Header, body & footer' },
  { id: 3, name: 'Buttons', description: 'Add call-to-action buttons' },
  { id: 4, name: 'Review', description: 'Preview & submit' }
];

const CATEGORIES = [
  { 
    value: 'MARKETING', 
    label: 'Marketing', 
    description: 'Promotional content, offers, newsletters',
    icon: '📢',
    examples: ['Special offers', 'New product launches', 'Newsletters']
  },
  { 
    value: 'UTILITY', 
    label: 'Utility', 
    description: 'Order updates, account alerts, confirmations',
    icon: '🔔',
    examples: ['Order confirmations', 'Shipping updates', 'Appointment reminders']
  },
  { 
    value: 'AUTHENTICATION', 
    label: 'Authentication', 
    description: 'OTP codes, login verification',
    icon: '🔐',
    examples: ['One-time passwords', 'Login verification', 'Account verification']
  }
];

const LANGUAGES = {
  'en': 'English',
  'en_US': 'English (US)',
  'en_GB': 'English (UK)',
  'es': 'Spanish',
  'pt_BR': 'Portuguese (Brazil)',
  'hi': 'Hindi',
  'ar': 'Arabic',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'id': 'Indonesian',
  'ms': 'Malay',
  'th': 'Thai',
  'vi': 'Vietnamese',
  'zh_CN': 'Chinese (Simplified)',
  'ja': 'Japanese',
  'ko': 'Korean'
};

const LIMITS = {
  NAME_MAX: 512,
  HEADER_TEXT_MAX: 60,
  BODY_MAX: 1024,
  BODY_MIN: 1,
  FOOTER_MAX: 60,
  BUTTON_TEXT_MAX: 25,
  MAX_BUTTONS: 10,
  MAX_URL_BUTTONS: 2,
  MAX_PHONE_BUTTONS: 1
};

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function extractVariables(text) {
  if (!text) return [];
  const matches = text.match(/\{\{(\d+)\}\}/g) || [];
  return matches.map(m => parseInt(m.replace(/[{}]/g, ''))).sort((a, b) => a - b);
}

function validateStep(step, template) {
  const errors = [];
  const warnings = [];

  switch (step) {
    case 1: // Details
      if (!template.name) {
        errors.push({ field: 'name', message: 'Template name is required' });
      } else if (!/^[a-z0-9_]+$/.test(template.name)) {
        errors.push({ field: 'name', message: 'Only lowercase letters, numbers, and underscores allowed' });
      } else if (template.name.length < 1) {
        errors.push({ field: 'name', message: 'Name must be at least 1 character' });
      }
      if (!template.category) {
        errors.push({ field: 'category', message: 'Category is required' });
      }
      if (!template.language) {
        errors.push({ field: 'language', message: 'Language is required' });
      }
      break;

    case 2: // Content
      if (!template.body?.text || template.body.text.trim().length === 0) {
        errors.push({ field: 'body', message: 'Body text is required' });
      } else {
        if (template.body.text.length > LIMITS.BODY_MAX) {
          errors.push({ field: 'body', message: `Body exceeds ${LIMITS.BODY_MAX} characters` });
        }
        
        const vars = extractVariables(template.body.text);
        const sorted = [...new Set(vars)].sort((a, b) => a - b);
        for (let i = 0; i < sorted.length; i++) {
          if (sorted[i] !== i + 1) {
            errors.push({ field: 'body', message: 'Variables must be sequential starting from {{1}}' });
            break;
          }
        }
        
        if (vars.length > 0 && (!template.body.examples || template.body.examples.length < vars.length)) {
          errors.push({ field: 'body.examples', message: `Provide example values for all ${vars.length} variables` });
        }
      }
      
      if (template.header?.enabled && template.header.format === 'TEXT') {
        if (!template.header.text) {
          errors.push({ field: 'header', message: 'Header text is required' });
        } else if (template.header.text.length > LIMITS.HEADER_TEXT_MAX) {
          errors.push({ field: 'header', message: `Header exceeds ${LIMITS.HEADER_TEXT_MAX} characters` });
        }
      }
      
      if (template.footer?.enabled && template.footer.text) {
        if (template.footer.text.length > LIMITS.FOOTER_MAX) {
          errors.push({ field: 'footer', message: `Footer exceeds ${LIMITS.FOOTER_MAX} characters` });
        }
      }
      
      // Authentication rules
      if (template.category === 'AUTHENTICATION') {
        if (template.header?.enabled) {
          errors.push({ field: 'header', message: 'Authentication templates cannot have headers' });
        }
        if (!template.body?.text?.includes('{{1}}')) {
          errors.push({ field: 'body', message: 'Authentication templates must include {{1}} for OTP' });
        }
      }
      break;

    case 3: // Buttons
      if (template.buttons?.enabled && template.buttons.items?.length > 0) {
        const buttonCounts = { URL: 0, PHONE_NUMBER: 0, QUICK_REPLY: 0, COPY_CODE: 0 };
        
        template.buttons.items.forEach((btn, i) => {
          buttonCounts[btn.type] = (buttonCounts[btn.type] || 0) + 1;
          
          if (!btn.text || btn.text.trim().length === 0) {
            errors.push({ field: `button_${i}`, message: `Button ${i + 1} text is required` });
          } else if (btn.text.length > LIMITS.BUTTON_TEXT_MAX) {
            errors.push({ field: `button_${i}`, message: `Button ${i + 1} text exceeds ${LIMITS.BUTTON_TEXT_MAX} chars` });
          }
          
          if (btn.type === 'URL' && (!btn.url || !btn.url.startsWith('https://'))) {
            errors.push({ field: `button_${i}`, message: `Button ${i + 1} requires a valid HTTPS URL` });
          }
          
          if (btn.type === 'PHONE_NUMBER' && (!btn.phoneNumber || !btn.phoneNumber.startsWith('+'))) {
            errors.push({ field: `button_${i}`, message: `Button ${i + 1} requires phone in international format (+...)` });
          }
        });
        
        if (buttonCounts.URL > LIMITS.MAX_URL_BUTTONS) {
          errors.push({ field: 'buttons', message: `Maximum ${LIMITS.MAX_URL_BUTTONS} URL buttons allowed` });
        }
        if (buttonCounts.PHONE_NUMBER > LIMITS.MAX_PHONE_BUTTONS) {
          errors.push({ field: 'buttons', message: `Maximum ${LIMITS.MAX_PHONE_BUTTONS} phone button allowed` });
        }
      }
      break;

    case 4: // Review - run all validations
      const step1 = validateStep(1, template);
      const step2 = validateStep(2, template);
      const step3 = validateStep(3, template);
      errors.push(...step1.errors, ...step2.errors, ...step3.errors);
      warnings.push(...step1.warnings, ...step2.warnings, ...step3.warnings);
      break;
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Progress Stepper
const StepIndicator = ({ steps, currentStep, onStepClick }) => (
  <div className="flex items-center justify-center mb-8">
    {steps.map((step, index) => {
      const isCompleted = currentStep > step.id;
      const isCurrent = currentStep === step.id;
      
      return (
        <React.Fragment key={step.id}>
          <button
            onClick={() => onStepClick(step.id)}
            disabled={step.id > currentStep + 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
              isCurrent 
                ? 'bg-green-600 text-white shadow-lg scale-105' 
                : isCompleted 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
              isCompleted ? 'bg-green-600 text-white' : ''
            }`}>
              {isCompleted ? <FaCheck className="text-xs" /> : step.id}
            </span>
            <span className="font-medium hidden sm:inline">{step.name}</span>
          </button>
          
          {index < steps.length - 1 && (
            <div className={`w-8 sm:w-16 h-1 mx-2 rounded ${
              isCompleted ? 'bg-green-500' : 'bg-gray-200'
            }`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// Step 1: Template Details
const Step1Details = ({ template, updateTemplate, validation }) => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-gray-900">Template Details</h2>
      <p className="text-gray-500 mt-2">Choose a name, category, and language for your template</p>
    </div>

    {/* Template Name */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Template Name <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={template.name}
        onChange={(e) => updateTemplate('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
        placeholder="e.g., order_confirmation"
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
      />
      <p className="text-sm text-gray-500 mt-2">
        Only lowercase letters, numbers, and underscores. This cannot be changed after creation.
      </p>
    </div>

    {/* Category Selection */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3">
        Category <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            type="button"
            onClick={() => updateTemplate('category', cat.value)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              template.category === cat.value
                ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{cat.icon}</span>
              <span className="font-semibold text-gray-900">{cat.label}</span>
            </div>
            <p className="text-sm text-gray-500">{cat.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {cat.examples.map((ex, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {ex}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>

    {/* Language Selection */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Language <span className="text-red-500">*</span>
      </label>
      <select
        value={template.language}
        onChange={(e) => updateTemplate('language', e.target.value)}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
      >
        {Object.entries(LANGUAGES).map(([code, name]) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>
    </div>

    {/* Validation Errors */}
    {validation.errors.length > 0 && (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        {validation.errors.map((err, i) => (
          <div key={i} className="flex items-center gap-2 text-red-700 text-sm">
            <FaExclamationTriangle className="flex-shrink-0" />
            <span>{err.message}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Step 2: Message Content
const Step2Content = ({ template, updateTemplate, validation }) => {
  const bodyVariables = useMemo(() => extractVariables(template.body?.text || ''), [template.body?.text]);
  
  const insertVariable = (field) => {
    const currentVars = field === 'body' 
      ? extractVariables(template.body?.text || '')
      : extractVariables(template.header?.text || '');
    const nextVar = currentVars.length > 0 ? Math.max(...currentVars) + 1 : 1;
    
    if (field === 'body') {
      updateTemplate('body.text', (template.body?.text || '') + `{{${nextVar}}}`);
    } else {
      updateTemplate('header.text', (template.header?.text || '') + `{{${nextVar}}}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Message Content</h2>
        <p className="text-gray-500 mt-2">Build your message with header, body, and footer</p>
      </div>

      {/* Header Section (not for Authentication) */}
      {template.category !== 'AUTHENTICATION' && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Header</h3>
              <p className="text-sm text-gray-500">Optional header with text or media</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={template.header?.enabled || false}
                onChange={(e) => updateTemplate('header.enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          {template.header?.enabled && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map(format => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => updateTemplate('header.format', format)}
                    className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                      template.header?.format === format
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {format === 'TEXT' && <FaFont />}
                    {format === 'IMAGE' && <FaImage />}
                    {format === 'VIDEO' && <FaVideo />}
                    {format === 'DOCUMENT' && <FaFileAlt />}
                    {format}
                  </button>
                ))}
              </div>

              {template.header?.format === 'TEXT' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Header Text</label>
                    <span className="text-sm text-gray-400">
                      {template.header?.text?.length || 0}/{LIMITS.HEADER_TEXT_MAX}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={template.header?.text || ''}
                    onChange={(e) => updateTemplate('header.text', e.target.value)}
                    placeholder="Enter header text"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}

              {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.header?.format) && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Media URL (for sample)
                  </label>
                  <input
                    type="url"
                    value={template.header?.mediaUrl || ''}
                    onChange={(e) => updateTemplate('header.mediaUrl', e.target.value)}
                    placeholder="https://example.com/media.jpg"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Body Section */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Body <span className="text-red-500">*</span></h3>
            <p className="text-sm text-gray-500">Main message content</p>
          </div>
          <button
            type="button"
            onClick={() => insertVariable('body')}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200"
          >
            + Add Variable
          </button>
        </div>

        <div className="mb-2 flex justify-end">
          <span className="text-sm text-gray-400">
            {template.body?.text?.length || 0}/{LIMITS.BODY_MAX}
          </span>
        </div>

        <textarea
          value={template.body?.text || ''}
          onChange={(e) => updateTemplate('body.text', e.target.value)}
          rows={6}
          placeholder={template.category === 'AUTHENTICATION' 
            ? 'Your OTP code is {{1}}. Valid for 10 minutes.'
            : 'Enter your message here. Use {{1}}, {{2}} for personalization.'}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm resize-none"
        />

        <div className="mt-2 text-xs text-gray-500">
          <strong>Formatting:</strong> *bold* _italic_ ~strikethrough~
        </div>

        {/* Variable Examples */}
        {bodyVariables.length > 0 && (
          <div className="mt-4 bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-3">
              Provide example values for your variables:
            </p>
            <div className="grid gap-2">
              {bodyVariables.map((varNum, index) => (
                <div key={varNum} className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono text-sm">
                    {`{{${varNum}}}`}
                  </span>
                  <input
                    type="text"
                    value={template.body?.examples?.[index] || ''}
                    onChange={(e) => {
                      const newExamples = [...(template.body?.examples || [])];
                      newExamples[index] = e.target.value;
                      updateTemplate('body.examples', newExamples);
                    }}
                    placeholder={`Example value for {{${varNum}}}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Footer</h3>
            <p className="text-sm text-gray-500">Optional footer text (no variables)</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={template.footer?.enabled || false}
              onChange={(e) => updateTemplate('footer.enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>

        {template.footer?.enabled && (
          <input
            type="text"
            value={template.footer?.text || ''}
            onChange={(e) => updateTemplate('footer.text', e.target.value)}
            placeholder="e.g., Reply STOP to unsubscribe"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        )}
      </div>

      {/* Validation Errors */}
      {validation.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          {validation.errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-red-700 text-sm">
              <FaExclamationTriangle className="flex-shrink-0" />
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Step 3: Buttons
const Step3Buttons = ({ template, updateTemplate, validation }) => {
  const addButton = () => {
    const currentItems = template.buttons?.items || [];
    updateTemplate('buttons', {
      enabled: true,
      items: [...currentItems, { type: 'QUICK_REPLY', text: '', url: '', phoneNumber: '' }]
    });
  };

  const updateButton = (index, field, value) => {
    const newItems = [...(template.buttons?.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    updateTemplate('buttons.items', newItems);
  };

  const removeButton = (index) => {
    const newItems = (template.buttons?.items || []).filter((_, i) => i !== index);
    updateTemplate('buttons', {
      enabled: newItems.length > 0,
      items: newItems
    });
  };

  const buttonTypes = [
    { value: 'QUICK_REPLY', label: 'Quick Reply', icon: FaReply, description: 'User taps to reply' },
    { value: 'URL', label: 'Visit Website', icon: FaExternalLinkAlt, description: 'Opens a URL' },
    { value: 'PHONE_NUMBER', label: 'Call Phone', icon: FaPhone, description: 'Makes a call' },
    { value: 'COPY_CODE', label: 'Copy Code', icon: FaCopy, description: 'Copies OTP' }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Add Buttons</h2>
        <p className="text-gray-500 mt-2">Optional call-to-action buttons for your template</p>
      </div>

      {/* Enable Buttons Toggle */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Enable Buttons</h3>
            <p className="text-sm text-gray-500">Add interactive buttons to your message</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={template.buttons?.enabled || false}
              onChange={(e) => updateTemplate('buttons.enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>
      </div>

      {template.buttons?.enabled && (
        <>
          {/* Button List */}
          <div className="space-y-4">
            {(template.buttons?.items || []).map((button, index) => (
              <div key={index} className="bg-white rounded-xl border-2 border-gray-200 p-4 relative">
                <button
                  type="button"
                  onClick={() => removeButton(index)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
                >
                  <FaTrash />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Button Type */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {buttonTypes.map(type => {
                        const Icon = type.icon;
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => updateButton(index, 'type', type.value)}
                            className={`p-2 rounded-lg border text-left text-sm ${
                              button.type === type.value
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <Icon className="inline mr-2" />
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Button Text */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Button Text <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={button.text || ''}
                      onChange={(e) => updateButton(index, 'text', e.target.value)}
                      placeholder="e.g., Shop Now"
                      maxLength={LIMITS.BUTTON_TEXT_MAX}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <span className="text-xs text-gray-400">
                      {button.text?.length || 0}/{LIMITS.BUTTON_TEXT_MAX}
                    </span>
                  </div>

                  {/* Type-specific fields */}
                  {button.type === 'URL' && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={button.url || ''}
                        onChange={(e) => updateButton(index, 'url', e.target.value)}
                        placeholder="https://example.com/shop"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  )}

                  {button.type === 'PHONE_NUMBER' && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={button.phoneNumber || ''}
                        onChange={(e) => updateButton(index, 'phoneNumber', e.target.value)}
                        placeholder="+1234567890"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">International format required</p>
                    </div>
                  )}

                  {button.type === 'COPY_CODE' && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-2">
                        Example Code
                      </label>
                      <input
                        type="text"
                        value={button.example || ''}
                        onChange={(e) => updateButton(index, 'example', e.target.value)}
                        placeholder="123456"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Button */}
          {(template.buttons?.items?.length || 0) < LIMITS.MAX_BUTTONS && (
            <button
              type="button"
              onClick={addButton}
              className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-green-500 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <FaPlus />
              <span>Add Another Button</span>
            </button>
          )}
        </>
      )}

      {/* Validation Errors */}
      {validation.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          {validation.errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-red-700 text-sm">
              <FaExclamationTriangle className="flex-shrink-0" />
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Step 4: Review
const Step4Review = ({ template, validation }) => (
  <div className="space-y-6">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-gray-900">Review & Submit</h2>
      <p className="text-gray-500 mt-2">Review your template before submitting for approval</p>
    </div>

    {/* Summary Cards */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-500 mb-2">Template Name</h4>
        <p className="font-semibold text-gray-900">{template.name || '-'}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-500 mb-2">Category</h4>
        <p className="font-semibold text-gray-900">
          {CATEGORIES.find(c => c.value === template.category)?.label || '-'}
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-500 mb-2">Language</h4>
        <p className="font-semibold text-gray-900">{LANGUAGES[template.language] || '-'}</p>
      </div>
    </div>

    {/* Preview */}
    <div className="flex justify-center">
      <div className="w-full max-w-sm">
        <h4 className="text-center font-medium text-gray-700 mb-4">WhatsApp Preview</h4>
        <WhatsAppPreview template={template} />
      </div>
    </div>

    {/* Validation Status */}
    {validation.valid ? (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <FaCheckCircle className="text-green-600 text-xl" />
        <div>
          <p className="font-medium text-green-800">Template is ready to submit!</p>
          <p className="text-sm text-green-600">All validations passed. Click Submit to send for Meta approval.</p>
        </div>
      </div>
    ) : (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <FaExclamationTriangle className="text-red-600 text-xl" />
          <p className="font-medium text-red-800">Please fix the following issues:</p>
        </div>
        <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
          {validation.errors.map((err, i) => (
            <li key={i}>{err.message}</li>
          ))}
        </ul>
      </div>
    )}

    {/* Info Box */}
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
      <FaInfoCircle className="text-blue-600 mt-0.5" />
      <div className="text-sm text-blue-800">
        <p className="font-medium mb-1">What happens next?</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700">
          <li>Your template will be sent to Meta for review</li>
          <li>Review usually takes 5-10 minutes but can take up to 24 hours</li>
          <li>You&apos;ll be notified when your template is approved or rejected</li>
          <li>Only approved templates can be used for sending messages</li>
        </ul>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const TemplateStepBuilder = ({
  initialData = null,
  onSave,
  onSubmit,
  onCancel,
  isEditing = false,
  isSubmitting = false,
  isSaving = false
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [template, setTemplate] = useState({
    name: '',
    language: 'en',
    category: 'MARKETING',
    header: { enabled: false, format: 'TEXT', text: '', mediaUrl: '' },
    body: { text: '', examples: [] },
    footer: { enabled: false, text: '' },
    buttons: { enabled: false, items: [] }
  });

  // Initialize from existing data
  useEffect(() => {
    if (initialData) {
      setTemplate({
        name: initialData.name || '',
        language: initialData.language || 'en',
        category: initialData.category || 'MARKETING',
        header: initialData.header || { enabled: false, format: 'TEXT', text: '', mediaUrl: '' },
        body: initialData.body || { text: '', examples: [] },
        footer: initialData.footer || { enabled: false, text: '' },
        buttons: initialData.buttons || { enabled: false, items: [] }
      });
    }
  }, [initialData]);

  // Update template helper
  const updateTemplate = useCallback((path, value) => {
    setTemplate(prev => {
      const newTemplate = { ...prev };
      const keys = path.split('.');
      let current = newTemplate;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newTemplate;
    });
  }, []);

  // Validation for current step
  const validation = useMemo(() => validateStep(currentStep, template), [currentStep, template]);

  // Navigation
  const canGoNext = validation.valid;
  const goNext = () => {
    if (canGoNext && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };
  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (step) => {
    // Can only go to completed steps or the next step
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const handleSave = () => {
    if (onSave) onSave(template);
  };

  const handleSubmit = () => {
    const finalValidation = validateStep(4, template);
    if (finalValidation.valid && onSubmit) {
      onSubmit(template);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1Details template={template} updateTemplate={updateTemplate} validation={validation} />;
      case 2:
        return <Step2Content template={template} updateTemplate={updateTemplate} validation={validation} />;
      case 3:
        return <Step3Buttons template={template} updateTemplate={updateTemplate} validation={validation} />;
      case 4:
        return <Step4Review template={template} validation={validateStep(4, template)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Step Indicator */}
        <StepIndicator 
          steps={STEPS} 
          currentStep={currentStep} 
          onStepClick={handleStepClick}
        />

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goBack}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium flex items-center gap-2"
              >
                <FaArrowLeft />
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {/* Save Draft (available on all steps) */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !template.name}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <FaSave />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>

            {/* Next/Submit Button */}
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <FaArrowRight />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !validateStep(4, template).valid}
                className="px-8 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaPaperPlane />
                {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateStepBuilder;
