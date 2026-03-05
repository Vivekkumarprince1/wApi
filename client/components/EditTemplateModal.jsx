'use client';

import React, { useState, useEffect, useRef } from 'react';
import { uploadTemplateMedia } from '../lib/api';

const MEDIA_FORMATS = ['IMAGE', 'VIDEO', 'DOCUMENT'];
const HEADER_FORMAT_ICONS = { TEXT: '📝', IMAGE: '🖼️', VIDEO: '🎬', DOCUMENT: '📄', NONE: '' };
const HEADER_FORMAT_ACCEPT = { IMAGE: 'image/jpeg,image/png', VIDEO: 'video/mp4', DOCUMENT: 'application/pdf' };

const EditTemplateModal = ({ isOpen, onClose, template, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    language: 'en_US',
    category: 'UTILITY',
    headerFormat: 'NONE',
    headerText: '',
    bodyText: '',
    footerText: '',
    buttons: [],
    variableSamples: {},
    mediaHandle: '',
    mediaUrl: '',
    mediaThumbnail: '',
  });
  const [variables, setVariables] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [headerFile, setHeaderFile] = useState(null);
  const [headerFilePreview, setHeaderFilePreview] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [topPosition, setTopPosition] = useState(0);
  const headerFileRef = useRef(null);
  const modalRef = useRef(null);

  // Dynamic positioning effect
  useEffect(() => {
    if (!isOpen) return;

    const calculatePosition = () => {
      // Calculate a comfortable top positioning
      // that responds to scroll and screen height changes
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;

      // Default centered approach roughly 5vh from top with max 100px limitation
      const baseGap = Math.max(10, Math.min(viewportHeight * 0.05, 100));

      // Compute final top
      setTopPosition(scrollY + baseGap);
    };

    // Calculate immediately
    calculatePosition();

    // Setup event listeners
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);

    // Cleanup
    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [isOpen]);

  const normalizeTemplateText = (value) => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.value === 'string') return value.value;
    return '';
  };

  const extractButtonLabels = (buttons) => {
    if (!buttons) return [];
    if (Array.isArray(buttons) && typeof buttons[0] === 'string') return buttons;
    if (Array.isArray(buttons)) return buttons.map(b => b.text || '').filter(Boolean);
    if (buttons.items && Array.isArray(buttons.items)) return buttons.items.map(b => b.text || '').filter(Boolean);
    return [];
  };

  const extractVariables = (text) => {
    if (typeof text !== 'string') return [];
    const regex = /\{\{(\d+)\}\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!matches.includes(match[1])) matches.push(match[1]);
    }
    return matches.sort((a, b) => parseInt(a) - parseInt(b));
  };

  const detectHeaderFormat = (tmpl) => {
    if (!tmpl?.header?.enabled) return 'NONE';
    if (tmpl.header.format && tmpl.header.format !== 'NONE') return tmpl.header.format;
    return 'NONE';
  };

  useEffect(() => {
    if (template && isOpen) {
      const body = normalizeTemplateText(template.bodyText) || normalizeTemplateText(template.body);
      const headerFormat = detectHeaderFormat(template);
      const headerText = headerFormat === 'TEXT'
        ? (normalizeTemplateText(template.headerText) || normalizeTemplateText(template.header))
        : '';
      const footer = normalizeTemplateText(template.footerText) || normalizeTemplateText(template.footer);

      const bodyVars = extractVariables(body);
      const headerVars = extractVariables(headerText);
      const allVars = [...new Set([...headerVars, ...bodyVars])].sort((a, b) => parseInt(a) - parseInt(b));

      const bodyExamples = template.body?.examples || template.variables || [];
      const samples = {};
      allVars.forEach((v, index) => {
        samples[v] = bodyExamples[index] || '';
      });

      setFormData({
        name: template.name || '',
        language: template.language || 'en_US',
        category: template.category || 'UTILITY',
        headerFormat,
        headerText,
        bodyText: body,
        footerText: footer,
        buttons: extractButtonLabels(template.buttonLabels || template.buttons),
        variableSamples: samples,
        mediaHandle: template.header?.mediaHandle || '',
        mediaUrl: template.header?.mediaUrl || '',
        mediaThumbnail: template.header?.mediaThumbnail || '',
      });
      setVariables(allVars);
      setActiveStep(1);
      setHeaderFile(null);
      setHeaderFilePreview(null);
      setUploadError('');
    }
  }, [template, isOpen]);

  useEffect(() => {
    const allText = (formData.headerFormat === 'TEXT' ? formData.headerText : '') + ' ' + formData.bodyText;
    const vars = extractVariables(allText);
    setVariables(vars);

    const newSamples = { ...formData.variableSamples };
    vars.forEach(v => { if (!newSamples[v]) newSamples[v] = ''; });
    Object.keys(newSamples).forEach(key => { if (!vars.includes(key)) delete newSamples[key]; });
    setFormData(prev => ({ ...prev, variableSamples: newSamples }));
  }, [formData.headerText, formData.bodyText, formData.headerFormat]);

  useEffect(() => {
    return () => { if (headerFilePreview) URL.revokeObjectURL(headerFilePreview); };
  }, [headerFilePreview]);

  const getPreviewText = (text) => {
    let preview = typeof text === 'string' ? text : normalizeTemplateText(text);
    variables.forEach(v => {
      const sample = formData.variableSamples[v] || `{{${v}}}`;
      preview = preview.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), sample);
    });
    return preview;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVariableSampleChange = (varNum, value) => {
    setFormData(prev => ({
      ...prev,
      variableSamples: { ...prev.variableSamples, [varNum]: value }
    }));
  };

  const handleHeaderFormatChange = (format) => {
    setFormData(prev => ({
      ...prev,
      headerFormat: format,
      headerText: format === 'TEXT' ? prev.headerText : '',
    }));
    if (format === 'TEXT' || format === 'NONE') {
      setHeaderFile(null);
      if (headerFilePreview) { URL.revokeObjectURL(headerFilePreview); setHeaderFilePreview(null); }
      setUploadError('');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    const accept = HEADER_FORMAT_ACCEPT[formData.headerFormat];
    if (accept && !accept.split(',').some(t => file.type.match(t.trim().replace('*', '.*')))) {
      setUploadError(`Invalid file type for ${formData.headerFormat}`);
      return;
    }
    if (file.size > 16 * 1024 * 1024) { setUploadError('File must be under 16 MB'); return; }
    setHeaderFile(file);
    if (headerFilePreview) URL.revokeObjectURL(headerFilePreview);
    if (formData.headerFormat === 'IMAGE' || formData.headerFormat === 'VIDEO') {
      setHeaderFilePreview(URL.createObjectURL(file));
    } else {
      setHeaderFilePreview(null);
    }
    setFormData(prev => ({ ...prev, mediaHandle: '', mediaUrl: '', mediaThumbnail: '' }));
  };

  const handleAddButton = () => {
    if (formData.buttons.length < 3) {
      setFormData(prev => ({
        ...prev,
        buttons: [...prev.buttons, 'Button ' + (prev.buttons.length + 1)]
      }));
    }
  };

  const handleButtonChange = (index, value) => {
    const newButtons = [...formData.buttons];
    newButtons[index] = value;
    setFormData(prev => ({ ...prev, buttons: newButtons }));
  };

  const handleRemoveButton = (index) => {
    const newButtons = formData.buttons.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, buttons: newButtons }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setUploadError('');
    try {
      let finalMediaHandle = formData.mediaHandle;
      let finalMediaUrl = formData.mediaUrl;
      let finalMediaThumbnail = formData.mediaThumbnail;

      if (headerFile && MEDIA_FORMATS.includes(formData.headerFormat)) {
        setUploadingMedia(true);
        try {
          const uploadResult = await uploadTemplateMedia(headerFile, formData.headerFormat.toLowerCase());
          let rawHandle = uploadResult.handleId || uploadResult.handle || uploadResult.message || '';
          if (typeof rawHandle === 'object') {
            rawHandle = rawHandle.message || Object.values(rawHandle)[0] || '';
          }
          if (typeof rawHandle === 'string' && rawHandle.includes('\n')) {
            rawHandle = rawHandle.split('\n')[0].trim();
          }
          finalMediaHandle = typeof rawHandle === 'string' ? rawHandle.trim() : rawHandle;
          finalMediaUrl = uploadResult.url || '';
          finalMediaThumbnail = uploadResult.thumbnail || '';
        } catch (err) {
          setUploadError(err.message || 'Media upload failed');
          return;
        } finally {
          setUploadingMedia(false);
        }
      }

      await onSubmit({
        name: formData.name,
        language: formData.language,
        category: formData.category,
        headerFormat: formData.headerFormat,
        headerText: formData.headerFormat === 'TEXT' ? formData.headerText : '',
        mediaHandle: finalMediaHandle,
        mediaUrl: finalMediaUrl,
        mediaThumbnail: finalMediaThumbnail,
        bodyText: formData.bodyText,
        footerText: formData.footerText,
        buttonLabels: formData.buttons,
        variableSamples: formData.variableSamples,
        variables: variables.map(v => formData.variableSamples[v] || `var${v}`)
      });
      onClose();
    } catch (error) {
      alert(error.message || 'Failed to submit template');
    } finally {
      setIsSubmitting(false);
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
        ref={modalRef}
        className="bg-card w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto transition-all duration-200 ease-in-out relative z-10"
        style={{
          maxHeight: 'min(90vh, 800px)',
          marginTop: `${topPosition}px`,
          position: 'absolute'
        }}
      >
        {/* Header */}
        <div className="bg-primary text-primary-foreground px-6 py-4 shrink-0 z-20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Edit Template</h2>
              <p className="text-teal-100 text-sm">Modify and re-submit for Meta approval</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-teal-200 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Steps Indicator */}
          <div className="flex items-center mt-4 gap-4">
            {[
              { num: 1, label: 'Set up template' },
              { num: 2, label: 'Edit template' },
              { num: 3, label: 'Submit for Review' }
            ].map((step, index) => (
              <div key={step.num} className="flex items-center">
                <div
                  className={`flex items-center cursor-pointer ${activeStep >= step.num ? 'opacity-100' : 'opacity-50'}`}
                  onClick={() => setActiveStep(step.num)}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${activeStep > step.num ? 'bg-green-400 text-white' :
                    activeStep === step.num ? 'bg-white text-teal-600' : 'bg-teal-500 text-white'
                    }`}>
                    {activeStep > step.num ? '✓' : step.num}
                  </div>
                  <span className="ml-2 text-sm">{step.label}</span>
                </div>
                {index < 2 && <div className="w-8 h-px bg-teal-400 mx-2"></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex">
            {/* Left Panel - Form */}
            <div className="flex-1 p-6 border-r border-border">
              {/* Step 1: Setup */}
              {activeStep === 1 && (
                <div className="space-y-6">
                  <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4 flex items-start gap-3">
                    <span className="text-2xl">📝</span>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {formData.name || 'New Template'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formData.category} • {template?.subcategory || 'Custom'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Template name and language
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Name your template</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground"
                          placeholder="template_name"
                        />
                        <span className="text-xs text-gray-500">{formData.name.length}/512</span>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Select language</label>
                        <select
                          value={formData.language}
                          onChange={(e) => handleInputChange('language', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground"
                        >
                          <option value="en_US">English (US)</option>
                          <option value="en_GB">English (UK)</option>
                          <option value="hi">Hindi</option>
                          <option value="es">Spanish</option>
                          <option value="pt_BR">Portuguese (BR)</option>
                          <option value="ar">Arabic</option>
                          <option value="id">Indonesian</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground"
                    >
                      <option value="UTILITY">Utility</option>
                      <option value="MARKETING">Marketing</option>
                      <option value="AUTHENTICATION">Authentication</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 2: Edit Content */}
              {activeStep === 2 && (
                <div className="space-y-6">
                  {/* Header Format Selector */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Header <span className="text-gray-400">• Optional</span>
                    </label>
                    <div className="flex gap-2 mb-3">
                      {['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map(fmt => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => handleHeaderFormatChange(fmt)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${formData.headerFormat === fmt
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                            }`}
                        >
                          <span>{HEADER_FORMAT_ICONS[fmt]}</span> {fmt}
                        </button>
                      ))}
                    </div>

                    {formData.headerFormat === 'TEXT' && (
                      <>
                        <input
                          type="text"
                          value={formData.headerText}
                          onChange={(e) => handleInputChange('headerText', e.target.value)}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground"
                          placeholder="Enter header text"
                          maxLength={60}
                        />
                        <span className="text-xs text-gray-500">{formData.headerText.length}/60</span>
                      </>
                    )}

                    {MEDIA_FORMATS.includes(formData.headerFormat) && (
                      <div className="space-y-2">
                        {(formData.mediaHandle || formData.mediaUrl) && !headerFile && (
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg overflow-hidden">
                            {/* Inline media preview */}
                            {formData.mediaUrl && formData.headerFormat === 'IMAGE' && (
                              <img src={formData.mediaUrl} alt="Header" className="w-full h-40 object-cover" />
                            )}
                            {formData.mediaUrl && formData.headerFormat === 'VIDEO' && (
                              <video src={formData.mediaUrl} controls className="w-full h-40 object-contain bg-black" />
                            )}
                            {formData.mediaUrl && formData.headerFormat === 'DOCUMENT' && (
                              <div className="flex items-center justify-center py-6 bg-gray-50 dark:bg-gray-800">
                                <a href={formData.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-blue-600 hover:text-blue-700">
                                  <span className="text-3xl">📄</span>
                                  <span className="text-xs underline">View document</span>
                                </a>
                              </div>
                            )}
                            {!formData.mediaUrl && formData.mediaHandle && (
                              <div className="flex flex-col items-center justify-center py-4 gap-2">
                                {formData.mediaThumbnail && formData.mediaThumbnail.startsWith('data:') ? (
                                  <img src={formData.mediaThumbnail} alt="Preview" className="w-full h-40 object-cover" />
                                ) : (
                                  <>
                                    <span className="text-4xl">{HEADER_FORMAT_ICONS[formData.headerFormat]}</span>
                                    <span className="text-xs text-green-700 dark:text-green-300 font-medium">Uploaded to WhatsApp</span>
                                  </>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-2 p-3 text-sm border-t border-green-200 dark:border-green-800">
                              <span className="text-green-700 dark:text-green-300 flex-1 font-medium">
                                ✅ {formData.headerFormat} media attached
                              </span>
                              <button
                                type="button"
                                onClick={() => headerFileRef.current?.click()}
                                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                              >
                                Replace
                              </button>
                            </div>
                          </div>
                        )}
                        {!formData.mediaHandle && !formData.mediaUrl && !headerFile && (
                          <div
                            onClick={() => headerFileRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
                          >
                            <span className="text-3xl">{HEADER_FORMAT_ICONS[formData.headerFormat]}</span>
                            <span className="text-sm text-muted-foreground">Click to upload {formData.headerFormat.toLowerCase()}</span>
                            <span className="text-xs text-gray-400">Max 16 MB</span>
                          </div>
                        )}
                        {headerFile && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                            {headerFilePreview && formData.headerFormat === 'IMAGE' && (
                              <img src={headerFilePreview} alt="Preview" className="w-full h-40 object-cover" />
                            )}
                            {headerFilePreview && formData.headerFormat === 'VIDEO' && (
                              <video src={headerFilePreview} controls className="w-full h-40 object-contain bg-black" />
                            )}
                            <div className="flex items-center gap-2 p-3 text-sm">
                              <span>{HEADER_FORMAT_ICONS[formData.headerFormat]}</span>
                              <span className="text-blue-700 dark:text-blue-300 flex-1 truncate">{headerFile.name}</span>
                              <button
                                type="button"
                                onClick={() => { setHeaderFile(null); if (headerFilePreview) { URL.revokeObjectURL(headerFilePreview); setHeaderFilePreview(null); } }}
                                className="text-destructive hover:text-destructive/80 text-lg"
                              >×</button>
                            </div>
                          </div>
                        )}
                        <input
                          ref={headerFileRef}
                          type="file"
                          accept={HEADER_FORMAT_ACCEPT[formData.headerFormat]}
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        {uploadError && (
                          <p className="text-xs text-destructive">{uploadError}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Body
                    </label>
                    <textarea
                      value={formData.bodyText}
                      onChange={(e) => handleInputChange('bodyText', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground resize-none"
                      rows={6}
                      placeholder="Enter your message body. Use {{1}}, {{2}} for variables."
                      maxLength={1024}
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{formData.bodyText.length}/1024</span>
                      <div className="flex items-center gap-2">
                        <button className="p-1 hover:bg-accent rounded">😊</button>
                        <button className="p-1 hover:bg-accent rounded font-bold">B</button>
                        <button className="p-1 hover:bg-accent rounded italic">I</button>
                        <button className="p-1 hover:bg-accent rounded line-through">S</button>
                        <button
                          className="text-xs text-teal-600 hover:text-teal-700"
                          onClick={() => {
                            const nextVar = variables.length > 0 ? Math.max(...variables.map(v => parseInt(v))) + 1 : 1;
                            handleInputChange('bodyText', formData.bodyText + `{{${nextVar}}}`);
                          }}
                        >
                          + Add variable
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Variable Samples */}
                  {variables.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium text-foreground mb-2">Variable samples</h4>
                      <p className="text-xs text-gray-500 mb-4">
                        Include samples of all variables in your message to help Meta review your template.
                        Remember not to include any customer information to protect your customer's privacy.
                      </p>

                      <div className="space-y-3">
                        <div className="text-sm font-medium text-foreground">Body</div>
                        {variables.map(varNum => (
                          <div key={varNum} className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 w-12">{`{{${varNum}}}`}</span>
                            <input
                              type="text"
                              value={formData.variableSamples[varNum] || ''}
                              onChange={(e) => handleVariableSampleChange(varNum, e.target.value)}
                              className="flex-1 px-3 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground text-sm"
                              placeholder={`Sample value for variable ${varNum}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Footer <span className="text-gray-400">• Optional</span>
                    </label>
                    <input
                      type="text"
                      value={formData.footerText}
                      onChange={(e) => handleInputChange('footerText', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground"
                      placeholder="Enter footer text"
                      maxLength={60}
                    />
                    <span className="text-xs text-gray-500">{formData.footerText.length}/60</span>
                  </div>

                  {/* Buttons */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Buttons <span className="text-gray-400">• Optional</span>
                    </label>
                    <div className="space-y-2">
                      {formData.buttons.map((button, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={button}
                            onChange={(e) => handleButtonChange(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground"
                            placeholder="Button text"
                            maxLength={25}
                          />
                          <button
                            onClick={() => handleRemoveButton(index)}
                            className="text-destructive hover:text-destructive/80 p-2"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {formData.buttons.length < 3 && (
                        <button
                          onClick={handleAddButton}
                          className="text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1"
                        >
                          + Add button
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Maximum 3 quick reply buttons</p>
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {activeStep === 3 && (
                <div className="space-y-6">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">⚡ Ready to Submit</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Review your template below. Once submitted, Meta will review it within 24-48 hours.
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                    <div>
                      <span className="text-xs text-gray-500">Template Name</span>
                      <p className="font-medium text-foreground">{formData.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-gray-500">Language</span>
                        <p className="font-medium text-foreground">{formData.language}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Category</span>
                        <p className="font-medium text-foreground">{formData.category}</p>
                      </div>
                    </div>
                    {formData.headerFormat === 'TEXT' && formData.headerText && (
                      <div>
                        <span className="text-xs text-gray-500">Header (Text)</span>
                        <p className="font-medium text-foreground">{formData.headerText}</p>
                      </div>
                    )}
                    {MEDIA_FORMATS.includes(formData.headerFormat) && (
                      <div>
                        <span className="text-xs text-gray-500">Header ({formData.headerFormat})</span>
                        <p className="font-medium text-foreground">
                          {HEADER_FORMAT_ICONS[formData.headerFormat]} {headerFile ? headerFile.name : (formData.mediaHandle ? 'Media attached' : 'No media')}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-500">Body</span>
                      <p className="font-medium text-foreground whitespace-pre-wrap">{formData.bodyText}</p>
                    </div>
                    {formData.footerText && (
                      <div>
                        <span className="text-xs text-gray-500">Footer</span>
                        <p className="font-medium text-foreground">{formData.footerText}</p>
                      </div>
                    )}
                    {formData.buttons.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500">Buttons</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {formData.buttons.map((btn, i) => (
                            <span key={i} className="px-3 py-1 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 rounded-full text-sm">
                              {btn}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Preview */}
            <div className="w-80 p-6 bg-background">
              <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
                Template preview
                <button className="ml-auto p-1 hover:bg-border dark:hover:bg-gray-700 rounded">
                  ▶
                </button>
              </h3>

              {/* Phone Preview */}
              <div className="bg-[#e5ddd5] dark:bg-muted rounded-lg p-4 min-h-[300px]">
                <div className="bg-white dark:bg-gray-600 rounded-lg shadow-sm p-3 max-w-[90%]">
                  {/* Header */}
                  {formData.headerFormat === 'TEXT' && formData.headerText && (
                    <div className="font-semibold text-foreground mb-2">
                      {getPreviewText(formData.headerText)}
                    </div>
                  )}
                  {MEDIA_FORMATS.includes(formData.headerFormat) && (
                    <div className="mb-2 rounded overflow-hidden bg-gray-100 dark:bg-gray-700" style={{ minHeight: '100px' }}>
                      {headerFilePreview && formData.headerFormat === 'IMAGE' ? (
                        <img src={headerFilePreview} alt="Header" className="w-full h-auto max-h-40 object-cover" />
                      ) : headerFilePreview && formData.headerFormat === 'VIDEO' ? (
                        <video src={headerFilePreview} controls className="w-full max-h-40 object-contain bg-black" />
                      ) : formData.mediaUrl && formData.headerFormat === 'IMAGE' ? (
                        <img src={formData.mediaUrl} alt="Header" className="w-full h-auto max-h-40 object-cover" />
                      ) : formData.mediaUrl && formData.headerFormat === 'VIDEO' ? (
                        <video src={formData.mediaUrl} controls className="w-full max-h-40 object-contain bg-black" />
                      ) : formData.mediaUrl && formData.headerFormat === 'DOCUMENT' ? (
                        <div className="flex flex-col items-center justify-center gap-1 py-6 text-muted-foreground">
                          <span className="text-3xl">📄</span>
                          <span className="text-xs">Document</span>
                        </div>
                      ) : formData.mediaHandle ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-2 bg-green-50 dark:bg-green-900/20 overflow-hidden">
                          {formData.mediaThumbnail && formData.mediaThumbnail.startsWith('data:') ? (
                            <img src={formData.mediaThumbnail} alt="Header" className="w-full h-auto max-h-40 object-cover" />
                          ) : (
                            <>
                              <span className="text-3xl">{HEADER_FORMAT_ICONS[formData.headerFormat]}</span>
                              <span className="text-[11px] font-medium text-green-700 dark:text-green-300">✅ Media uploaded</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1 py-6 text-muted-foreground">
                          <span className="text-3xl">{HEADER_FORMAT_ICONS[formData.headerFormat]}</span>
                          <span className="text-xs">{formData.headerFormat}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body */}
                  <div className="text-foreground text-sm whitespace-pre-wrap">
                    {getPreviewText(formData.bodyText)}
                  </div>

                  {/* Footer */}
                  {formData.footerText && (
                    <div className="text-muted-foreground text-xs mt-2">
                      {formData.footerText}
                    </div>
                  )}

                  {/* Time */}
                  <div className="text-right text-xs text-gray-400 mt-1">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  {/* Buttons */}
                  {formData.buttons.length > 0 && (
                    <div className="mt-3 border-t border-gray-200 dark:border-gray-500 pt-2 space-y-2">
                      {formData.buttons.map((btn, i) => (
                        <button
                          key={i}
                          className="w-full text-center text-teal-600 dark:text-teal-400 text-sm py-1 hover:bg-accent rounded"
                        >
                          {btn}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted dark:bg-card border-t border-border px-6 py-4 flex justify-between">
          <button
            onClick={() => activeStep > 1 ? setActiveStep(activeStep - 1) : onClose()}
            className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent"
          >
            {activeStep > 1 ? 'Previous' : 'Cancel'}
          </button>

          {activeStep < 3 ? (
            <button
              onClick={() => setActiveStep(activeStep + 1)}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name || !formData.bodyText}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </>
              ) : (
                'Submit for Review'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditTemplateModal;
