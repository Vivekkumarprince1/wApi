'use client';

import React, { useState } from 'react';
import { createTemplate, uploadTemplateMedia } from '../lib/api';
import { Image } from 'lucide-react';

const CreateTemplateModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'MARKETING',
    language: 'en',
    header: { type: 'NONE', text: '' },
    body: '',
    footer: '',
    buttons: [],
    variables: []
  });
  
  const [variableSamples, setVariableSamples] = useState({});
  
  const [loading, setLoading] = useState(false);
  const [headerFile, setHeaderFile] = useState(null);
  const [error, setError] = useState('');
  const [buttonType, setButtonType] = useState('NONE');
  const [topPosition, setTopPosition] = useState(0);

  // Dynamic positioning effect
  React.useEffect(() => {
    if (!isOpen) return;

    const calculatePosition = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const baseGap = Math.max(10, Math.min(viewportHeight * 0.05, 100)); // Dynamic gap based on screen size max 100px
      setTopPosition(scrollY + baseGap);
    };

    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);
    
    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [isOpen]);

  const categories = [
    'MARKETING',
    'UTILITY',
    'AUTHENTICATION',
    'TRANSACTIONAL',
    'PROMOTIONAL'
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'pt', name: 'Portuguese' }
  ];

  const headerTypes = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'GIF', 'LOCATION'];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleHeaderChange = (type) => {
    setFormData(prev => ({
      ...prev,
      header: type === 'NONE' ? null : { type, text: type === 'TEXT' ? '' : null }
    }));
  };

  const addButton = () => {
    if (buttonType === 'NONE') return;
    
    const newButton = {
      type: buttonType,
      text: '',
      ...(buttonType === 'URL' && { url: '' }),
      ...(buttonType === 'PHONE_NUMBER' && { phone_number: '' })
    };
    
    setFormData(prev => ({
      ...prev,
      buttons: [...prev.buttons, newButton]
    }));
  };

  const updateButton = (index, field, value) => {
    const updatedButtons = [...formData.buttons];
    updatedButtons[index][field] = value;
    setFormData(prev => ({ ...prev, buttons: updatedButtons }));
  };

  const removeButton = (index) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index)
    }));
  };

  const detectVariables = (text) => {
    const regex = /\{\{(\d+)\}\}/g;
    const matches = [...text.matchAll(regex)];
    return matches.map(m => parseInt(m[1]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.body) {
      setError('Template name and body are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let exampleMedia = null;
      let exampleMediaUrl = null;
      let mediaType = formData.header?.type || 'NONE';

      // Upload media if present
      if (headerFile && ['IMAGE', 'VIDEO', 'DOCUMENT', 'GIF'].includes(mediaType)) {
        try {
          const uploadRes = await uploadTemplateMedia(headerFile);
          if (uploadRes) {
            if (uploadRes.handleId) exampleMedia = uploadRes.handleId;
            if (uploadRes.url) exampleMediaUrl = uploadRes.url;
          }
        } catch (uploadErr) {
          throw new Error('Media upload failed: ' + uploadErr.message);
        }
      }

      // Detect variables in body
      const bodyVars = detectVariables(formData.body);
      const headerVars = formData.header?.text ? detectVariables(formData.header.text) : [];
      const allVars = [...new Set([...bodyVars, ...headerVars])].sort();

      const templateData = {
        name: formData.name.toLowerCase().replace(/\s+/g, '_'),
        category: formData.category,
        language: formData.language,
        exampleMedia,
        mediaUrl: exampleMediaUrl,
        templateType: ['IMAGE', 'VIDEO', 'DOCUMENT', 'GIF', 'LOCATION'].includes(mediaType) ? mediaType : 'TEXT',
        components: [
          ...(formData.header && formData.header.type !== 'NONE' ? [{
            type: 'HEADER',
            format: formData.header.type,
            ...(formData.header.text && { text: formData.header.text }),
            ...(exampleMedia || exampleMediaUrl ? { 
              example: { 
                ...(exampleMedia && { header_handle: [exampleMedia] }),
                ...(exampleMediaUrl && { header_url: [exampleMediaUrl] })
              } 
            } : {})
          }] : []),
          {
            type: 'BODY',
            text: formData.body,
            ...(allVars.length > 0 && {
              example: {
                body_text: [allVars.map(v => variableSamples[v] || `Example ${v}`)]
              }
            })
          },
          ...(formData.footer ? [{
            type: 'FOOTER',
            text: formData.footer
          }] : []),
          ...(formData.buttons.length > 0 ? [{
            type: 'BUTTONS',
            buttons: formData.buttons
          }] : [])
        ]
      };

      await createTemplate(templateData);
      onSuccess();
      onClose();
      
      // Reset form
      setHeaderFile(null);
      setFormData({
        name: '',
        category: 'MARKETING',
        language: 'en',
        header: { type: 'TEXT', text: '' },
        body: '',
        footer: '',
        buttons: []
      });
      setVariableSamples({});
    } catch (err) {
      setError(err.message || 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] p-4 sm:p-6 md:p-8 flex justify-center pointer-events-none"
    >
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className="bg-card w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto transition-all duration-200 ease-in-out relative z-10"
        style={{ 
          maxHeight: 'min(90vh, 800px)',
          marginTop: `${topPosition}px`,
          position: 'absolute'
        }}
      >
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-6 py-4 shrink-0 z-20 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Create Template</h2>
            <p className="text-teal-100 text-sm">Create and submit a new WhatsApp template for approval</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-teal-200 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., welcome_message"
              className="w-full px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Use lowercase, underscores only (no spaces)</p>
          </div>

          {/* Category & Language */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Language *
              </label>
              <select
                value={formData.language}
                onChange={(e) => handleInputChange('language', e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-blue-500"
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Header */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Header (Optional)
            </label>
            <select
              value={formData.header?.type || 'NONE'}
              onChange={(e) => handleHeaderChange(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-blue-500 mb-2"
            >
              {headerTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {formData.header?.type === 'TEXT' && (
              <input
                type="text"
                value={formData.header.text}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  header: { ...prev.header, text: e.target.value }
                }))}
                placeholder="Header text (supports {{1}}, {{2}}, etc. for variables)"
                className="w-full px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-blue-500"
              />
            )}
            {['IMAGE', 'VIDEO', 'DOCUMENT', 'GIF'].includes(formData.header?.type) && (
              <div className="mt-2 p-4 border border-dashed rounded-lg text-center">
                <input
                  type="file"
                  onChange={(e) => setHeaderFile(e.target.files[0])}
                  className="hidden"
                  id="header-media-upload"
                  accept={
                    formData.header?.type === 'IMAGE' ? 'image/*' :
                    (formData.header?.type === 'VIDEO' || formData.header?.type === 'GIF') ? 'video/*' :
                    '.pdf,.doc,.docx'
                  }
                />
                <label htmlFor="header-media-upload" className="cursor-pointer flex flex-col items-center">
                  <Image className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium">
                    {headerFile ? headerFile.name : `Upload Sample ${formData.header?.type}`}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    Required for Meta approval
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Message Body *
            </label>
            <textarea
              value={formData.body}
              onChange={(e) => handleInputChange('body', e.target.value)}
              placeholder="Enter your message. Use {{1}}, {{2}}, etc. for variables&#10;Example: Hello {{1}}! Your order {{2}} is confirmed."
              rows={6}
              className="w-full px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Variables detected: {detectVariables(formData.body).length > 0 
                ? detectVariables(formData.body).map(v => `{{${v}}}`).join(', ')
                : 'None'}
            </p>
          </div>
          
          {/* Variable Samples */}
          {detectVariables(formData.body).length > 0 && (
            <div className="bg-muted/30 p-4 rounded-lg border border-border mt-4">
              <h4 className="text-sm font-medium text-foreground mb-3">Variable Samples</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Provide sample values for the variables to help Meta review your template.
              </p>
              
              <div className="space-y-3">
                {detectVariables(formData.body).map(variable => (
                  <div key={`var-${variable}`} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-12 text-center bg-muted py-1.5 rounded text-muted-foreground border border-border">
                      {`{{${variable}}}`}
                    </span>
                    <input
                      type="text"
                      value={variableSamples[variable] || ''}
                      onChange={(e) => setVariableSamples(prev => ({...prev, [variable]: e.target.value}))}
                      placeholder={`Sample for {{${variable}}}`}
                      className="flex-1 px-3 py-1.5 text-sm border border-border rounded bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Footer (Optional)
            </label>
            <input
              type="text"
              value={formData.footer}
              onChange={(e) => handleInputChange('footer', e.target.value)}
              placeholder="e.g., Powered by YourCompany"
              className="w-full px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Buttons (Optional)
            </label>
            <div className="flex gap-2 mb-3">
              <select
                value={buttonType}
                onChange={(e) => setButtonType(e.target.value)}
                className="flex-1 px-4 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-blue-500"
              >
                <option value="NONE">Select button type</option>
                <option value="QUICK_REPLY">Quick Reply</option>
                <option value="URL">URL</option>
                <option value="PHONE_NUMBER">Phone Number</option>
                <option value="FLOW">WhatsApp Flow</option>
              </select>
              <button
                type="button"
                onClick={addButton}
                disabled={buttonType === 'NONE'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>

            {formData.buttons.map((button, index) => (
              <div key={index} className="bg-muted/50 p-3 rounded-lg mb-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={button.text}
                      onChange={(e) => updateButton(index, 'text', e.target.value)}
                      placeholder="Button text"
                      className="w-full px-3 py-1.5 text-sm border border-border rounded bg-white dark:bg-muted text-foreground"
                    />
                    {button.type === 'URL' && (
                      <input
                        type="url"
                        value={button.url}
                        onChange={(e) => updateButton(index, 'url', e.target.value)}
                        placeholder="https://example.com"
                        className="w-full px-3 py-1.5 text-sm border border-border rounded bg-white dark:bg-muted text-foreground"
                      />
                    )}
                    {button.type === 'PHONE_NUMBER' && (
                      <input
                        type="tel"
                        value={button.phone_number}
                        onChange={(e) => updateButton(index, 'phone_number', e.target.value)}
                        placeholder="+1234567890"
                        className="w-full px-3 py-1.5 text-sm border border-border rounded bg-white dark:bg-muted text-foreground"
                      />
                    )}
                    {button.type === 'FLOW' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={button.flow_id || ''}
                          onChange={(e) => updateButton(index, 'flow_id', e.target.value)}
                          placeholder="Flow ID"
                          className="w-full px-3 py-1.5 text-sm border border-border rounded bg-white dark:bg-muted text-foreground"
                        />
                        <select
                          value={button.flow_action || 'NAVIGATE'}
                          onChange={(e) => updateButton(index, 'flow_action', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-border rounded bg-white dark:bg-muted text-foreground"
                        >
                          <option value="NAVIGATE">Navigate</option>
                          <option value="DATA_EXCHANGE">Data Exchange</option>
                        </select>
                        <input
                          type="text"
                          value={button.navigate_screen || ''}
                          onChange={(e) => updateButton(index, 'navigate_screen', e.target.value)}
                          placeholder="Navigate Screen (e.g. START_SCREEN)"
                          className="w-full px-3 py-1.5 text-sm border border-border rounded bg-white dark:bg-muted text-foreground"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeButton(index)}
                    className="text-destructive hover:text-destructive/80 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">{button.type}</p>
              </div>
            ))}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-border text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </span>
              ) : (
                'Create Template'
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Template will be submitted to WhatsApp for review. Approval may take up to 24 hours.
          </p>
        </form>
      </div>
    </div>
  );
};

export default CreateTemplateModal;
