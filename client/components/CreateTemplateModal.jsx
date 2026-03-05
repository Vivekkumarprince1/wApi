'use client';

import React, { useState, useEffect } from 'react';
import { createTemplate, uploadTemplateMedia } from '../lib/api';
import {
  FaTimes, FaImage, FaVideo, FaFileAlt, FaMapMarkerAlt,
  FaWhatsapp, FaCheck, FaExclamationCircle, FaInfoCircle, FaSpinner
} from 'react-icons/fa';

const CreateTemplateModal = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Details, 2: Content
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
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState(null);
  const [error, setError] = useState('');
  const [buttonType, setButtonType] = useState('NONE');

  const categories = [
    { id: 'MARKETING', label: 'Marketing', desc: 'Promotions or offers, welcoming/closing messages, updates' },
    { id: 'UTILITY', label: 'Utility', desc: 'Confirm/update/cancel an order, accounting, payment updates' },
    { id: 'AUTHENTICATION', label: 'Authentication', desc: 'Send codes to verify users' }
  ];

  const languages = [
    { code: 'en', name: 'English (UK/US)' },
    { code: 'es', name: 'Spanish (ES)' },
    { code: 'hi', name: 'Hindi (IN)' },
    { code: 'pt', name: 'Portuguese (BR/PT)' },
    { code: 'ID', name: 'Indonesian (ID)' },
    { code: 'ar', name: 'Arabic (AR)' },
  ];

  const headerTypes = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'];

  // Handle header file preview
  useEffect(() => {
    if (!headerFile) {
      setHeaderPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(headerFile);
    setHeaderPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [headerFile]);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleHeaderChange = (type) => {
    setFormData(prev => ({
      ...prev,
      header: type === 'NONE' ? null : { type, text: type === 'TEXT' ? prev.header?.text || '' : null }
    }));
    if (type !== 'IMAGE' && type !== 'VIDEO' && type !== 'DOCUMENT') {
      setHeaderFile(null);
    }
  };

  const addButton = () => {
    if (buttonType === 'NONE' || formData.buttons.length >= 10) return;

    const newButton = {
      type: buttonType,
      text: '',
      ...(buttonType === 'URL' && { url: '' }),
      ...(buttonType === 'PHONE_NUMBER' && { phone_number: '' })
    };

    setFormData(prev => ({ ...prev, buttons: [...prev.buttons, newButton] }));
    setButtonType('NONE');
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
    if (!text) return [];
    const regex = /\{\{(\d+)\}\}/g;
    const matches = [...text.matchAll(regex)];
    return matches.map(m => parseInt(m[1]));
  };

  const generateWhatsAppPreview = (text, type = 'body') => {
    if (!text) return text;
    let previewText = text;

    // Replace markdown formatting with visual indicators
    previewText = previewText.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    previewText = previewText.replace(/_(.*?)_/g, '<em>$1</em>');
    previewText = previewText.replace(/~(.*?)~/g, '<del>$1</del>');
    previewText = previewText.replace(/```(.*?)```/gs, '<code class="bg-black/5 p-1 rounded font-mono text-sm">$1</code>');

    // Replace variables with actual values
    const vars = detectVariables(text);
    vars.forEach(v => {
      const sampleValue = variableSamples[v];
      const replacement = sampleValue
        ? `<span class="bg-[#dcf8c6] border border-[#00a884]/30 px-1 rounded font-medium">${sampleValue}</span>`
        : `<span class="text-[#00a884] opacity-70 border-b border-dashed border-[#00a884]">[{{${v}}}]</span>`;
      previewText = previewText.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), replacement);
    });

    return <div dangerouslySetInnerHTML={{ __html: previewText.replace(/\n/g, '<br/>') }} />;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.body) {
      setError('Template name and body are required');
      setStep(2);
      return;
    }

    const nameRegex = /^[a-z0-9_]+$/;
    if (!nameRegex.test(formData.name)) {
      setError('Template name must contain only lowercase letters, numbers, and underscores');
      setStep(1);
      return;
    }

    setLoading(true);
    setError('');

    try {
      let exampleMedia = null;
      let exampleMediaUrl = null;
      let mediaThumbnail = null;
      let mediaType = formData.header?.type || 'NONE';

      if (headerFile && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(mediaType)) {
        try {
          const uploadRes = await uploadTemplateMedia(headerFile);
          if (uploadRes) {
            if (uploadRes.handleId) {
              let rawHandle = typeof uploadRes.handleId === 'object'
                ? uploadRes.handleId.message || Object.values(uploadRes.handleId)[0]
                : uploadRes.handleId;
              // Gupshup may return multiple handles separated by newlines; use the first
              if (typeof rawHandle === 'string' && rawHandle.includes('\n')) {
                rawHandle = rawHandle.split('\n')[0].trim();
              }
              exampleMedia = typeof rawHandle === 'string' ? rawHandle.trim() : rawHandle;
            }
            if (uploadRes.url) exampleMediaUrl = uploadRes.url;
            if (uploadRes.thumbnail) mediaThumbnail = uploadRes.thumbnail;
          }
        } catch (uploadErr) {
          throw new Error('Media upload failed: ' + uploadErr.message);
        }
      }

      const bodyVars = detectVariables(formData.body);
      const headerVars = formData.header?.text ? detectVariables(formData.header.text) : [];
      const allVars = [...new Set([...bodyVars, ...headerVars])].sort();

      const templateData = {
        name: formData.name,
        category: formData.category,
        language: formData.language,
        exampleMedia,
        mediaUrl: exampleMediaUrl,
        templateType: ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(mediaType) ? mediaType : 'TEXT',
        components: [
          ...(formData.header && formData.header.type !== 'NONE' ? [{
            type: 'HEADER',
            format: formData.header.type,
            ...(formData.header.text && { text: formData.header.text }),
            ...(mediaThumbnail && { mediaThumbnail }),
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
      handleClose();

    } catch (err) {
      setError(err.message || 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      category: 'MARKETING',
      language: 'en',
      header: { type: 'NONE', text: '' },
      body: '',
      footer: '',
      buttons: []
    });
    setVariableSamples({});
    setHeaderFile(null);
    setStep(1);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex text-gray-800 antialiased font-sans">
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal Container */}
      <div className="absolute inset-y-0 right-0 w-full max-w-[1200px] bg-white flex flex-col md:flex-row shadow-2xl animate-in slide-in-from-right duration-300">

        {/* Mobile Header (Only visible on small screens) */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200 bg-white z-10">
          <h2 className="text-lg font-bold">Create Template</h2>
          <button onClick={handleClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <FaTimes />
          </button>
        </div>

        {/* LEFT COLUMN: Configuration Form */}
        <div className="flex-1 flex flex-col h-full bg-white relative z-10 border-r border-gray-200 overflow-hidden">

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-white">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create WhatsApp Template</h2>
              <p className="text-sm text-gray-500 mt-1">Design your message and save it as a draft before submitting.</p>
            </div>
          </div>

          {/* Stepper */}
          <div className="px-8 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setStep(1)}
                className={`flex items-center gap-2 text-sm font-semibold transition-colors ${step === 1 ? 'text-[#00a884]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-[#00a884] bg-[#00a884] text-white' : 'border-gray-300'}`}>1</span>
                Template Details
              </button>
              <div className="w-12 h-px bg-gray-300"></div>
              <button
                onClick={() => setStep(2)}
                className={`flex items-center gap-2 text-sm font-semibold transition-colors ${step === 2 ? 'text-[#00a884]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-[#00a884] bg-[#00a884] text-white' : 'border-gray-300'}`}>2</span>
                Message Content
              </button>
            </div>

            <button onClick={handleClose} className="hidden md:flex text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-white text-xl">
              <FaTimes />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-start gap-3">
                <FaExclamationCircle className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* STEP 1: DETAILS */}
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                {/* Name */}
                <div>
                  <label className="flex text-sm font-bold text-gray-800 mb-2">
                    Template Name <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. spring_sale_announcement"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-gray-800 transition-all font-mono text-sm"
                    maxLength={512}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <FaInfoCircle /> Use only lowercase letters, numbers, and underscores. No spaces.
                  </p>
                </div>

                {/* Category */}
                <div>
                  <label className="flex text-sm font-bold text-gray-800 mb-2">
                    Category <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        onClick={() => handleInputChange('category', cat.id)}
                        className={`cursor-pointer border rounded-lg p-4 transition-all ${formData.category === cat.id
                          ? 'border-[#00a884] bg-green-50 ring-1 ring-[#00a884]'
                          : 'border-gray-200 bg-white hover:border-green-300 hover:bg-gray-50'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-bold text-sm ${formData.category === cat.id ? 'text-[#00a884]' : 'text-gray-800'}`}>
                            {cat.label}
                          </span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.category === cat.id ? 'border-[#00a884] bg-[#00a884]' : 'border-gray-300'
                            }`}>
                            {formData.category === cat.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 leading-snug">{cat.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div>
                  <label className="flex text-sm font-bold text-gray-800 mb-2">
                    Language <span className="text-red-500 ml-1">*</span>
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-gray-800 transition-all appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundPosition: 'right 1rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.2em 1.2em'
                    }}
                  >
                    {languages.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STEP 2: CONTENT */}
            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">

                {/* Header configuration */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 text-sm">Header <span className="text-gray-400 font-normal ml-1">(Optional)</span></h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <select
                      value={formData.header?.type || 'NONE'}
                      onChange={(e) => handleHeaderChange(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md focus:border-[#00a884] outline-none text-sm text-gray-800"
                    >
                      <option value="NONE">None</option>
                      <option value="TEXT">Text</option>
                      <option value="IMAGE">Image</option>
                      <option value="VIDEO">Video</option>
                      <option value="DOCUMENT">Document</option>
                    </select>

                    {formData.header?.type === 'TEXT' && (
                      <div>
                        <input
                          type="text"
                          value={formData.header.text}
                          onChange={(e) => setFormData(prev => ({ ...prev, header: { ...prev.header, text: e.target.value } }))}
                          placeholder="Enter header text... (Limit 60 chars)"
                          maxLength={60}
                          className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md focus:border-[#00a884] outline-none text-sm"
                        />
                        <p className={`text-xs mt-1 text-right ${formData.header.text?.length >= 50 ? 'text-orange-500' : 'text-gray-400'}`}>
                          {formData.header.text?.length || 0} / 60
                        </p>
                      </div>
                    )}

                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(formData.header?.type) && (
                      <div className="border border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 text-center hover:bg-gray-100 transition-colors cursor-pointer relative group">
                        <input
                          type="file"
                          onChange={(e) => setHeaderFile(e.target.files[0])}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          accept={
                            formData.header?.type === 'IMAGE' ? 'image/jpeg,image/png' :
                              formData.header?.type === 'VIDEO' ? 'video/mp4' :
                                '.pdf'
                          }
                        />
                        <div className="flex flex-col items-center justify-center gap-2">
                          {formData.header?.type === 'IMAGE' && <FaImage className="text-3xl text-gray-400 group-hover:text-[#00a884] transition-colors" />}
                          {formData.header?.type === 'VIDEO' && <FaVideo className="text-3xl text-gray-400 group-hover:text-[#00a884] transition-colors" />}
                          {formData.header?.type === 'DOCUMENT' && <FaFileAlt className="text-3xl text-gray-400 group-hover:text-[#00a884] transition-colors" />}
                          <span className="text-sm font-semibold text-gray-700">
                            {headerFile ? headerFile.name : `Click to upload a sample ${formData.header?.type.toLowerCase()}`}
                          </span>
                          <span className="text-xs text-gray-500">
                            This sample is required for WhatsApp review.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Body configuration */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="flex items-center gap-1 font-bold text-gray-800 text-sm">
                      Body <span className="text-red-500">*</span>
                    </h3>
                    <div className="flex gap-2 text-gray-400">
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, body: prev.body + '*Bold*' }))} className="px-2 py-1 text-xs font-bold border border-gray-200 rounded hover:bg-white text-gray-700">B</button>
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, body: prev.body + '_Italic_' }))} className="px-2 py-1 text-xs italic border border-gray-200 rounded hover:bg-white text-gray-700">I</button>
                    </div>
                  </div>
                  <div className="p-0">
                    <textarea
                      value={formData.body}
                      onChange={(e) => handleInputChange('body', e.target.value)}
                      placeholder="Hi {{1}}, thanks for shopping with us! Your order {{2}} has shipped."
                      rows={6}
                      maxLength={1024}
                      className="w-full p-5 bg-white border-none block outline-none text-gray-800 text-[15px] resize-y min-h-[150px]"
                      required
                    />
                    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-xs">
                      <span className="text-blue-600 font-medium cursor-pointer hover:underline" onClick={() => {
                        const vars = detectVariables(formData.body);
                        const nextVar = vars.length > 0 ? Math.max(...vars) + 1 : 1;
                        setFormData(prev => ({ ...prev, body: prev.body + `{{${nextVar}}}` }));
                      }}>
                        + Add Variable
                      </span>
                      <span className={formData.body.length >= 1000 ? 'text-red-500 font-bold' : 'text-gray-400'}>
                        {formData.body.length} / 1024
                      </span>
                    </div>
                  </div>
                </div>

                {/* Variables Setup (Dynamic) */}
                {detectVariables(formData.body).length > 0 && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                      <FaInfoCircle className="text-blue-500" /> WhatsApp requires sample data for variables
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {detectVariables(formData.body).map(variable => (
                        <div key={`var-${variable}`} className="flex items-center gap-0">
                          <span className="text-sm font-bold bg-gray-100 text-gray-600 border border-gray-300 border-r-0 py-2.5 px-3 rounded-l-md w-[50px] text-center">
                            {`{{${variable}}}`}
                          </span>
                          <input
                            type="text"
                            value={variableSamples[variable] || ''}
                            onChange={(e) => setVariableSamples(prev => ({ ...prev, [variable]: e.target.value }))}
                            placeholder="e.g. John Doe, OR#1234"
                            className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-r-md outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] bg-white transition-all shadow-sm"
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer configuration */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                    <h3 className="font-bold text-gray-800 text-sm">Footer <span className="text-gray-400 font-normal ml-1">(Optional)</span></h3>
                  </div>
                  <div className="p-5">
                    <input
                      type="text"
                      value={formData.footer}
                      onChange={(e) => handleInputChange('footer', e.target.value)}
                      placeholder="Enter short footer text (e.g. Reply STOP to unsubscribe)"
                      maxLength={60}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md focus:border-[#00a884] outline-none text-sm"
                    />
                    <p className={`text-xs mt-1 text-right ${formData.footer?.length >= 50 ? 'text-orange-500' : 'text-gray-400'}`}>
                      {formData.footer?.length || 0} / 60
                    </p>
                  </div>
                </div>

                {/* Buttons configuration */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-12">
                  <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-sm">Buttons <span className="text-gray-400 font-normal ml-1">(Optional, max 10)</span></h3>
                    <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600">{formData.buttons.length} / 10</span>
                  </div>
                  <div className="p-5 space-y-4">

                    <div className="flex flex-wrap gap-2 mb-4">
                      <div className="flex-1 min-w-[200px] flex gap-2">
                        <select
                          value={buttonType}
                          onChange={(e) => setButtonType(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:border-[#00a884] outline-none"
                        >
                          <option value="NONE">- Select a button type -</option>
                          <option value="QUICK_REPLY">Quick Reply (Custom Text)</option>
                          <option value="URL">Call to Action: Website URL</option>
                          <option value="PHONE_NUMBER">Call to Action: Phone Number</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={addButton}
                        disabled={buttonType === 'NONE' || formData.buttons.length >= 10}
                        className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-md disabled:bg-gray-300 transition-colors"
                      >
                        Add Button
                      </button>
                    </div>

                    {formData.buttons.length > 0 && (
                      <div className="space-y-3">
                        {formData.buttons.map((button, index) => (
                          <div key={index} className="flex gap-3 items-start bg-gray-50 border border-gray-200 p-4 rounded-lg relative group">
                            <div className="bg-white p-2 rounded shadow-sm border border-gray-100 flex-shrink-0 text-gray-400 mt-0.5">
                              {button.type === 'QUICK_REPLY' ? '↩️' : button.type === 'URL' ? '🌐' : '📞'}
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Button Text (Max 25)</label>
                                <input
                                  type="text"
                                  value={button.text}
                                  onChange={(e) => updateButton(index, 'text', e.target.value)}
                                  placeholder={button.type === 'QUICK_REPLY' ? 'e.g. Yes, please' : button.type === 'URL' ? 'e.g. Visit Website' : 'e.g. Call Us'}
                                  maxLength={25}
                                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:border-[#00a884] outline-none"
                                  required
                                />
                              </div>

                              {button.type === 'URL' && (
                                <div>
                                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Website URL (Must start with https://)</label>
                                  <input
                                    type="url"
                                    value={button.url}
                                    onChange={(e) => updateButton(index, 'url', e.target.value)}
                                    placeholder="https://www.example.com"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:border-[#00a884] outline-none"
                                    required
                                  />
                                </div>
                              )}

                              {button.type === 'PHONE_NUMBER' && (
                                <div>
                                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Phone Number (with country code)</label>
                                  <input
                                    type="tel"
                                    value={button.phone_number}
                                    onChange={(e) => updateButton(index, 'phone_number', e.target.value)}
                                    placeholder="+12345678900"
                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:border-[#00a884] outline-none"
                                    required
                                  />
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeButton(index)}
                              className="absolute -top-2 -right-2 bg-red-100 text-red-500 p-1.5 rounded-full hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                            >
                              <FaTimes className="text-xs" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Form Footer / Actions */}
          <div className="p-5 border-t border-gray-200 bg-white flex justify-between items-center z-20">
            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            ) : (
              <button type="button" className="opacity-0 cursor-default px-6 py-2.5">Back</button> // spacer
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 text-gray-500 font-semibold hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>

              {step === 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!formData.name || !formData.category || !formData.language}
                  className="px-8 py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-bold rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next: Add Content
                </button>
              ) : (
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={loading || !formData.body || (detectVariables(formData.body).some(v => !variableSamples[v]))}
                  className="px-8 py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-bold rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><FaSpinner className="animate-spin" /> Saving...</span>
                  ) : (
                    'Save Draft'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WhatsApp Preview Sticky Sidebar */}
        <div className="hidden md:flex w-[400px] xl:w-[450px] bg-[#efeae2] flex-col relative z-20 shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.1)]">
          <div className="px-6 py-5 bg-[#00a884] text-white shadow-sm flex items-center gap-3">
            <FaWhatsapp className="text-3xl" />
            <div>
              <h3 className="font-bold text-lg leading-tight">Preview</h3>
              <p className="text-xs text-green-100 opacity-90">Live WhatsApp simulation</p>
            </div>
          </div>

          {/* WA Chat Background */}
          <div
            className="flex-1 overflow-y-auto p-6 flex flex-col items-center custom-scrollbar"
            style={{
              backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
              backgroundRepeat: 'repeat',
              backgroundSize: '400px',
              backgroundBlendMode: 'overlay',
              backgroundColor: '#efeae2'
            }}
          >
            <div className="text-[11px] bg-white/80 border border-black/5 px-3 py-1 rounded-lg text-gray-500 font-medium mb-4 shadow-sm backdrop-blur-sm shadow-[#0b141a]/10">
              Today
            </div>

            {/* Message Bubble Container */}
            <div className="w-full max-w-[340px] bg-white rounded-lg rounded-tl-none shadow-sm shadow-[#0b141a]/10 relative">
              {/* Bubble Tail */}
              <span className="absolute -left-3 top-0 text-white w-4 h-4">
                <svg viewBox="0 0 8 13" width="8" height="13" fill="currentColor">
                  <path d="M1.533 3.568L8 12.193V1H2.812z" />
                </svg>
              </span>

              {/* Media Header Preview */}
              {formData.header?.type !== 'NONE' && formData.header?.type !== 'TEXT' && (
                <div className="p-1 pb-0">
                  <div className="w-full aspect-[1.91/1] bg-[#e9edef] rounded-md flex items-center justify-center overflow-hidden border border-black/5">
                    {headerPreviewUrl ? (
                      formData.header.type === 'IMAGE' ? (
                        <img src={headerPreviewUrl} alt="Header" className="w-full h-full object-cover" />
                      ) : formData.header.type === 'VIDEO' ? (
                        <video src={headerPreviewUrl} className="w-full h-full object-cover" controls={false} />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-500">
                          <FaFileAlt className="text-4xl text-gray-400 mb-2" />
                          <span className="text-xs font-medium">Document Attached</span>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        {formData.header.type === 'IMAGE' && <FaImage className="text-4xl text-gray-300 mb-2" />}
                        {formData.header.type === 'VIDEO' && <FaVideo className="text-4xl text-gray-300 mb-2" />}
                        {formData.header.type === 'DOCUMENT' && <FaFileAlt className="text-4xl text-gray-300 mb-2" />}
                        <span className="text-xs font-medium text-gray-400 text-center px-4">
                          Sample {formData.header.type.toLowerCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-2 pt-1.5 px-2.5 pb-2">
                {/* Text Header Preview */}
                {formData.header?.type === 'TEXT' && formData.header?.text && (
                  <div className="font-bold text-[#111b21] mb-1.5 text-[15px] break-words">
                    {generateWhatsAppPreview(formData.header.text, 'header')}
                  </div>
                )}

                {/* Body Preview */}
                <div className="text-[14.5px] text-[#111b21] whitespace-pre-wrap leading-[1.35] break-words">
                  {formData.body ? generateWhatsAppPreview(formData.body, 'body') : <span className="text-gray-400 italic">Your message will appear here...</span>}
                </div>

                {/* Footer Preview */}
                {formData.footer && (
                  <div className="text-[12px] text-gray-500 mt-1.5 break-words">
                    {formData.footer}
                  </div>
                )}

                <div className="flex justify-end gap-1 float-right clear-both ml-4 mt-1 -mb-1">
                  <span className="text-[10px] text-gray-500 opacity-90">12:00</span>
                </div>
              </div>

              {/* Buttons Preview */}
              {formData.buttons.length > 0 && (
                <div className="flex flex-col border-t border-gray-100">
                  {formData.buttons.map((btn, idx) => (
                    <div key={idx} className="w-full py-2.5 px-3 text-[14px] text-center font-medium text-[#00a884] flex justify-center items-center gap-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors cursor-default">
                      {btn.type === 'URL' && <svg viewBox="0 0 16 16" width="14" height="14" className="mr-1 fill-current"><path d="M12.5 1h-9C2.1 1 1 2.1 1 3.5v9C1 13.9 2.1 15 3.5 15h9c1.4 0 2.5-1.1 2.5-2.5v-9C15 2.1 13.9 1 12.5 1zm1.3 6.6l-2.6 3c-.4.5-1.1.5-1.5.1l-1.4-1.3c-.4-.4-.5-1-.1-1.5.4-.5 1.1-.4 1.5 0l.6.5 1.8-2.1c.4-.4 1-.5 1.5-.1.5.5.5 1.2.2 1.4z"></path></svg>}
                      {btn.type === 'PHONE_NUMBER' && <svg viewBox="0 0 16 16" width="14" height="14" className="mr-1 fill-current"><path d="M13.6 11l-2.2-1c-.5-.2-1-.1-1.4.3l-1 1.2c-1.8-1-3.2-2.4-4.2-4.2l1.2-1c.4-.4.5-1 .3-1.4L5 2.7C4.6 2.2 4 2 3.5 2.2L1.8 3C1.3 3.3 1 3.8 1 4.5c0 4.8 3.5 9 8.2 10.4.3.1.5.1.8.1.5 0 1-.2 1.3-.6l.8-1.7c.3-.6 0-1.2-.5-1.7z"></path></svg>}
                      {btn.type === 'QUICK_REPLY' && <svg viewBox="0 0 16 16" width="14" height="14" className="mr-1 fill-current"><path d="M4 8l3 3 5-5-1.4-1.4-3.6 3.6L5.4 6.6 4 8zM8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm0 12.6C4.9 13.6 2.4 11.1 2.4 8S4.9 2.4 8 2.4 13.6 4.9 13.6 8 11.1 13.6 8 13.6z"></path></svg>}
                      {btn.text || <span className="text-gray-300 italic">Button text</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full text-center mt-6 text-xs text-gray-500 font-medium">
              This is an approximation. The exact rendering may vary slightly on different WhatsApp clients.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CreateTemplateModal;
