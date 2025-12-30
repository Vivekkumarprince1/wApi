'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaChevronDown, FaChevronUp, FaMobileAlt, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { fetchTemplates, createCampaign, fetchContacts } from '../../../../lib/api.ts';

export default function CreateCampaignPageEnhanced() {
  const router = useRouter();
  
  // Basic info
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState('one-time');
  
  // Template selection
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateError, setTemplateError] = useState('');
  
  // Variable mapping
  const [variableMapping, setVariableMapping] = useState({});
  
  // Contacts
  const [allContacts, setAllContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  
  // Scheduling
  const [scheduleType, setScheduleType] = useState('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  
  // UI states
  const [expandedSection, setExpandedSection] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Preview
  const [previewDevice, setPreviewDevice] = useState('mobile');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load APPROVED templates only
      const templatesData = await fetchTemplates({ status: 'APPROVED' });
      if (templatesData?.templates) {
        setTemplates(templatesData.templates);
      }
      
      // Load contacts
      const contactsData = await fetchContacts();
      if (contactsData?.contacts) {
        setAllContacts(contactsData.contacts);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? 0 : section);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setTemplateError('');
    
    // Initialize variable mapping
    if (template.variables && template.variables.length > 0) {
      const mapping = {};
      template.variables.forEach(v => {
        mapping[v] = ''; // Empty, user will map
      });
      setVariableMapping(mapping);
    } else {
      setVariableMapping({});
    }
  };

  const handleVariableMap = (variable, field) => {
    setVariableMapping(prev => ({
      ...prev,
      [variable]: field
    }));
  };

  const filteredContacts = allContacts.filter(c =>
    c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone?.includes(contactSearch)
  );

  const toggleContact = (contactId) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const validateCampaign = () => {
    if (!campaignName.trim()) {
      setError('Campaign name is required');
      return false;
    }
    
    if (!selectedTemplate) {
      setError('Template selection is required');
      setTemplateError('Please select an APPROVED template');
      return false;
    }
    
    // Check if all variables are mapped
    if (selectedTemplate.variables && selectedTemplate.variables.length > 0) {
      for (const v of selectedTemplate.variables) {
        if (!variableMapping[v]) {
          setError(`Variable "${v}" must be mapped to a contact field`);
          return false;
        }
      }
    }
    
    if (selectedContacts.length === 0) {
      setError('At least one contact must be selected');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleCreate = async () => {
    if (!validateCampaign()) {
      return;
    }

    try {
      setSubmitting(true);
      
      const campaignData = {
        name: campaignName,
        template: selectedTemplate._id,
        contacts: selectedContacts,
        variableMapping: variableMapping,
        campaignType: campaignType,
        scheduleType: scheduleType,
        ...(scheduleType === 'scheduled' && {
          scheduleAt: new Date(`${scheduleDate}T${scheduleTime}`)
        })
      };

      const response = await createCampaign(campaignData);
      
      if (response.success || response.campaign) {
        alert(`Campaign created successfully! Ready to send.`);
        router.push('/dashboard/campaign');
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to create campaign';
      
      // Handle specific error codes
      if (errorMsg.includes('TEMPLATE_NOT_APPROVED')) {
        setError('Selected template is not approved. Only approved templates can be used.');
      } else if (errorMsg.includes('DAILY_LIMIT_EXCEEDED')) {
        setError('Daily message limit exceeded. Please upgrade your plan.');
      } else if (errorMsg.includes('TOKEN_EXPIRED')) {
        setError('WhatsApp connection expired. Please reconnect your account.');
      } else if (errorMsg.includes('ACCOUNT_BLOCKED')) {
        setError('Your WhatsApp account is blocked. Contact support.');
      } else {
        setError(errorMsg);
      }
      
      console.error('Campaign creation error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading templates and contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              ←
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Campaign</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard/campaign')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
            >
              {submitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="m-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
          <FaExclamationTriangle className="text-red-600 dark:text-red-400 mt-0.5" />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="p-6 max-w-4xl mx-auto">
        {/* Section 1: Basic Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => toggleSection(1)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium text-white">1</span>
              <span className="font-semibold text-gray-900 dark:text-white">Campaign Details</span>
            </div>
            {expandedSection === 1 ? <FaChevronUp /> : <FaChevronDown />}
          </button>

          {expandedSection === 1 && (
            <div className="px-6 py-6 space-y-6">
              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Campaign Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Holiday Promotion"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Campaign Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Campaign Type <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    campaignType === 'one-time'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}>
                    <input
                      type="radio"
                      value="one-time"
                      checked={campaignType === 'one-time'}
                      onChange={(e) => setCampaignType(e.target.value)}
                      className="mr-2"
                    />
                    <span className="font-medium">One-Time Campaign</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Send now to all contacts</p>
                  </label>

                  <label className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    campaignType === 'scheduled'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}>
                    <input
                      type="radio"
                      value="scheduled"
                      checked={campaignType === 'scheduled'}
                      onChange={(e) => setCampaignType(e.target.value)}
                      className="mr-2"
                    />
                    <span className="font-medium">Scheduled Campaign</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Send at a specific time</p>
                  </label>
                </div>
              </div>

              {campaignType === 'scheduled' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Time <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Template Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => toggleSection(2)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium text-white">2</span>
              <span className="font-semibold text-gray-900 dark:text-white">Select Template</span>
              {selectedTemplate && <FaCheckCircle className="text-green-600" />}
            </div>
            {expandedSection === 2 ? <FaChevronUp /> : <FaChevronDown />}
          </button>

          {expandedSection === 2 && (
            <div className="px-6 py-6 space-y-4">
              {templateError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm">
                  {templateError}
                </div>
              )}
              
              {templates.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <p className="mb-2">No approved templates found</p>
                  <button
                    onClick={() => router.push('/dashboard/templates')}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create a template first
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {templates.map(template => (
                    <div
                      key={template._id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedTemplate?._id === template._id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{template.preview || template.bodyText}</p>
                          {template.variables && template.variables.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {template.variables.map(v => (
                                <span key={v} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-xs rounded text-gray-700 dark:text-gray-300">
                                  {`{{${v}}}`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {selectedTemplate?._id === template._id && (
                          <FaCheckCircle className="text-green-600 mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3: Variable Mapping */}
        {selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
            <button
              onClick={() => toggleSection(3)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium text-white">3</span>
                <span className="font-semibold text-gray-900 dark:text-white">Map Variables</span>
                {Object.keys(variableMapping).length === selectedTemplate.variables.length && 
                 Object.values(variableMapping).every(v => v) && <FaCheckCircle className="text-green-600" />}
              </div>
              {expandedSection === 3 ? <FaChevronUp /> : <FaChevronDown />}
            </button>

            {expandedSection === 3 && (
              <div className="px-6 py-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Map each template variable to a contact field for personalization.
                </p>
                {selectedTemplate.variables.map(variable => (
                  <div key={variable}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {`{{${variable}}}`} <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={variableMapping[variable] || ''}
                      onChange={(e) => handleVariableMap(variable, e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a field</option>
                      <option value="name">Contact Name</option>
                      <option value="phone">Phone Number</option>
                      <option value="metadata.email">Email</option>
                      <option value="metadata.firstName">First Name</option>
                      <option value="metadata.lastName">Last Name</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 4: Select Contacts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => toggleSection(4)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium text-white">4</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                Select Contacts ({selectedContacts.length})
              </span>
              {selectedContacts.length > 0 && <FaCheckCircle className="text-green-600" />}
            </div>
            {expandedSection === 4 ? <FaChevronUp /> : <FaChevronDown />}
          </button>

          {expandedSection === 4 && (
            <div className="px-6 py-6 space-y-4">
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
              />
              
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredContacts.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No contacts found</p>
                ) : (
                  filteredContacts.map(contact => (
                    <label key={contact._id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact._id)}
                        onChange={() => toggleContact(contact._id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">{contact.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{contact.phone}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
