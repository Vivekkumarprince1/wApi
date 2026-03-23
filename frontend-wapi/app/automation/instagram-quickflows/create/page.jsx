'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaArrowLeft, FaPlus, FaTimes } from 'react-icons/fa';
import Link from 'next/link';

const TRIGGER_TYPES = [
  { value: 'comment', label: 'Comments', description: 'Reply to comments on posts' },
  { value: 'dm', label: 'Direct Messages', description: 'Reply to Instagram DMs' },
  { value: 'story_reply', label: 'Story Replies', description: 'Reply to story mentions/replies' },
  { value: 'mention', label: 'Mentions', description: 'Reply when mentioned' }
];

const MATCH_MODES = [
  { value: 'contains', label: 'Contains', description: 'Message contains any keyword' },
  { value: 'exact', label: 'Exact', description: 'Message matches keyword exactly' },
  { value: 'starts_with', label: 'Starts with', description: 'Message starts with keyword' }
];

const PRESET_TEMPLATES = {
  'price_please': {
    name: 'Price Please',
    triggerType: 'comment',
    keywords: ['price', 'cost', 'how much', '$'],
    matchMode: 'contains',
    response: {
      message: 'Thanks for your interest! 💰 Please check our DMs for pricing details.'
    }
  },
  'giveaway': {
    name: 'Giveaway',
    triggerType: 'comment',
    keywords: ['giveaway', 'contest', 'free'],
    matchMode: 'contains',
    response: {
      message: '🎁 Thanks for entering! Check your DMs for more details and terms.'
    }
  },
  'lead_gen': {
    name: 'Lead Generation',
    triggerType: 'dm',
    keywords: ['info', 'interested', 'tell me'],
    matchMode: 'contains',
    response: {
      message: '👋 Thanks for reaching out! We\'d love to help. Chat with us on WhatsApp for faster response.',
      redirectToWhatsApp: {
        enabled: true,
        customMessage: 'Hi! I\'m interested in learning more.'
      }
    }
  },
  'story_auto_reply': {
    name: 'Story Auto Reply',
    triggerType: 'story_reply',
    keywords: [],
    matchMode: 'contains',
    response: {
      message: '👋 Thanks for viewing our story! We\'re here to help.'
    }
  }
};

export default function CreateInstagramQuickflowPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <CreateInstagramQuickflowContent />
    </Suspense>
  );
}

function CreateInstagramQuickflowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preset = searchParams.get('preset');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    triggerType: 'comment',
    keywords: [],
    matchMode: 'contains',
    response: {
      message: '',
      redirectToWhatsApp: {
        enabled: false,
        customMessage: ''
      }
    }
  });
  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    // Load preset if provided
    if (preset && PRESET_TEMPLATES[preset]) {
      const presetData = PRESET_TEMPLATES[preset];
      setFormData(prev => ({
        ...prev,
        name: presetData.name,
        triggerType: presetData.triggerType,
        keywords: presetData.keywords,
        matchMode: presetData.matchMode,
        response: presetData.response
      }));
    }
  }, [preset]);

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim())) {
      setFormData(prev => ({
        ...prev,
        keywords: [...prev.keywords, keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Quickflow name is required');
      return;
    }

    if (formData.triggerType !== 'story_reply' && formData.keywords.length === 0) {
      setError('At least one keyword is required');
      return;
    }

    if (!formData.response.message.trim()) {
      setError('Response message is required');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch('/api/v1/instagram-quickflows', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const created = await response.json();
        router.push('/automation/instagram-quickflows');
      } else {
        const err = await response.json();
        setError(err.message || 'Failed to create quickflow');
      }
    } catch (err) {
      setError('Error: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/automation/instagram-quickflows"
              className="p-2 hover:bg-accent rounded-xl transition-colors"
            >
              <FaArrowLeft className="text-muted-foreground" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {preset ? `Create ${PRESET_TEMPLATES[preset]?.name}` : 'Create Instagram Quickflow'}
              </h1>
              <p className="text-muted-foreground mt-1">Set up a new quickflow to automate Instagram replies</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-card rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Quickflow Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Price Inquiry Response"
                className="w-full px-4 py-2 border border-border rounded-xl dark:bg-muted dark:text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Give your quickflow a descriptive name</p>
            </div>
          </div>

          {/* Trigger Configuration */}
          <div className="bg-card rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Trigger Configuration</h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-3">
                What should trigger this quickflow? *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TRIGGER_TYPES.map(trigger => (
                  <label
                    key={trigger.value}
                    className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      formData.triggerType === trigger.value
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-border hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="triggerType"
                      value={trigger.value}
                      checked={formData.triggerType === trigger.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, triggerType: e.target.value }))}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-foreground">{trigger.label}</p>
                      <p className="text-sm text-muted-foreground">{trigger.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Keywords */}
            {formData.triggerType !== 'story_reply' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Keywords to Trigger On *
                </label>

                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                      placeholder="Add keyword..."
                      className="flex-1 px-4 py-2 border border-border rounded-xl dark:bg-muted dark:text-foreground"
                    />
                    <button
                      type="button"
                      onClick={handleAddKeyword}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors"
                    >
                      <FaPlus />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Add keywords that trigger this quickflow</p>
                </div>

                {formData.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.keywords.map(keyword => (
                      <div
                        key={keyword}
                        className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(keyword)}
                          className="hover:text-blue-900 dark:hover:text-blue-300"
                        >
                          <FaTimes className="text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Match Mode */}
            {formData.triggerType !== 'story_reply' && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-foreground mb-3">
                  Keyword Matching Mode
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {MATCH_MODES.map(mode => (
                    <label
                      key={mode.value}
                      className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.matchMode === mode.value
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                          : 'border-border hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="matchMode"
                        value={mode.value}
                        checked={formData.matchMode === mode.value}
                        onChange={(e) => setFormData(prev => ({ ...prev, matchMode: e.target.value }))}
                      />
                      <div>
                        <p className="font-medium text-foreground text-sm">{mode.label}</p>
                        <p className="text-xs text-muted-foreground">{mode.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Response Configuration */}
          <div className="bg-card rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Response</h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                Auto-Reply Message *
              </label>
              <textarea
                value={formData.response.message}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  response: { ...prev.response, message: e.target.value }
                }))}
                placeholder="Enter the message that will be sent as a reply..."
                rows="4"
                className="w-full px-4 py-2 border border-border rounded-xl dark:bg-muted dark:text-foreground"
              />
              <div className="flex justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Character count: {formData.response.message.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formData.response.message.length > 320 ? 'ℹ️ Long message may be split' : ''}
                </p>
              </div>
            </div>

            {/* WhatsApp Redirect */}
            <div className="border-t border-border pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.response.redirectToWhatsApp?.enabled}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    response: {
                      ...prev.response,
                      redirectToWhatsApp: {
                        ...prev.response.redirectToWhatsApp,
                        enabled: e.target.checked
                      }
                    }
                  }))}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-foreground">Redirect to WhatsApp</p>
                  <p className="text-sm text-muted-foreground">Send a WhatsApp message button in the Instagram reply</p>
                </div>
              </label>

              {formData.response.redirectToWhatsApp?.enabled && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    WhatsApp Message (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.response.redirectToWhatsApp?.customMessage || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      response: {
                        ...prev.response,
                        redirectToWhatsApp: {
                          ...prev.response.redirectToWhatsApp,
                          customMessage: e.target.value
                        }
                      }
                    }))}
                    placeholder="Pre-fill message sent to WhatsApp..."
                    className="w-full px-4 py-2 border border-border rounded-xl dark:bg-muted dark:text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This message will be pre-filled in WhatsApp when user clicks the button
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href="/automation/instagram-quickflows"
              className="flex-1 px-6 py-3 border border-border text-foreground rounded-xl hover:bg-accent font-medium transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create Quickflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
