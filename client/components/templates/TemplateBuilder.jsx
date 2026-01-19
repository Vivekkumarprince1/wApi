/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEMPLATE BUILDER COMPONENT (INTERAKT-STYLE)
 * 
 * Full-featured visual template builder with:
 * - Header builder (text, image, video, document)
 * - Body editor with variable insertion
 * - Footer section
 * - Button builder (quick reply, URL, phone, copy code)
 * - Live WhatsApp preview
 * - Real-time validation
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FaImage, 
  FaVideo, 
  FaFileAlt, 
  FaFont,
  FaPlus,
  FaTrash,
  FaExternalLinkAlt,
  FaPhone,
  FaCopy,
  FaReply,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaTimes,
  FaSave,
  FaPaperPlane
} from 'react-icons/fa';
import WhatsAppPreview from './WhatsAppPreview';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'en_US': 'English (US)',
  'en_GB': 'English (UK)',
  'es': 'Spanish',
  'es_ES': 'Spanish (Spain)',
  'es_MX': 'Spanish (Mexico)',
  'pt_BR': 'Portuguese (Brazil)',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'hi': 'Hindi',
  'ar': 'Arabic',
  'zh_CN': 'Chinese (Simplified)',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ru': 'Russian',
  'tr': 'Turkish',
  'nl': 'Dutch',
  'pl': 'Polish',
  'id': 'Indonesian',
  'ms': 'Malay',
  'th': 'Thai',
  'vi': 'Vietnamese'
};

const CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing', description: 'Promotional content, offers, updates' },
  { value: 'UTILITY', label: 'Utility', description: 'Order updates, account info, alerts' },
  { value: 'AUTHENTICATION', label: 'Authentication', description: 'OTP codes, verification' }
];

const HEADER_FORMATS = [
  { value: 'NONE', label: 'None', icon: null },
  { value: 'TEXT', label: 'Text', icon: FaFont },
  { value: 'IMAGE', label: 'Image', icon: FaImage },
  { value: 'VIDEO', label: 'Video', icon: FaVideo },
  { value: 'DOCUMENT', label: 'Document', icon: FaFileAlt }
];

const BUTTON_TYPES = [
  { value: 'QUICK_REPLY', label: 'Quick Reply', icon: FaReply, description: 'User taps to reply' },
  { value: 'URL', label: 'Visit Website', icon: FaExternalLinkAlt, description: 'Opens a URL' },
  { value: 'PHONE_NUMBER', label: 'Call Phone', icon: FaPhone, description: 'Makes a phone call' },
  { value: 'COPY_CODE', label: 'Copy Code', icon: FaCopy, description: 'Copies OTP code' }
];

const LIMITS = {
  HEADER_TEXT_MAX: 60,
  BODY_MAX: 1024,
  FOOTER_MAX: 60,
  BUTTON_TEXT_MAX: 25,
  URL_MAX: 2000,
  MAX_BUTTONS: 10,
  MAX_QUICK_REPLY: 10,
  MAX_URL: 2,
  MAX_PHONE: 1
};

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function extractVariables(text) {
  if (!text) return [];
  const matches = text.match(/\{\{(\d+)\}\}/g) || [];
  return matches.map(m => parseInt(m.replace(/[{}]/g, '')));
}

