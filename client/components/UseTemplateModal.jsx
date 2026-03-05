'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchContacts, sendTemplateMessage } from '../lib/api';

const HEADER_FORMAT_ICONS = { TEXT: '📝', IMAGE: '🖼️', VIDEO: '🎬', DOCUMENT: '📄', NONE: '' };

const UseTemplateModal = ({ isOpen, onClose, template }) => {
  const [activeStep, setActiveStep] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [variables, setVariables] = useState({ body: {}, header: {} });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, succeeded: 0, failed: 0 });
  const [sendComplete, setSendComplete] = useState(false);
  const modalRef = useRef(null);

  // ─── Text helpers ──────────────────────────────────────────────────────────
  const normalizeText = (v) => {
    if (typeof v === 'string') return v;
    if (!v || typeof v !== 'object') return '';
    return v.text ?? v.content ?? v.value ?? '';
  };

  const getBodyText = () => {
    const bc = template?.components?.find(c => c.type === 'BODY');
    return bc?.text || normalizeText(template?.body) || template?.content || '';
  };

  const getHeaderText = () => {
    const hc = template?.components?.find(c => c.type === 'HEADER');
    return hc?.text || normalizeText(template?.header) || '';
  };

  const getFooterText = () => {
    const fc = template?.components?.find(c => c.type === 'FOOTER');
    return fc?.text || normalizeText(template?.footer) || '';
  };

  const getHeaderFormat = () => {
    if (!template?.header?.enabled) return template?.header?.format || 'NONE';
    return template?.header?.format || 'NONE';
  };

  const getButtonLabels = () => {
    if (!template) return [];
    const bc = template.components?.find(c => c.type === 'BUTTONS');
    if (bc?.buttons) return bc.buttons.map(b => b.text).filter(Boolean);
    if (template.buttons?.items) return template.buttons.items.map(b => b.text).filter(Boolean);
    if (Array.isArray(template.buttonLabels)) return template.buttonLabels;
    return [];
  };

  // ─── Load contacts & extract variables when opened ─────────────────────────
  useEffect(() => {
    if (isOpen && template) {
      loadContacts();
      extractVariables();
      setActiveStep(1);
      setSelectedContacts([]);
      setSearchTerm('');
      setSending(false);
      setSendComplete(false);
      setSendProgress({ current: 0, total: 0, succeeded: 0, failed: 0 });
    }
  }, [isOpen, template]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await fetchContacts(1, 100, '');
      setContacts(res.data || []);
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const extractVariables = () => {
    if (!template) return;
    const regex = /\{\{(\d+)\}\}/g;
    const bodyText = getBodyText();
    const headerText = getHeaderText();

    const bodyNums = [...new Set([...bodyText.matchAll(regex)].map(m => parseInt(m[1])))].sort();
    const headerNums = [...new Set([...headerText.matchAll(regex)].map(m => parseInt(m[1])))].sort();

    const init = { body: {}, header: {} };
    bodyNums.forEach(n => { init.body[n] = ''; });
    headerNums.forEach(n => { init.header[n] = ''; });
    setVariables(init);
  };

  // ─── Contact helpers ───────────────────────────────────────────────────────
  const contactName = (c) =>
    c.name || `${c.metadata?.firstName || ''} ${c.metadata?.lastName || ''}`.trim() || c.phone || 'Unknown';

  const contactId = (c) => c.id || c._id;

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      contactName(c).toLowerCase().includes(term) ||
      c.phone?.toLowerCase().includes(term)
    );
  });

  const toggleContact = (id) => {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedContacts.length === filteredContacts.length && filteredContacts.length > 0) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(contactId));
    }
  };

  // ─── Variable change ──────────────────────────────────────────────────────
  const handleVarChange = (section, num, value) => {
    setVariables(prev => ({ ...prev, [section]: { ...prev[section], [num]: value } }));
  };

  // ─── Preview text with substitution ────────────────────────────────────────
  const previewText = (text, section) => {
    let result = text;
    Object.entries(variables[section] || {}).forEach(([num, val]) => {
      result = result.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), val || `{{${num}}}`);
    });
    return result;
  };

  // ─── Validation ────────────────────────────────────────────────────────────
  const hasBodyVars = Object.keys(variables.body).length > 0;
  const hasHeaderVars = Object.keys(variables.header).length > 0;
  const hasAnyVars = hasBodyVars || hasHeaderVars;

  const allVarsFilled = () => {
    if (hasBodyVars && Object.values(variables.body).some(v => !v)) return false;
    if (hasHeaderVars && Object.values(variables.header).some(v => !v)) return false;
    return true;
  };

  const canProceedStep1 = !hasAnyVars || allVarsFilled();
  const canProceedStep2 = selectedContacts.length > 0;

  // ─── Send handler ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const validIds = selectedContacts.filter(id => id != null && id !== '');
    if (validIds.length === 0) return;

    setSending(true);
    setSendComplete(false);
    const total = validIds.length;
    setSendProgress({ current: 0, total, succeeded: 0, failed: 0 });

    const formattedVars = {
      body: Object.keys(variables.body).sort((a, b) => a - b).map(k => variables.body[k]),
      header: Object.keys(variables.header).sort((a, b) => a - b).map(k => variables.header[k])
    };

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
      try {
        await sendTemplateMessage({
          contactId: validIds[i],
          templateId: template._id,
          variables: formattedVars,
          language: template.language || 'en'
        });
        succeeded++;
      } catch (err) {
        console.error(`[UseTemplate] Failed to send to ${validIds[i]}:`, err);
        failed++;
      }
      setSendProgress({ current: i + 1, total, succeeded, failed });
      if (i < total - 1) await new Promise(r => setTimeout(r, 500));
    }

    setSending(false);
    setSendComplete(true);
  };

  if (!isOpen || !template) return null;

  const headerFormat = getHeaderFormat();
  const bodyText = getBodyText();
  const headerText = getHeaderText();
  const footerText = getFooterText();
  const buttons = getButtonLabels();
  const mediaThumbnail = template.header?.mediaThumbnail || '';
  const isMediaHeader = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat);

  const steps = [
    { num: 1, label: 'Fill Variables' },
    { num: 2, label: 'Select Recipients' },
    { num: 3, label: 'Review & Send' }
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={onClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        className="bg-card w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto relative z-10"
        style={{ maxHeight: 'min(90vh, 820px)' }}
      >
        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-primary text-primary-foreground px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Send Template</h2>
              <p className="text-teal-100 text-sm">{template.name} • {template.category}</p>
            </div>
            <button onClick={onClose} className="text-white hover:text-teal-200 text-2xl">×</button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center mt-4 gap-4">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-center">
                <div
                  className={`flex items-center ${!sending ? 'cursor-pointer' : 'cursor-default'} ${activeStep >= step.num ? 'opacity-100' : 'opacity-50'}`}
                  onClick={() => { if (!sending) setActiveStep(step.num); }}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${activeStep > step.num ? 'bg-green-400 text-white' :
                      activeStep === step.num ? 'bg-white text-teal-600' : 'bg-teal-500 text-white'
                    }`}>
                    {activeStep > step.num ? '✓' : step.num}
                  </div>
                  <span className="ml-2 text-sm">{step.label}</span>
                </div>
                {i < 2 && <div className="w-8 h-px bg-teal-400 mx-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Content ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left Panel */}
          <div className="flex-1 overflow-y-auto p-6 border-r border-border">
            {/* ── Step 1: Fill Variables ─── */}
            {activeStep === 1 && (
              <div className="space-y-6">
                {/* Template info card */}
                <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4 flex items-start gap-3">
                  <span className="text-2xl">{isMediaHeader ? HEADER_FORMAT_ICONS[headerFormat] : '📝'}</span>
                  <div>
                    <h3 className="font-semibold text-foreground">{template.name}</h3>
                    <p className="text-sm text-muted-foreground">{template.category} • {template.language || 'en_US'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${template.status === 'APPROVED' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <span className="text-xs text-muted-foreground">{template.status}</span>
                    </div>
                  </div>
                </div>

                {hasAnyVars ? (
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        💡 Fill in the variable values below. These will be substituted into the template before sending.
                      </p>
                    </div>

                    {/* Header Variables */}
                    {hasHeaderVars && (
                      <div>
                        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                          Header Variables
                        </h4>
                        <div className="space-y-3">
                          {Object.keys(variables.header).sort((a, b) => a - b).map(num => (
                            <div key={`h-${num}`} className="flex items-center gap-3">
                              <span className="text-sm text-gray-500 w-14 font-mono">{`{{${num}}}`}</span>
                              <input
                                type="text"
                                value={variables.header[num]}
                                onChange={(e) => handleVarChange('header', num, e.target.value)}
                                placeholder={`Header variable ${num}`}
                                className="flex-1 px-3 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Body Variables */}
                    {hasBodyVars && (
                      <div>
                        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                          Body Variables
                        </h4>
                        <div className="space-y-3">
                          {Object.keys(variables.body).sort((a, b) => a - b).map(num => (
                            <div key={`b-${num}`} className="flex items-center gap-3">
                              <span className="text-sm text-gray-500 w-14 font-mono">{`{{${num}}}`}</span>
                              <input
                                type="text"
                                value={variables.body[num]}
                                onChange={(e) => handleVarChange('body', num, e.target.value)}
                                placeholder={`Body variable ${num}`}
                                className="flex-1 px-3 py-2 border border-border rounded-lg bg-white dark:bg-muted text-foreground text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 text-center">
                    <span className="text-3xl">✅</span>
                    <p className="text-foreground font-medium mt-2">No variables to fill</p>
                    <p className="text-sm text-muted-foreground mt-1">This template has no dynamic variables. Proceed to select recipients.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Select Recipients ─── */}
            {activeStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Select Recipients</h3>
                  <span className="px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full text-sm font-medium">
                    {selectedContacts.length} selected
                  </span>
                </div>

                {/* Search */}
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>

                {/* Select All */}
                <label className="flex items-center gap-3 p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 accent-teal-600"
                  />
                  <span className="font-medium text-foreground text-sm">
                    Select All ({filteredContacts.length})
                  </span>
                </label>

                {/* Contact List */}
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto" />
                    <p className="text-sm text-muted-foreground mt-3">Loading contacts...</p>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg divide-y divide-border max-h-[380px] overflow-y-auto">
                    {filteredContacts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No contacts found</p>
                    ) : (
                      filteredContacts.map(contact => {
                        const id = contactId(contact);
                        const isSelected = selectedContacts.includes(id);
                        return (
                          <label
                            key={id}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-teal-50 dark:bg-teal-900/10' : 'hover:bg-muted'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleContact(id)}
                              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 accent-teal-600"
                            />
                            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-sm font-medium shrink-0">
                              {contactName(contact).charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{contactName(contact)}</p>
                              <p className="text-xs text-muted-foreground">{contact.phone}</p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Review & Send ─── */}
            {activeStep === 3 && (
              <div className="space-y-6">
                {/* Send Progress */}
                {(sending || sendComplete) && (
                  <div className={`rounded-lg p-4 border ${sendComplete
                      ? sendProgress.failed > 0
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    }`}>
                    {sending && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">
                            Sending messages...
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {sendProgress.current} / {sendProgress.total}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                          />
                        </div>
                      </>
                    )}
                    {sendComplete && (
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{sendProgress.failed > 0 ? '⚠️' : '✅'}</span>
                        <div>
                          <p className="font-medium text-foreground">
                            {sendProgress.failed > 0
                              ? `Sent to ${sendProgress.succeeded} of ${sendProgress.total} contacts`
                              : `Successfully sent to all ${sendProgress.succeeded} contacts!`}
                          </p>
                          {sendProgress.failed > 0 && (
                            <p className="text-sm text-red-600 dark:text-red-400">{sendProgress.failed} failed</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!sending && !sendComplete && (
                  <>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">⚡ Ready to Send</h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Review the details below and click Send to deliver this template to your selected recipients.
                      </p>
                    </div>

                    {/* Summary */}
                    <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-gray-500">Template</span>
                          <p className="font-medium text-foreground">{template.name}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Recipients</span>
                          <p className="font-medium text-foreground">{selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Language</span>
                          <p className="font-medium text-foreground">{template.language || 'en_US'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Category</span>
                          <p className="font-medium text-foreground">{template.category}</p>
                        </div>
                      </div>

                      {/* Variable summary */}
                      {hasAnyVars && (
                        <div className="border-t border-border pt-3">
                          <span className="text-xs text-gray-500">Variables</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {Object.entries(variables.body).map(([num, val]) => (
                              <span key={`bv-${num}`} className="px-2 py-1 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 rounded text-xs">
                                {`{{${num}}}`} = {val}
                              </span>
                            ))}
                            {Object.entries(variables.header).map(([num, val]) => (
                              <span key={`hv-${num}`} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                                Header {`{{${num}}}`} = {val}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Selected contacts list */}
                      <div className="border-t border-border pt-3">
                        <span className="text-xs text-gray-500 mb-2 block">Recipients</span>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                          {selectedContacts.slice(0, 20).map(id => {
                            const c = contacts.find(x => contactId(x) === id);
                            return (
                              <span key={id} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-foreground rounded text-xs">
                                {c ? contactName(c) : id}
                              </span>
                            );
                          })}
                          {selectedContacts.length > 20 && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-muted-foreground rounded text-xs">
                              +{selectedContacts.length - 20} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ─── Right Panel: WhatsApp Preview ─────────────────────────────── */}
          <div className="w-80 p-6 bg-background flex flex-col shrink-0">
            <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
              Template preview
              <span className="ml-auto text-xs text-muted-foreground">{template.language || 'en'}</span>
            </h3>

            {/* Phone Preview */}
            <div className="bg-[#e5ddd5] dark:bg-muted rounded-lg p-4 flex-1 min-h-[300px]">
              <div className="bg-white dark:bg-gray-600 rounded-lg shadow-sm p-3 max-w-[90%]">
                {/* Media Header */}
                {isMediaHeader && (
                  <div className="mb-2 rounded overflow-hidden bg-gray-100 dark:bg-gray-700" style={{ minHeight: '80px' }}>
                    {mediaThumbnail && mediaThumbnail.startsWith('data:') ? (
                      <img src={mediaThumbnail} alt="Header" className="w-full h-auto max-h-36 object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 py-6 text-muted-foreground">
                        <span className="text-3xl">{HEADER_FORMAT_ICONS[headerFormat]}</span>
                        <span className="text-xs">{headerFormat}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Text Header */}
                {headerFormat === 'TEXT' && headerText && (
                  <div className="font-semibold text-foreground mb-2 text-sm">
                    {previewText(headerText, 'header')}
                  </div>
                )}

                {/* Body */}
                <div className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">
                  {previewText(bodyText, 'body')}
                </div>

                {/* Footer */}
                {footerText && (
                  <div className="text-muted-foreground text-xs mt-2">
                    {footerText}
                  </div>
                )}

                {/* Time */}
                <div className="text-right text-xs text-gray-400 mt-1">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                {/* Buttons */}
                {buttons.length > 0 && (
                  <div className="mt-3 border-t border-gray-200 dark:border-gray-500 pt-2 space-y-1">
                    {buttons.map((btn, i) => (
                      <button
                        key={i}
                        className="w-full text-center text-teal-600 dark:text-teal-400 text-sm py-1.5 hover:bg-accent rounded"
                      >
                        {btn}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Info below preview */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-base">👥</span>
                <span>{selectedContacts.length} recipient{selectedContacts.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${template.status === 'APPROVED' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span>{template.status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Footer ─────────────────────────────────────────────────────── */}
        <div className="bg-muted dark:bg-card border-t border-border px-6 py-4 flex justify-between shrink-0">
          <button
            onClick={() => {
              if (sendComplete) { onClose(); return; }
              if (activeStep > 1) setActiveStep(activeStep - 1);
              else onClose();
            }}
            disabled={sending}
            className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent disabled:opacity-50"
          >
            {sendComplete ? 'Close' : activeStep > 1 ? 'Previous' : 'Cancel'}
          </button>

          {activeStep < 3 ? (
            <button
              onClick={() => setActiveStep(activeStep + 1)}
              disabled={
                (activeStep === 1 && !canProceedStep1) ||
                (activeStep === 2 && !canProceedStep2)
              }
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Continue
            </button>
          ) : sendComplete ? (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Done
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={sending || selectedContacts.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                  Send to {selectedContacts.length} Contact{selectedContacts.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UseTemplateModal;
