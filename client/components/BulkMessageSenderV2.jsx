'use client';

import { useState, useEffect } from 'react';
import { 
  fetchTemplates, 
  fetchContacts, 
  sendTemplateMessage,
  sendBulkTemplateMessage 
} from '@/lib/api';
import { FaWhatsapp, FaPaperPlane, FaSpinner, FaCheckCircle, FaExclamationCircle, FaUsers } from 'react-icons/fa';

export default function BulkMessageSender() {
  const [templates, setTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [variables, setVariables] = useState({ body: [] });
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [preview, setPreview] = useState('');

  useEffect(() => {
    loadTemplates();
    loadContacts();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      updatePreview();
    }
  }, [selectedTemplate, variables]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetchTemplates({ status: 'APPROVED' });
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const response = await fetchContacts(1, 1000, searchTerm);
      setContacts(response.contacts || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const handleTemplateChange = (templateId) => {
    const template = templates.find(t => t._id === templateId);
    setSelectedTemplate(template);
    
    // Extract variables from template body
    if (template) {
      const bodyComponent = template.components?.find(c => c.type === 'BODY');
      if (bodyComponent?.text) {
        const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g) || [];
        const varCount = matches.length;
        setVariables({ body: Array(varCount).fill('') });
      }
    }
  };

  const updatePreview = () => {
    if (!selectedTemplate) return;

    let previewText = '';
    
    // Header
    const headerComponent = selectedTemplate.components?.find(c => c.type === 'HEADER');
    if (headerComponent) {
      previewText += `*${headerComponent.text || ''}*\n\n`;
    }

    // Body with variables replaced
    const bodyComponent = selectedTemplate.components?.find(c => c.type === 'BODY');
    if (bodyComponent) {
      let bodyText = bodyComponent.text || '';
      variables.body.forEach((v, i) => {
        bodyText = bodyText.replace(`{{${i + 1}}}`, v || `{{${i + 1}}}`);
      });
      previewText += bodyText;
    }

    // Footer
    const footerComponent = selectedTemplate.components?.find(c => c.type === 'FOOTER');
    if (footerComponent) {
      previewText += `\n\n_${footerComponent.text}_`;
    }

    setPreview(previewText);
  };

  const handleVariableChange = (index, value) => {
    const newVars = [...variables.body];
    newVars[index] = value;
    setVariables({ ...variables, body: newVars });
  };

  const toggleContactSelection = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c._id));
    }
    setSelectAll(!selectAll);
  };

  const handleSend = async () => {
    if (!selectedTemplate) {
      alert('Please select a template');
      return;
    }

    if (selectedContacts.length === 0) {
      alert('Please select at least one contact');
      return;
    }

    if (window.confirm(`Send template "${selectedTemplate.name}" to ${selectedContacts.length} contact(s)?`)) {
      try {
        setSending(true);
        setResult(null);

        const response = await sendBulkTemplateMessage({
          contactIds: selectedContacts,
          templateId: selectedTemplate._id,
          language: selectedTemplate.language,
          variablesMap: {
            default: variables
          }
        });

        setResult(response.results);
        alert(`Success! ${response.results.sent} sent, ${response.results.failed} failed`);
        
        // Clear selection after successful send
        setSelectedContacts([]);
        setSelectAll(false);
        
      } catch (error) {
        console.error('Error sending messages:', error);
        alert(`Error: ${error.message}`);
      } finally {
        setSending(false);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <FaWhatsapp className="text-green-600" />
          Bulk Message Sender
        </h1>
        <p className="text-gray-600">Send template messages to multiple contacts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Template Selection & Variables */}
        <div className="space-y-6">
          {/* Template Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">1. Select Template</h2>
            {loading ? (
              <div className="text-center py-8">
                <FaSpinner className="animate-spin text-3xl text-gray-400 mx-auto" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No approved templates found</p>
                <p className="text-sm text-gray-500 mt-2">Create and approve templates first</p>
              </div>
            ) : (
              <select
                value={selectedTemplate?._id || ''}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Choose a template...</option>
                {templates.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name} ({template.language})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Variables Input */}
          {selectedTemplate && variables.body.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">2. Fill Variables</h2>
              <div className="space-y-3">
                {variables.body.map((value, index) => (
                  <div key={index}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Variable {index + 1}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleVariableChange(index, e.target.value)}
                      placeholder={`Value for {{${index + 1}}}`}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {selectedTemplate && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Preview</h2>
              <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded">
                <div className="whitespace-pre-wrap text-sm text-gray-800">
                  {preview}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Contact Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FaUsers />
              3. Select Contacts
            </h2>
            <span className="text-sm text-gray-600">
              {selectedContacts.length} selected
            </span>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyUp={(e) => e.key === 'Enter' && loadContacts()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Select All */}
          <div className="mb-4 pb-4 border-b">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span className="font-medium">Select All ({contacts.length})</span>
            </label>
          </div>

          {/* Contact List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {contacts.length === 0 ? (
              <p className="text-center text-gray-600 py-8">No contacts found</p>
            ) : (
              contacts.map((contact) => (
                <label
                  key={contact._id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(contact._id)}
                    onChange={() => toggleContactSelection(contact._id)}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{contact.name}</p>
                    <p className="text-sm text-gray-600">{contact.phone}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Send Button */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedTemplate && selectedContacts.length > 0 && (
              <p>
                Ready to send <strong>{selectedTemplate.name}</strong> to{' '}
                <strong>{selectedContacts.length}</strong> contact(s)
              </p>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!selectedTemplate || selectedContacts.length === 0 || sending}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center gap-2"
          >
            {sending ? (
              <>
                <FaSpinner className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <FaPaperPlane />
                Send Messages
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Send Results</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{result.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{result.sent}</div>
              <div className="text-sm text-gray-600">Sent</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{result.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>
          
          {result.details && result.details.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              {result.details.map((detail, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg mb-2 ${
                    detail.status === 'sent' ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div>
                    <p className="font-medium">{detail.phone}</p>
                    {detail.error && (
                      <p className="text-sm text-red-600">{detail.error}</p>
                    )}
                  </div>
                  {detail.status === 'sent' ? (
                    <FaCheckCircle className="text-green-600" />
                  ) : (
                    <FaExclamationCircle className="text-red-600" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
