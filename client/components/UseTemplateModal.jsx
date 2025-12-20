'use client';

import React, { useState, useEffect } from 'react';
import { fetchContacts, sendTemplateMessage } from '../lib/api';

const UseTemplateModal = ({ isOpen, onClose, template }) => {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [variables, setVariables] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadContacts();
      extractVariables();
    }
  }, [isOpen, template]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await fetchContacts(1, 100, '');
      setContacts(res.contacts || []);
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const extractVariables = () => {
    if (!template) return;
    
    // Extract variables from template components
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    const headerComponent = template.components?.find(c => c.type === 'HEADER');
    
    const bodyText = bodyComponent?.text || template.body || template.content || '';
    const headerText = headerComponent?.text || '';
    
    const regex = /\{\{(\d+)\}\}/g;
    const bodyMatches = [...bodyText.matchAll(regex)];
    const headerMatches = [...headerText.matchAll(regex)];
    
    const bodyVarNumbers = [...new Set(bodyMatches.map(m => parseInt(m[1])))].sort();
    const headerVarNumbers = [...new Set(headerMatches.map(m => parseInt(m[1])))].sort();
    
    const initialVars = {
      body: {},
      header: {}
    };
    
    bodyVarNumbers.forEach(num => {
      initialVars.body[num] = '';
    });
    
    headerVarNumbers.forEach(num => {
      initialVars.header[num] = '';
    });
    
    setVariables(initialVars);
  };

  const toggleContact = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const toggleAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c._id));
    }
  };

  const handleVariableChange = (section, varNum, value) => {
    setVariables(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [varNum]: value
      }
    }));
  };

  const handleSend = async () => {
    if (selectedContacts.length === 0) {
      alert('Please select at least one contact');
      return;
    }

    // Check if all variables are filled
    const allBodyVars = Object.values(variables.body || {});
    const allHeaderVars = Object.values(variables.header || {});
    
    if (allBodyVars.some(v => !v) || allHeaderVars.some(v => !v)) {
      alert('Please fill in all variables');
      return;
    }

    setSending(true);
    try {
      // Format variables for the API
      const formattedVariables = {
        body: Object.keys(variables.body || {})
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map(key => variables.body[key]),
        header: Object.keys(variables.header || {})
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map(key => variables.header[key])
      };

      // Send to each selected contact
      const promises = selectedContacts.map(contactId => 
        sendTemplateMessage({
          templateId: template._id,
          contactId,
          variables: formattedVariables,
          language: template.language || 'en'
        })
      );

      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        alert(`Sent to ${succeeded} contact(s). ${failed} failed.`);
      } else {
        alert(`Template sent to ${succeeded} contact(s) successfully!`);
      }
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to send template');
    } finally {
      setSending(false);
    }
  };

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.firstName?.toLowerCase().includes(term) ||
      c.lastName?.toLowerCase().includes(term) ||
      c.phone?.toLowerCase().includes(term)
    );
  });

  const previewMessage = () => {
    if (!template) return '';
    
    let message = '';
    
    // Add header
    const headerComponent = template.components?.find(c => c.type === 'HEADER');
    if (headerComponent?.text) {
      let headerText = headerComponent.text;
      Object.entries(variables.header || {}).forEach(([num, value]) => {
        headerText = headerText.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), value || `{{${num}}}`);
      });
      message += headerText + '\n\n';
    }
    
    // Add body
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    let bodyText = bodyComponent?.text || template.body || template.content || '';
    Object.entries(variables.body || {}).forEach(([num, value]) => {
      bodyText = bodyText.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), value || `{{${num}}}`);
    });
    message += bodyText;
    
    // Add footer
    const footerComponent = template.components?.find(c => c.type === 'FOOTER');
    if (footerComponent?.text) {
      message += '\n\n' + footerComponent.text;
    }
    
    return message;
  };
  
  const hasBodyVars = Object.keys(variables.body || {}).length > 0;
  const hasHeaderVars = Object.keys(variables.header || {}).length > 0;
  const hasAnyVars = hasBodyVars || hasHeaderVars;

  if (!isOpen || !template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden m-4 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">
              Use Template: {template.name}
            </h2>
            <p className="text-blue-100 text-sm mt-1">{template.category}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left Side - Configuration */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 border-r border-gray-200 dark:border-gray-700 min-h-0">
            {/* Variables Section */}
            {hasAnyVars && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Fill Variables
                </h3>
                <div className="space-y-4">
                  {/* Header Variables */}
                  {hasHeaderVars && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Header Variables:</p>
                      {Object.keys(variables.header).sort((a, b) => parseInt(a) - parseInt(b)).map(varNum => (
                        <div key={`header-${varNum}`}>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Header Variable {`{{${varNum}}}`}
                          </label>
                          <input
                            type="text"
                            value={variables.header[varNum]}
                            onChange={(e) => handleVariableChange('header', varNum, e.target.value)}
                            placeholder={`Enter value for {{${varNum}}}`}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Body Variables */}
                  {hasBodyVars && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Body Variables:</p>
                      {Object.keys(variables.body).sort((a, b) => parseInt(a) - parseInt(b)).map(varNum => (
                        <div key={`body-${varNum}`}>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Body Variable {`{{${varNum}}}`}
                          </label>
                          <input
                            type="text"
                            value={variables.body[varNum]}
                            onChange={(e) => handleVariableChange('body', varNum, e.target.value)}
                            placeholder={`Enter value for {{${varNum}}}`}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Select Contacts */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Select Contacts
                </h3>
                <span className="text-sm text-gray-500">
                  {selectedContacts.length} selected
                </span>
              </div>

              {/* Search */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search contacts..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 mb-3"
              />

              {/* Select All */}
              <label className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900 dark:text-white">
                  Select All ({filteredContacts.length})
                </span>
              </label>

              {/* Contact List */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading contacts...</p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                  {filteredContacts.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No contacts found</p>
                  ) : (
                    filteredContacts.map(contact => (
                      <label
                        key={contact._id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedContacts.includes(contact._id)}
                          onChange={() => toggleContact(contact._id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{contact.phone}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Preview */}
          <div className="w-96 bg-gray-50 dark:bg-gray-900 p-6 flex flex-col min-h-0 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex-shrink-0">
              Preview
            </h3>
            
            {/* WhatsApp-like Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="bg-[#dcf8c6] dark:bg-green-900/30 rounded-lg p-3 max-w-sm">
                <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {previewMessage()}
                </p>
                <div className="flex items-center justify-end gap-1 mt-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/>
                  </svg>
                </div>
              </div>

              {template.footer && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {template.footer}
                </p>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>{selectedContacts.length} recipient(s)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span>Template: {template.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className={`w-2 h-2 rounded-full ${
                  template.status === 'APPROVED' ? 'bg-green-500' : 'bg-yellow-500'
                }`}></span>
                <span>Status: {template.status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex gap-3 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selectedContacts.length === 0 || (hasBodyVars && Object.values(variables.body).some(v => !v)) || (hasHeaderVars && Object.values(variables.header).some(v => !v))}
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5z"/>
                  <path fillRule="evenodd" d="M3 7a1 1 0 000 2h14a1 1 0 100-2H3z"/>
                </svg>
                Send to {selectedContacts.length} Contact{selectedContacts.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UseTemplateModal;
