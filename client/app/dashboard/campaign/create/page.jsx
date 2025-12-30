'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaChevronDown, FaChevronUp, FaMobileAlt } from 'react-icons/fa';
import { fetchTemplates, createCampaign } from '../../../../lib/api.ts';

export default function CreateCampaignPage() {
  const router = useRouter();
  const [campaignName, setCampaignName] = useState('');
  const [campaignType, setCampaignType] = useState('one-time');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [audienceType, setAudienceType] = useState('');
  const [scheduleType, setScheduleType] = useState('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  
  // Data from backend
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Accordion states
  const [expandedSection, setExpandedSection] = useState(1);
  
  // Preview state
  const [previewDevice, setPreviewDevice] = useState('mobile'); // mobile or desktop

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await fetchTemplates({ status: 'APPROVED' });
      if (data && data.templates) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? 0 : section);
  };

  const handleSaveDraft = async () => {
    if (!campaignName || !selectedTemplate) {
      alert('Please enter campaign name and select a template');
      return;
    }

    try {
      setSubmitting(true);
      await createCampaign({
        name: campaignName,
        template: selectedTemplate,
        status: 'DRAFT',
        type: campaignType,
        audienceType,
        scheduleType,
        scheduleDate: scheduleType === 'scheduled' ? scheduleDate : null,
        scheduleTime: scheduleType === 'scheduled' ? scheduleTime : null
      });
      alert('Campaign saved as draft');
      router.push('/dashboard/campaign');
    } catch (err) {
      alert(err.message || 'Failed to save campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoLive = async () => {
    if (!campaignName || !selectedTemplate || !audienceType) {
      alert('Please fill in all mandatory fields');
      return;
    }

    try {
      setSubmitting(true);
      await createCampaign({
        name: campaignName,
        template: selectedTemplate,
        status: 'ACTIVE',
        type: campaignType,
        audienceType,
        scheduleType,
        scheduleDate: scheduleType === 'scheduled' ? scheduleDate : null,
        scheduleTime: scheduleType === 'scheduled' ? scheduleTime : null
      });
      alert('Campaign is going live!');
      router.push('/dashboard/campaign');
    } catch (err) {
      alert(err.message || 'Failed to launch campaign');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              ←
            </button>
            <input
              type="text"
              placeholder="Enter Campaign Name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="text-lg border-none outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Save as Draft
            </button>
            <button
              onClick={handleGoLive}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Go Live
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Side - Form */}
        <div className="flex-1 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 73px)' }}>
          {/* Basic Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
            <h2 className="text-lg font-semibold px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              Basic Settings (Mandatory)
            </h2>

            {/* Section 1: Choose Campaign Type */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleSection(1)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    1
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">Choose your campaign type</span>
                </div>
                {expandedSection === 1 ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {expandedSection === 1 && (
                <div className="px-6 py-4 space-y-4">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Campaign Type
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label
                      className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        campaignType === 'one-time'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="campaignType"
                        value="one-time"
                        checked={campaignType === 'one-time'}
                        onChange={(e) => setCampaignType(e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white mb-1">
                          📢 One Time Campaign
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Send a one-time broadcast notification to many customers at once.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        campaignType === 'ongoing'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="campaignType"
                        value="ongoing"
                        checked={campaignType === 'ongoing'}
                        onChange={(e) => setCampaignType(e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white mb-1">
                          🔄 Ongoing Campaign
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Set notifications to be sent upon the occurrence of an external pre-defined trigger.
                        </div>
                      </div>
                    </label>
                  </div>

                  <button className="w-full bg-teal-700 hover:bg-teal-800 text-white py-2 rounded-lg transition-colors font-medium mt-4">
                    Save
                  </button>
                </div>
              )}
            </div>

            {/* Section 2: Choose Message Template */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleSection(2)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    2
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">Choose your message template</span>
                </div>
                {expandedSection === 2 ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {expandedSection === 2 && (
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select a pre-approved template for your campaign message.
                  </p>
                  {loading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading templates...</p>
                    </div>
                  ) : error ? (
                    <div className="text-center py-4">
                      <p className="text-red-500 text-sm">{error}</p>
                      <button 
                        onClick={loadTemplates}
                        className="mt-2 text-blue-600 text-sm hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a template...</option>
                      {templates.map((template) => (
                        <option key={template._id} value={template._id}>
                          {template.name} ({template.category})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Choose Audience */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleSection(3)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    3
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">Choose your audience</span>
                </div>
                {expandedSection === 3 ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {expandedSection === 3 && (
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select who will receive this campaign.
                  </p>
                  <select
                    value={audienceType}
                    onChange={(e) => setAudienceType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select audience...</option>
                    <option value="all">All Contacts</option>
                    <option value="segment">Specific Segment</option>
                    <option value="upload">Upload CSV</option>
                  </select>
                </div>
              )}
            </div>

            {/* Section 4: Schedule Message */}
            <div>
              <button
                onClick={() => toggleSection(4)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    4
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">Schedule your message</span>
                </div>
                {expandedSection === 4 ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {expandedSection === 4 && (
                <div className="px-6 py-4 space-y-4">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="now"
                        checked={scheduleType === 'now'}
                        onChange={(e) => setScheduleType(e.target.value)}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Send Now</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="later"
                        checked={scheduleType === 'later'}
                        onChange={(e) => setScheduleType(e.target.value)}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Schedule for Later</span>
                    </label>
                  </div>

                  {scheduleType === 'later' && (
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              Advanced Settings (Recommended)
            </h2>

            {/* Section 5: Post-Campaign Reply Flows */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleSection(5)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    5
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">Set Post-Campaign Reply Flows</span>
                </div>
                {expandedSection === 5 ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {expandedSection === 5 && (
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure automated responses for customer replies.
                  </p>
                </div>
              )}
            </div>

            {/* Section 6: Retries for Failed Messages */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleSection(6)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    6
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">Setup retries for Failed Messages</span>
                </div>
                {expandedSection === 6 ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {expandedSection === 6 && (
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure retry attempts for failed message deliveries.
                  </p>
                </div>
              )}
            </div>

            {/* Section 7: Conversion Tracking */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleSection(7)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    7
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">Add Conversion Tracking</span>
                </div>
                {expandedSection === 7 ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {expandedSection === 7 && (
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Track campaign conversions and ROI.
                  </p>
                </div>
              )}
            </div>

            {/* Section 8: Fallback Channels */}
            <div>
              <button
                onClick={() => toggleSection(8)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    8
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">Setup Fallback Channels</span>
                </div>
                {expandedSection === 8 ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {expandedSection === 8 && (
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure alternative channels if primary delivery fails.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Preview */}
        <div className="w-[480px] bg-gray-100 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Preview</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-2 rounded ${
                    previewDevice === 'mobile'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <FaMobileAlt />
                </button>
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-2 rounded ${
                    previewDevice === 'desktop'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  💻
                </button>
              </div>
            </div>

            {/* Mobile Preview */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-2xl border-8 border-gray-800" style={{ aspectRatio: '9/19' }}>
              {/* Phone Status Bar */}
              <div className="flex items-center justify-between mb-4 px-2">
                <span className="text-xs">9:41</span>
                <div className="flex gap-1">
                  <div className="w-4 h-4">📶</div>
                  <div className="w-4 h-4">📡</div>
                  <div className="w-4 h-4">🔋</div>
                </div>
              </div>

              {/* WhatsApp Header */}
              <div className="bg-teal-700 text-white px-3 py-2 rounded-t-lg flex items-center gap-2 mb-1">
                <button className="text-white">←</button>
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  🏪
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{process.env.NEXT_PUBLIC_APP_DOMAIN || 'interakt.shop'} Sandbox</div>
                </div>
              </div>

              {/* Message Area */}
              <div className="bg-[#e5ddd5] dark:bg-gray-800 h-[400px] p-4 rounded-b-lg overflow-y-auto">
                <div className="text-center text-xs text-gray-500 mb-4">Today</div>
                
                {selectedTemplate ? (
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-3 max-w-[85%] shadow-sm">
                    <p className="text-sm text-gray-900 dark:text-white">
                      Preview of selected template will appear here
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-sm text-gray-500 mt-20">
                    Select a template to preview
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="mt-2 flex items-center gap-2 bg-white dark:bg-gray-700 rounded-full px-3 py-2">
                <span className="text-gray-400">😊</span>
                <input
                  type="text"
                  placeholder="Type a message"
                  className="flex-1 bg-transparent outline-none text-sm"
                  disabled
                />
                <button className="text-teal-600">
                  🎤
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
