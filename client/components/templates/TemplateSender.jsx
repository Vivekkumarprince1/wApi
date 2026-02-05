/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEMPLATE SENDER (INTERAKT-STYLE)
 * 
 * User interface for sending approved templates.
 * 
 * Features:
 * - Browse and search approved templates
 * - Dynamic variable input forms
 * - Real-time WhatsApp preview
 * - Contact/phone number selection
 * - Bulk send capability
 * - Send history & status tracking
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FaArrowLeft, 
  FaSearch, 
  FaPaperPlane,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimes,
  FaSpinner,
  FaPlus,
  FaHistory,
  FaDownload
} from 'react-icons/fa';
import { get, post } from '../../lib/api';
import WhatsAppPreview from './WhatsAppPreview';
import { useWorkspace } from '../../lib/useWorkspace';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TemplateSender() {
  const workspace = useWorkspace();
  const bspReady = workspace.stage1Complete && ['CONNECTED', 'RESTRICTED'].includes(workspace.phoneStatus);
  const [view, setView] = useState('list'); // list, send, bulk, history
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    to: '',
    contactId: '',
    variables: {
      header: [],
      body: [],
      buttons: []
    }
  });

  const [preview, setPreview] = useState(null);
  const [sendHistory, setSendHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD APPROVED TEMPLATES
  // ─────────────────────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter) params.category = categoryFilter;

      const response = await get('/messages/templates', { params });
      setTemplates(response.templates || []);
    } catch (error) {
      showToast(error.message || 'Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter]);

  useEffect(() => {
    if (view === 'list') {
      loadTemplates();
    }
  }, [view, loadTemplates]);

  // ─────────────────────────────────────────────────────────────────────────────
  // GET TEMPLATE DETAILS & UPDATE PREVIEW
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSelectTemplate = async (template) => {
    try {
      if (!bspReady) {
        showToast('Connect WhatsApp to send template messages', 'warning');
        return;
      }
      setLoading(true);
      const response = await get(`/messages/template/${template.id}`);
      setSelectedTemplate(response.template);
      
      // Initialize form with correct variable counts
      const varCounts = response.template.variables;
      setFormData({
        to: '',
        contactId: '',
        variables: {
          header: new Array(varCounts.header || 0).fill(''),
          body: new Array(varCounts.body || 0).fill(''),
          buttons: new Array(varCounts.buttons || 0).fill('')
        }
      });
      
      setView('send');
      setPreview(null);
    } catch (error) {
      showToast(error.message || 'Failed to load template', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE VARIABLE VALUE
  // ─────────────────────────────────────────────────────────────────────────────

  const handleVariableChange = (component, index, value) => {
    setFormData(prev => ({
      ...prev,
      variables: {
        ...prev.variables,
        [component]: prev.variables[component].map((v, i) => 
          i === index ? value : v
        )
      }
    }));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PREVIEW TEMPLATE WITH VARIABLES
  // ─────────────────────────────────────────────────────────────────────────────

  const updatePreview = async () => {
    if (!selectedTemplate || !formData.to) return;

    try {
      const response = await post('/messages/template/preview', {
        templateId: selectedTemplate.id,
        variables: formData.variables
      });

      if (response.preview) {
        setPreview(response.preview);
      }
    } catch (error) {
      console.error('Preview error:', error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview();
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.variables, formData.to, selectedTemplate]);

  // ─────────────────────────────────────────────────────────────────────────────
  // SEND TEMPLATE
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSendTemplate = async () => {
    // Validate
    if (!selectedTemplate) {
      showToast('No template selected', 'error');
      return;
    }
    if (!bspReady) {
      showToast('Connect WhatsApp to send template messages', 'warning');
      return;
    }

    if (!formData.to && !formData.contactId) {
      showToast('Please enter a phone number or select a contact', 'error');
      return;
    }

    // Check all variables are filled
    const allVars = [
      ...formData.variables.header,
      ...formData.variables.body,
      ...formData.variables.buttons
    ];

    if (allVars.some(v => !v || v.trim() === '')) {
      showToast('Please fill in all variable fields', 'error');
      return;
    }

    try {
      setSending(true);

      const payload = {
        templateId: selectedTemplate.id,
        to: formData.to,
        variables: formData.variables
      };

      if (formData.contactId) {
        payload.contactId = formData.contactId;
      }

      const response = await post('/messages/template', payload);

      showToast(`Message sent successfully! ID: ${response.data.messageId}`, 'success');
      
      // Add to history
      setSendHistory(prev => [{
        template: selectedTemplate.name,
        recipient: formData.to,
        timestamp: new Date(),
        status: 'sent',
        messageId: response.data.messageId
      }, ...prev]);

      // Reset form
      setFormData({
        to: '',
        contactId: '',
        variables: {
          header: [],
          body: [],
          buttons: []
        }
      });
      setSelectedTemplate(null);
      setView('list');

    } catch (error) {
      showToast(error.message || 'Failed to send template', 'error');
    } finally {
      setSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SEND TO MULTIPLE CONTACTS (BULK)
  // ─────────────────────────────────────────────────────────────────────────────

  const [bulkRecipients, setBulkRecipients] = useState([]);
  const [bulkSending, setBulkSending] = useState(false);

  const handleBulkSend = async () => {
    if (!selectedTemplate || bulkRecipients.length === 0) {
      showToast('Please add recipients', 'error');
      return;
    }
    if (!bspReady) {
      showToast('Connect WhatsApp to send bulk messages', 'warning');
      return;
    }

    try {
      setBulkSending(true);

      const response = await post('/messages/template/bulk', {
        templateId: selectedTemplate.id,
        recipients: bulkRecipients
      });

      showToast(
        `Sent ${response.data.sent}/${response.data.total} messages successfully`,
        response.data.failed === 0 ? 'success' : 'warning'
      );

      setBulkRecipients([]);
      setSelectedTemplate(null);
      setView('list');

    } catch (error) {
      showToast(error.message || 'Failed to send bulk messages', 'error');
    } finally {
      setBulkSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TOAST NOTIFICATION
  // ─────────────────────────────────────────────────────────────────────────────

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: TEMPLATE LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        {!workspace.loading && !bspReady && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-medium">WhatsApp not connected</p>
              <p className="text-sm">Connect your WhatsApp account to send template messages.</p>
            </div>
            <button
              onClick={() => (window.location.href = '/onboarding/esb')}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              Connect Now
            </button>
          </div>
        )}
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Send Template Messages</h2>
            <p className="text-gray-500 text-sm">Select an approved template to send</p>
          </div>
          <button
            onClick={() => setView('history')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <FaHistory />
            History
          </button>
        </div>

        {/* Search & Filter */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Categories</option>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="text-center">
              <FaSpinner className="inline-block text-4xl text-green-600 animate-spin mb-4" />
              <p className="text-gray-600">Loading templates...</p>
            </div>
          </div>
        )}

        {/* Templates Grid */}
        {!loading && templates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <div
                key={template.id}
                className="group relative bg-white p-4 rounded-lg border border-gray-200 hover:border-green-500 hover:shadow-lg transition-all"
              >
                {/* Template Info */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-900">{template.displayName || template.name}</h3>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
                    {template.category}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {template.preview}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{template.language}</span>
                  <span className="flex items-center gap-1">
                    📝 {template.variables.body} vars
                  </span>
                </div>

                {/* Use This Template Button - Appears on Hover */}
                <button
                  onClick={() => handleSelectTemplate(template)}
                  className="absolute inset-0 rounded-lg bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                >
                  <span className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transform scale-90 group-hover:scale-100 transition-transform">
                    Use This Template
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && templates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No approved templates found</p>
            <p className="text-gray-400 text-sm">Create and approve templates first</p>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg text-white flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-600' :
            toast.type === 'error' ? 'bg-red-600' :
            'bg-blue-600'
          }`}>
            {toast.type === 'success' && <FaCheckCircle />}
            {toast.type === 'error' && <FaTimes />}
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: SEND MESSAGE VIEW
  // ─────────────────────────────────────────────────────────────────────────────

  if (view === 'send' && selectedTemplate) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        {!workspace.loading && !bspReady && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-medium">WhatsApp not connected</p>
              <p className="text-sm">Connect your WhatsApp account to send template messages.</p>
            </div>
            <button
              onClick={() => (window.location.href = '/onboarding/esb')}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              Connect Now
            </button>
          </div>
        )}
        {/* Back Button */}
        <button
          onClick={() => {
            setSelectedTemplate(null);
            setView('list');
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <FaArrowLeft />
          Back to Templates
        </button>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {selectedTemplate.displayName || selectedTemplate.name}
              </h3>

              {/* Template Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Category</p>
                    <p className="font-semibold text-gray-900">{selectedTemplate.category}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Language</p>
                    <p className="font-semibold text-gray-900">{selectedTemplate.language}</p>
                  </div>
                </div>
              </div>

              {/* Recipient */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="91 98765 43210"
                  value={formData.to}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    to: e.target.value
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Include country code (e.g., 91 for India)</p>
              </div>

              {/* Variables */}
              {(selectedTemplate.variables.header > 0 || 
                selectedTemplate.variables.body > 0 || 
                selectedTemplate.variables.buttons > 0) && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Message Variables</h4>

                  {/* Header Variables */}
                  {selectedTemplate.variables.header > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Header</p>
                      {formData.variables.header.map((value, idx) => (
                        <input
                          key={`header-${idx}`}
                          type="text"
                          placeholder={`Header variable ${idx + 1}`}
                          value={value}
                          onChange={(e) => handleVariableChange('header', idx, e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      ))}
                    </div>
                  )}

                  {/* Body Variables */}
                  {selectedTemplate.variables.body > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Body</p>
                      {formData.variables.body.map((value, idx) => (
                        <input
                          key={`body-${idx}`}
                          type="text"
                          placeholder={`Variable ${idx + 1}`}
                          value={value}
                          onChange={(e) => handleVariableChange('body', idx, e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      ))}
                    </div>
                  )}

                  {/* Button Variables */}
                  {selectedTemplate.variables.buttons > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Buttons</p>
                      {formData.variables.buttons.map((value, idx) => (
                        <input
                          key={`button-${idx}`}
                          type="text"
                          placeholder={`Button variable ${idx + 1}`}
                          value={value}
                          onChange={(e) => handleVariableChange('buttons', idx, e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Send Button */}
              <button
                onClick={handleSendTemplate}
                disabled={!bspReady || sending || !formData.to}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              >
                {sending ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <FaPaperPlane />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Preview */}
          <div>
            <div className="bg-white p-6 rounded-lg border border-gray-200 sticky top-6">
              <h4 className="font-bold text-gray-900 mb-4">WhatsApp Preview</h4>
              {preview ? (
                <WhatsAppPreview
                  template={{
                    header: preview.header,
                    body: preview.body,
                    footer: preview.footer,
                    buttons: preview.buttons
                  }}
                  compact
                />
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>Enter message variables to see preview</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg text-white flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-600' :
            toast.type === 'error' ? 'bg-red-600' :
            'bg-blue-600'
          }`}>
            {toast.type === 'success' && <FaCheckCircle />}
            {toast.type === 'error' && <FaTimes />}
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: HISTORY VIEW
  // ─────────────────────────────────────────────────────────────────────────────

  if (view === 'history') {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        {/* Back Button */}
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <FaArrowLeft />
          Back
        </button>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Send History</h2>

          {sendHistory.length > 0 ? (
            <div className="space-y-3">
              {sendHistory.map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{item.template}</p>
                    <p className="text-sm text-gray-600">{item.recipient}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded font-medium">
                      {item.status}
                    </span>
                    <span className="text-xs text-gray-500">{item.messageId}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">No send history yet</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
