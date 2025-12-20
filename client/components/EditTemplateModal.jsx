'use client';

import React, { useState, useEffect } from 'react';

const EditTemplateModal = ({ isOpen, onClose, template, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    language: 'en_US',
    category: 'UTILITY',
    headerText: '',
    bodyText: '',
    footerText: '',
    buttons: [],
    variableSamples: {}
  });
  const [variables, setVariables] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(1); // 1: Setup, 2: Edit, 3: Review

  // Extract variables from text ({{1}}, {{2}}, etc.)
  const extractVariables = (text) => {
    const regex = /\{\{(\d+)\}\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }
    return matches.sort((a, b) => parseInt(a) - parseInt(b));
  };

  // Initialize form when template changes
  useEffect(() => {
    if (template && isOpen) {
      const body = template.bodyText || template.body || '';
      const header = template.headerText || template.header || '';
      const footer = template.footerText || template.footer || '';
      
      // Extract variables from body and header
      const bodyVars = extractVariables(body);
      const headerVars = extractVariables(header);
      const allVars = [...new Set([...headerVars, ...bodyVars])].sort((a, b) => parseInt(a) - parseInt(b));
      
      // Initialize variable samples with template variable names if available
      const samples = {};
      allVars.forEach((v, index) => {
        if (template.variables && template.variables[index]) {
          samples[v] = template.variables[index];
        } else {
          samples[v] = '';
        }
      });

      setFormData({
        name: template.name || '',
        language: template.language || 'en_US',
        category: template.category || 'UTILITY',
        headerText: header,
        bodyText: body,
        footerText: footer,
        buttons: template.buttonLabels || template.buttons || [],
        variableSamples: samples
      });
      setVariables(allVars);
      setActiveStep(1);
    }
  }, [template, isOpen]);

  // Update variables when body/header text changes
  useEffect(() => {
    const allText = formData.headerText + ' ' + formData.bodyText;
    const vars = extractVariables(allText);
    setVariables(vars);
    
    // Initialize new variables
    const newSamples = { ...formData.variableSamples };
    vars.forEach(v => {
      if (!newSamples[v]) {
        newSamples[v] = '';
      }
    });
    // Remove old variables
    Object.keys(newSamples).forEach(key => {
      if (!vars.includes(key)) {
        delete newSamples[key];
      }
    });
    setFormData(prev => ({ ...prev, variableSamples: newSamples }));
  }, [formData.headerText, formData.bodyText]);

  // Generate preview with sample values
  const getPreviewText = (text) => {
    let preview = text;
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
    try {
      await onSubmit({
        name: formData.name,
        language: formData.language,
        category: formData.category,
        headerText: formData.headerText,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-teal-600 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Create Template</h2>
              <p className="text-teal-100 text-sm">Customize and submit for Meta approval</p>
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
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                    activeStep > step.num ? 'bg-green-400 text-white' : 
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
            <div className="flex-1 p-6 border-r border-gray-200 dark:border-gray-700">
              {/* Step 1: Setup */}
              {activeStep === 1 && (
                <div className="space-y-6">
                  <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4 flex items-start gap-3">
                    <span className="text-2xl">📝</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {formData.name || 'New Template'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formData.category} • {template?.subcategory || 'Custom'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Template name and language
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Name your template</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="template_name"
                        />
                        <span className="text-xs text-gray-500">{formData.name.length}/512</span>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Select language</label>
                        <select
                          value={formData.language}
                          onChange={(e) => handleInputChange('language', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  {/* Header */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Header <span className="text-gray-400">• Optional</span>
                    </label>
                    <input
                      type="text"
                      value={formData.headerText}
                      onChange={(e) => handleInputChange('headerText', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter header text"
                      maxLength={60}
                    />
                    <span className="text-xs text-gray-500">{formData.headerText.length}/60</span>
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Body
                    </label>
                    <textarea
                      value={formData.bodyText}
                      onChange={(e) => handleInputChange('bodyText', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      rows={6}
                      placeholder="Enter your message body. Use {{1}}, {{2}} for variables."
                      maxLength={1024}
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{formData.bodyText.length}/1024</span>
                      <div className="flex items-center gap-2">
                        <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">😊</button>
                        <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded font-bold">B</button>
                        <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded italic">I</button>
                        <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded line-through">S</button>
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
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Variable samples</h4>
                      <p className="text-xs text-gray-500 mb-4">
                        Include samples of all variables in your message to help Meta review your template. 
                        Remember not to include any customer information to protect your customer's privacy.
                      </p>
                      
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Body</div>
                        {variables.map(varNum => (
                          <div key={varNum} className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 w-12">{`{{${varNum}}}`}</span>
                            <input
                              type="text"
                              value={formData.variableSamples[varNum] || ''}
                              onChange={(e) => handleVariableSampleChange(varNum, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              placeholder={`Sample value for variable ${varNum}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Footer <span className="text-gray-400">• Optional</span>
                    </label>
                    <input
                      type="text"
                      value={formData.footerText}
                      onChange={(e) => handleInputChange('footerText', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter footer text"
                      maxLength={60}
                    />
                    <span className="text-xs text-gray-500">{formData.footerText.length}/60</span>
                  </div>

                  {/* Buttons */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Buttons <span className="text-gray-400">• Optional</span>
                    </label>
                    <div className="space-y-2">
                      {formData.buttons.map((button, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={button}
                            onChange={(e) => handleButtonChange(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="Button text"
                            maxLength={25}
                          />
                          <button
                            onClick={() => handleRemoveButton(index)}
                            className="text-red-500 hover:text-red-700 p-2"
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

                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                    <div>
                      <span className="text-xs text-gray-500">Template Name</span>
                      <p className="font-medium text-gray-900 dark:text-white">{formData.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-gray-500">Language</span>
                        <p className="font-medium text-gray-900 dark:text-white">{formData.language}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Category</span>
                        <p className="font-medium text-gray-900 dark:text-white">{formData.category}</p>
                      </div>
                    </div>
                    {formData.headerText && (
                      <div>
                        <span className="text-xs text-gray-500">Header</span>
                        <p className="font-medium text-gray-900 dark:text-white">{formData.headerText}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-500">Body</span>
                      <p className="font-medium text-gray-900 dark:text-white whitespace-pre-wrap">{formData.bodyText}</p>
                    </div>
                    {formData.footerText && (
                      <div>
                        <span className="text-xs text-gray-500">Footer</span>
                        <p className="font-medium text-gray-900 dark:text-white">{formData.footerText}</p>
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
            <div className="w-80 p-6 bg-gray-50 dark:bg-gray-900">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                Template preview
                <button className="ml-auto p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                  ▶
                </button>
              </h3>
              
              {/* Phone Preview */}
              <div className="bg-[#e5ddd5] dark:bg-gray-700 rounded-lg p-4 min-h-[300px]">
                <div className="bg-white dark:bg-gray-600 rounded-lg shadow-sm p-3 max-w-[90%]">
                  {/* Header */}
                  {formData.headerText && (
                    <div className="font-semibold text-gray-900 dark:text-white mb-2">
                      {getPreviewText(formData.headerText)}
                    </div>
                  )}
                  
                  {/* Body */}
                  <div className="text-gray-700 dark:text-gray-200 text-sm whitespace-pre-wrap">
                    {getPreviewText(formData.bodyText)}
                  </div>
                  
                  {/* Footer */}
                  {formData.footerText && (
                    <div className="text-gray-500 dark:text-gray-400 text-xs mt-2">
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
                          className="w-full text-center text-teal-600 dark:text-teal-400 text-sm py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
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
        <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between">
          <button
            onClick={() => activeStep > 1 ? setActiveStep(activeStep - 1) : onClose()}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {activeStep > 1 ? 'Previous' : 'Cancel'}
          </button>
          
          {activeStep < 3 ? (
            <button
              onClick={() => setActiveStep(activeStep + 1)}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name || !formData.bodyText}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
