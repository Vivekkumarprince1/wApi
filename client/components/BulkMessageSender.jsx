import React, { useState, useEffect } from 'react';
import { FaUpload, FaUsers, FaEnvelope, FaFileCsv, FaTrash, FaPlay, FaPlus, FaEdit } from 'react-icons/fa';
import { 
  fetchContacts, 
  fetchTemplates, 
  createCampaign, 
  startCampaign,
  getContactStats 
} from '../lib/api';

const BulkMessageSender = () => {
  const [contacts, setContacts] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [contactStats, setContactStats] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [showContactSelector, setShowContactSelector] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Load templates and contact stats on component mount
  useEffect(() => {
    loadTemplates();
    loadContactStats();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await fetchTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadContactStats = async () => {
    try {
      const response = await getContactStats();
      setContactStats(response);
    } catch (error) {
      console.error('Error loading contact stats:', error);
    }
  };

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const response = await fetchContacts();
      setAllContacts(response.contacts || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const contactData = lines.slice(1).map(line => {
          const values = line.split(',');
          const contact = {};
          headers.forEach((header, index) => {
            contact[header.trim()] = values[index]?.trim() || '';
          });
          return contact;
        });
        setContacts(contactData);
      };
      reader.readAsText(file);
    }
  };

  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setMessage(template.content);
    }
  };

  const handleSendBulkMessages = async () => {
    try {
      setIsLoading(true);
      
      // Create campaign
      const campaignData = {
        name: campaignName,
        message: message,
        templateId: selectedTemplate?.id || null
      };

      const campaignResponse = await createCampaign(campaignData);
      const campaignId = campaignResponse.campaign.id;

      // Get contact IDs from selected contacts or uploaded contacts
      const contactIds = selectedContacts.length > 0 
        ? selectedContacts.map(c => c.id)
        : contacts.map(c => c.id).filter(id => id);

      if (contactIds.length === 0) {
        throw new Error('No valid contacts selected');
      }

      // Start the campaign
      await startCampaign(campaignId, contactIds);

      alert(`Campaign "${campaignName}" started successfully! Messages will be sent to ${contactIds.length} contacts.`);
      
      // Reset form
      setContacts([]);
      setSelectedContacts([]);
      setCampaignName('');
      setMessage('');
      setSelectedTemplate('');
      
    } catch (error) {
      console.error('Error sending bulk messages:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bulk Message Sender</h2>
        <p className="text-gray-600">Send personalized messages to multiple contacts using WhatsApp Business API</p>
      </div>

      {/* Campaign Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Contact Selection */}
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <FaUsers className="mx-auto text-4xl text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select Contacts</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose from your existing contacts or upload new ones
              </p>
              
              {/* Contact Stats */}
              {contactStats && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{contactStats.totalContacts}</span> total contacts
                    <br />
                    <span className="font-medium">{contactStats.contactsWithEmail}</span> with email
                    <br />
                    <span className="font-medium">{contactStats.contactsWithCompany}</span> with company
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => {
                    loadContacts();
                    setShowContactSelector(true);
                  }}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FaUsers className="inline mr-2" />
                  Select from Contacts
                </button>
                
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-green-700 transition-colors inline-block text-center"
                  >
                    <FaUpload className="inline mr-2" />
                    Upload CSV
                  </label>
                </div>
              </div>
            </div>
            
            {/* Selected Contacts Summary */}
            {(selectedContacts.length > 0 || contacts.length > 0) && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    <FaUsers className="inline mr-1" />
                    {selectedContacts.length + contacts.length} contacts selected
                  </span>
                  <button
                    onClick={() => {
                      setContacts([]);
                      setSelectedContacts([]);
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    <FaTrash className="inline mr-1" />
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Campaign Details */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Name
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Enter campaign name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Template
            </label>
            <select
              value={selectedTemplate?.id || ''}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={loadingTemplates}
            >
              <option value="">
                {loadingTemplates ? 'Loading templates...' : 'Choose a template'}
              </option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.category})
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Template:</strong> {selectedTemplate.name}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Content:</strong> {selectedTemplate.content}
                </p>
                {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Variables:</strong> {selectedTemplate.variables.join(', ')}
                  </p>
                )}
              </div>
            )}
            {templates.length === 0 && !loadingTemplates && (
              <p className="text-sm text-gray-500 mt-1">
                No templates available. Create templates first.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Message Editor */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message Content
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
                            placeholder="Enter your message here. Use {'{{variable}}'} for personalization."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
                        <div className="mt-2 text-sm text-gray-600">
                  <p>Available variables: name, phone, email, company</p>
                  <p>Use {'{{variable}}'} format for personalization</p>
                </div>
      </div>

      {/* Preview */}
      {contacts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Preview (First 3 contacts)</h3>
          <div className="space-y-2">
            {contacts.slice(0, 3).map((contact, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{contact.name || 'No name'}</span>
                    <span className="text-gray-600 ml-2">{contact.phone || 'No phone'}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {contact.email || 'No email'}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  <strong>Message:</strong> {message.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
                    return contact[variable] || match;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {contacts.length > 0 && (
            <span>
              <FaEnvelope className="inline mr-1" />
              Ready to send to {contacts.length} contacts
            </span>
          )}
        </div>
        <button
          onClick={handleSendBulkMessages}
          disabled={contacts.length === 0 || !message.trim() || isLoading}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sending...
            </>
          ) : (
            <>
              <FaPlay className="mr-2" />
              Send Bulk Messages
            </>
          )}
        </button>
      </div>

      {/* Contact Selector Modal */}
      {showContactSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Select Contacts</h3>
              <button
                onClick={() => setShowContactSelector(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {loadingContacts ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading contacts...</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {allContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedContacts.find(c => c.id === contact.id)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        const isSelected = selectedContacts.find(c => c.id === contact.id);
                        if (isSelected) {
                          setSelectedContacts(selectedContacts.filter(c => c.id !== contact.id));
                        } else {
                          setSelectedContacts([...selectedContacts, contact]);
                        }
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {contact.phone} • {contact.email}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {selectedContacts.find(c => c.id === contact.id) ? '✓' : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-600">
                    {selectedContacts.length} contacts selected
                  </span>
                  <div className="space-x-2">
                    <button
                      onClick={() => setShowContactSelector(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setShowContactSelector(false)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Confirm Selection
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkMessageSender; 