function validateTemplate(template) {
  const errors = [];
  const warnings = [];

  // Name validation
  if (!template.name) {
    errors.push({ field: 'name', message: 'Template name is required' });
  } else if (!/^[a-z0-9_]+$/.test(template.name)) {
    errors.push({ field: 'name', message: 'Only lowercase letters, numbers, and underscores allowed' });
  }

  // Body validation
  if (!template.body?.text) {
    errors.push({ field: 'body', message: 'Body text is required' });
  } else {
    if (template.body.text.length > LIMITS.BODY_MAX) {
      errors.push({ field: 'body', message: `Body exceeds ${LIMITS.BODY_MAX} characters` });
    }
    
    // Check variable sequencing
    const vars = extractVariables(template.body.text);
    const sorted = [...vars].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) {
        errors.push({ field: 'body', message: 'Variables must be sequential starting from {{1}}' });
        break;
      }
    }
    
    // Check examples
    if (vars.length > 0 && (!template.body.examples || template.body.examples.length < vars.length)) {
      errors.push({ field: 'body', message: `Provide example values for all ${vars.length} variables` });
    }
  }

  // Header validation
  if (template.header?.enabled && template.header.format !== 'NONE') {
    if (template.header.format === 'TEXT') {
      if (!template.header.text) {
        errors.push({ field: 'header', message: 'Header text is required' });
      } else if (template.header.text.length > LIMITS.HEADER_TEXT_MAX) {
        errors.push({ field: 'header', message: `Header exceeds ${LIMITS.HEADER_TEXT_MAX} characters` });
      }
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.header.format)) {
      if (!template.header.mediaUrl && !template.header.mediaHandle) {
        warnings.push({ field: 'header', message: 'Media URL will be required for submission' });
      }
    }
  }

  // Footer validation
  if (template.footer?.enabled && template.footer.text) {
    if (template.footer.text.length > LIMITS.FOOTER_MAX) {
      errors.push({ field: 'footer', message: `Footer exceeds ${LIMITS.FOOTER_MAX} characters` });
    }
  }

  // Button validation
  if (template.buttons?.enabled && template.buttons.items?.length > 0) {
    const buttonCounts = { QUICK_REPLY: 0, URL: 0, PHONE_NUMBER: 0, COPY_CODE: 0 };
    
    template.buttons.items.forEach((btn, i) => {
      buttonCounts[btn.type]++;
      
      if (!btn.text) {
        errors.push({ field: `button_${i}`, message: `Button ${i + 1} text is required` });
      } else if (btn.text.length > LIMITS.BUTTON_TEXT_MAX) {
        errors.push({ field: `button_${i}`, message: `Button ${i + 1} text exceeds ${LIMITS.BUTTON_TEXT_MAX} chars` });
      }
      
      if (btn.type === 'URL' && !btn.url) {
        errors.push({ field: `button_${i}`, message: `Button ${i + 1} URL is required` });
      }
      
      if (btn.type === 'PHONE_NUMBER' && !btn.phoneNumber) {
        errors.push({ field: `button_${i}`, message: `Button ${i + 1} phone number is required` });
      }
    });
    
    if (buttonCounts.URL > LIMITS.MAX_URL) {
      errors.push({ field: 'buttons', message: `Maximum ${LIMITS.MAX_URL} URL buttons allowed` });
    }
    
    if (buttonCounts.PHONE_NUMBER > LIMITS.MAX_PHONE) {
      errors.push({ field: 'buttons', message: `Maximum ${LIMITS.MAX_PHONE} phone button allowed` });
    }
  }

  // Authentication template rules
  if (template.category === 'AUTHENTICATION') {
    if (template.header?.enabled) {
      errors.push({ field: 'header', message: 'Authentication templates cannot have headers' });
    }
    if (!template.body?.text?.includes('{{1}}')) {
      errors.push({ field: 'body', message: 'Authentication templates must include {{1}} for the OTP' });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Character Counter
const CharCounter = ({ current, max, className = '' }) => {
  const percentage = (current / max) * 100;
  const isNearLimit = percentage > 80;
  const isOverLimit = current > max;
  
  return (
    <span className={`text-xs ${isOverLimit ? 'text-red-500 font-medium' : isNearLimit ? 'text-amber-500' : 'text-gray-400'} ${className}`}>
      {current}/{max}
    </span>
  );
};

// Variable Badge
const VariableBadge = ({ number, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-mono hover:bg-blue-200 transition-colors"
  >
    {`{{${number}}}`}
  </button>
);

// Section Header
const SectionHeader = ({ title, description, enabled, onToggle, required = false }) => (
  <div className="flex items-center justify-between mb-3">
    <div>
      <h4 className="font-medium text-gray-900 flex items-center gap-2">
        {title}
        {required && <span className="text-red-500 text-sm">*</span>}
      </h4>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
    {onToggle !== undefined && (
      <label className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          checked={enabled} 
          onChange={(e) => onToggle(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
      </label>
    )}
  </div>
);

// Validation Message
const ValidationMessage = ({ type, message }) => {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700'
  };
  
  const icons = {
    error: FaTimes,
    warning: FaExclamationTriangle,
    info: FaInfoCircle
  };
  
  const Icon = icons[type];
  
  return (
    <div className={`flex items-start gap-2 p-2 rounded border text-sm ${styles[type]}`}>
      <Icon className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const TemplateBuilder = ({ 
  initialData = null, 
  onSave, 
  onSubmit, 
  onCancel,
  isEditing = false,
  isSubmitting = false,
  isSaving = false
}) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────────
  
  const [template, setTemplate] = useState({
    name: '',
    language: 'en',
    category: 'MARKETING',
    header: { enabled: false, format: 'NONE', text: '', example: '', mediaUrl: '' },
    body: { text: '', examples: [] },
    footer: { enabled: false, text: '' },
    buttons: { enabled: false, items: [] }
  });
  
  const [validation, setValidation] = useState({ valid: true, errors: [], warnings: [] });
  const [activeSection, setActiveSection] = useState('body');
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Initialize from existing data
  useEffect(() => {
    if (initialData) {
      setTemplate({
        name: initialData.name || '',
        language: initialData.language || 'en',
        category: initialData.category || 'MARKETING',
        header: initialData.header || { enabled: false, format: 'NONE', text: '', example: '', mediaUrl: '' },
        body: initialData.body || { text: '', examples: [] },
        footer: initialData.footer || { enabled: false, text: '' },
        buttons: initialData.buttons || { enabled: false, items: [] }
      });
    }
  }, [initialData]);
  
  // Validate on change
  useEffect(() => {
    const result = validateTemplate(template);
    setValidation(result);
  }, [template]);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────
  
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
  
  const handleNameChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    updateTemplate('name', value);
  };
  
  const insertVariable = useCallback((textareaId) => {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    
    const currentVars = extractVariables(textarea.value);
    const nextVar = currentVars.length > 0 ? Math.max(...currentVars) + 1 : 1;
    const variable = `{{${nextVar}}}`;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    if (textareaId === 'body-text') {
      updateTemplate('body.text', newText);
    } else if (textareaId === 'header-text') {
      updateTemplate('header.text', newText);
    }
    
    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  }, [updateTemplate]);
  
  const addButton = useCallback(() => {
    setTemplate(prev => ({
      ...prev,
      buttons: {
        ...prev.buttons,
        items: [
          ...prev.buttons.items,
          { type: 'QUICK_REPLY', text: '', url: '', phoneNumber: '', example: '' }
        ]
      }
    }));
  }, []);
  
  const updateButton = useCallback((index, field, value) => {
    setTemplate(prev => {
      const newItems = [...prev.buttons.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, buttons: { ...prev.buttons, items: newItems } };
    });
  }, []);
  
  const removeButton = useCallback((index) => {
    setTemplate(prev => ({
      ...prev,
      buttons: {
        ...prev.buttons,
        items: prev.buttons.items.filter((_, i) => i !== index)
      }
    }));
  }, []);
  
  const handleSave = () => {
    if (onSave) {
      onSave(template);
    }
  };
  
  const handleSubmit = () => {
    if (validation.valid && onSubmit) {
      onSubmit(template);
    }
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────────────────────
  
  const bodyVariables = useMemo(() => extractVariables(template.body.text), [template.body.text]);
  const bodyCharCount = template.body.text?.length || 0;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  
  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LEFT PANEL - BUILDER FORM */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="space-y-6 pb-6">
          
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* BASIC INFO */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Template Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={template.name}
                  onChange={handleNameChange}
                  placeholder="e.g., welcome_message"
                  disabled={isEditing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase, numbers, underscores only</p>
              </div>
              
              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language <span className="text-red-500">*</span>
                </label>
                <select
                  value={template.language}
                  onChange={(e) => updateTemplate('language', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={template.category}
                  onChange={(e) => updateTemplate('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {CATEGORIES.find(c => c.value === template.category)?.description}
                </p>
              </div>
            </div>
          </div>
          
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* HEADER SECTION */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {template.category !== 'AUTHENTICATION' && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <SectionHeader
                title="Header"
                description="Optional header with text, image, video, or document"
                enabled={template.header.enabled}
                onToggle={(enabled) => updateTemplate('header.enabled', enabled)}
              />
              
              {template.header.enabled && (
                <div className="space-y-4">
                  {/* Format Selection */}
                  <div className="flex gap-2 flex-wrap">
                    {HEADER_FORMATS.filter(f => f.value !== 'NONE').map(format => {
                      const Icon = format.icon;
                      const isSelected = template.header.format === format.value;
                      return (
                        <button
                          key={format.value}
                          type="button"
                          onClick={() => updateTemplate('header.format', format.value)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                            isSelected 
                              ? 'border-green-500 bg-green-50 text-green-700' 
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {Icon && <Icon className="text-sm" />}
                          <span className="text-sm font-medium">{format.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Text Header Input */}
                  {template.header.format === 'TEXT' && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-medium text-gray-700">Header Text</label>
                        <CharCounter current={template.header.text?.length || 0} max={LIMITS.HEADER_TEXT_MAX} />
                      </div>
                      <div className="relative">
                        <input
                          id="header-text"
                          type="text"
                          value={template.header.text || ''}
                          onChange={(e) => updateTemplate('header.text', e.target.value)}
                          placeholder="Enter header text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => insertVariable('header-text')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                        >
                          + Variable
                        </button>
                      </div>
                      
                      {/* Header Variable Example */}
                      {template.header.text?.includes('{{') && (
                        <div className="mt-2">
                          <label className="text-sm text-gray-600">Example value:</label>
                          <input
                            type="text"
                            value={template.header.example || ''}
                            onChange={(e) => updateTemplate('header.example', e.target.value)}
                            placeholder="e.g., John"
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Media Header Input */}
                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.header.format) && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Media URL (for sample)
                      </label>
                      <input
                        type="url"
                        value={template.header.mediaUrl || ''}
                        onChange={(e) => updateTemplate('header.mediaUrl', e.target.value)}
                        placeholder="https://example.com/media.jpg"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {template.header.format === 'IMAGE' && 'Supported: JPG, PNG (max 5MB)'}
                        {template.header.format === 'VIDEO' && 'Supported: MP4 (max 16MB)'}
                        {template.header.format === 'DOCUMENT' && 'Supported: PDF (max 100MB)'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* BODY SECTION */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <SectionHeader
              title="Body"
              description="The main message content (required)"
              required={true}
            />
            
            <div className="space-y-3">
              {/* Text Editor */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => insertVariable('body-text')}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                    >
                      + Add Variable
                    </button>
                    {bodyVariables.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {bodyVariables.length} variable{bodyVariables.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <CharCounter current={bodyCharCount} max={LIMITS.BODY_MAX} />
                </div>
                
                <textarea
                  id="body-text"
                  value={template.body.text}
                  onChange={(e) => updateTemplate('body.text', e.target.value)}
                  rows={6}
                  placeholder="Enter your message here. Use {{1}}, {{2}}, etc. for variables."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none font-mono text-sm"
                />
                
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <p><strong>Formatting:</strong> *bold* _italic_ ~strikethrough~ ```code```</p>
                  <p><strong>Variables:</strong> Use {'{{1}}'}, {'{{2}}'}, etc. in sequential order</p>
                </div>
              </div>
              
              {/* Variable Examples */}
              {bodyVariables.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Example values for variables:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {bodyVariables.map((varNum, index) => (
                      <div key={varNum} className="flex items-center gap-2">
                        <VariableBadge number={varNum} onClick={() => {}} />
                        <input
                          type="text"
                          value={template.body.examples[index] || ''}
                          onChange={(e) => {
                            const newExamples = [...(template.body.examples || [])];
                            newExamples[index] = e.target.value;
                            updateTemplate('body.examples', newExamples);
                          }}
                          placeholder={`Example for {{${varNum}}}`}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* FOOTER SECTION */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <SectionHeader
              title="Footer"
              description="Optional footer text (no variables allowed)"
              enabled={template.footer.enabled}
              onToggle={(enabled) => updateTemplate('footer.enabled', enabled)}
            />
            
            {template.footer.enabled && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Footer Text</label>
                  <CharCounter current={template.footer.text?.length || 0} max={LIMITS.FOOTER_MAX} />
                </div>
                <input
                  type="text"
                  value={template.footer.text || ''}
                  onChange={(e) => updateTemplate('footer.text', e.target.value)}
                  placeholder="e.g., Reply STOP to unsubscribe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
          
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* BUTTONS SECTION */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <SectionHeader
              title="Buttons"
              description={`Up to ${LIMITS.MAX_BUTTONS} buttons (max ${LIMITS.MAX_URL} URL, ${LIMITS.MAX_PHONE} phone)`}
              enabled={template.buttons.enabled}
              onToggle={(enabled) => updateTemplate('buttons.enabled', enabled)}
            />
            
            {template.buttons.enabled && (
              <div className="space-y-3">
                {/* Button List */}
                {template.buttons.items.map((button, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3 relative">
                    <button
                      type="button"
                      onClick={() => removeButton(index)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                    >
                      <FaTrash className="text-sm" />
                    </button>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Button Type */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
                        <select
                          value={button.type}
                          onChange={(e) => updateButton(index, 'type', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          {BUTTON_TYPES.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Button Text */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-medium text-gray-600">Button Text</label>
                          <CharCounter current={button.text?.length || 0} max={LIMITS.BUTTON_TEXT_MAX} />
                        </div>
                        <input
                          type="text"
                          value={button.text || ''}
                          onChange={(e) => updateButton(index, 'text', e.target.value)}
                          placeholder="Button label"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      
                      {/* Type-specific fields */}
                      {button.type === 'URL' && (
                        <div className="sm:col-span-2">
                          <label className="text-xs font-medium text-gray-600 block mb-1">URL</label>
                          <input
                            type="url"
                            value={button.url || ''}
                            onChange={(e) => updateButton(index, 'url', e.target.value)}
                            placeholder="https://example.com"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      )}
                      
                      {button.type === 'PHONE_NUMBER' && (
                        <div className="sm:col-span-2">
                          <label className="text-xs font-medium text-gray-600 block mb-1">Phone Number</label>
                          <input
                            type="tel"
                            value={button.phoneNumber || ''}
                            onChange={(e) => updateButton(index, 'phoneNumber', e.target.value)}
                            placeholder="+1234567890"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      )}
                      
                      {button.type === 'COPY_CODE' && (
                        <div className="sm:col-span-2">
                          <label className="text-xs font-medium text-gray-600 block mb-1">Example Code</label>
                          <input
                            type="text"
                            value={button.example || ''}
                            onChange={(e) => updateButton(index, 'example', e.target.value)}
                            placeholder="123456"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Add Button */}
                {template.buttons.items.length < LIMITS.MAX_BUTTONS && (
                  <button
                    type="button"
                    onClick={addButton}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-green-500 hover:text-green-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <FaPlus className="text-sm" />
                    <span>Add Button</span>
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* VALIDATION MESSAGES */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {(validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="space-y-2">
              {validation.errors.map((error, i) => (
                <ValidationMessage key={`error-${i}`} type="error" message={error.message} />
              ))}
              {validation.warnings.map((warning, i) => (
                <ValidationMessage key={`warning-${i}`} type="warning" message={warning.message} />
              ))}
            </div>
          )}
          
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* ACTION BUTTONS */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <FaSave />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </button>
              
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!validation.valid || isSubmitting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaPaperPlane />
                {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* RIGHT PANEL - LIVE PREVIEW */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[360px] flex-shrink-0">
        <div className="sticky top-4">
          <h3 className="font-semibold text-gray-900 mb-4 text-center">Live Preview</h3>
          <WhatsAppPreview template={template} />
        </div>
      </div>
    </div>
  );
};

export default TemplateBuilder;
