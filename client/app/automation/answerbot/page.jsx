'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  generateAnswerBotFAQs,
  getAnswerBotFAQs,
  approveAnswerBotFAQs,
  deleteAnswerBotFAQ,
  getAnswerBotSources
} from '@/lib/api';

export default function AnswerBotPage() {
  const params = useParams();
  const [workspaceId, setWorkspaceId] = useState('');

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [faqs, setFaqs] = useState([]);
  const [selectedFaqIds, setSelectedFaqIds] = useState(new Set());
  const [expandedFaqIds, setExpandedFaqIds] = useState(new Set());

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get workspace ID from params, localStorage, JWT token, or API
  useEffect(() => {
    // Try to get from URL params first
    if (params?.workspaceId) {
      setWorkspaceId(params.workspaceId);
      return;
    }
    
    if (typeof window !== 'undefined') {
      let found = false;
      
      // Try multiple possible localStorage keys
      const possibleKeys = ['workspaceId', 'workspace', 'currentWorkspace', 'selectedWorkspace', 'currentWorkspaceId'];
      for (const key of possibleKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            const id = parsed?._id || parsed?.id || parsed;
            if (id && id !== 'undefined') {
              console.log(`Found workspace ID from localStorage key "${key}":`, id);
              setWorkspaceId(id);
              found = true;
              break;
            }
          } catch (e) {
            if (value && value !== 'undefined') {
              console.log(`Using localStorage key "${key}" as is:`, value);
              setWorkspaceId(value);
              found = true;
              break;
            }
          }
        }
      }
      
      // If not found, fetch from API /auth/me endpoint
      if (!found) {
        const fetchWorkspaceId = async () => {
          try {
            const token = localStorage.getItem('token');
            if (!token) {
              console.error('No authentication token found');
              return;
            }
            
            console.log('Fetching user profile from /auth/me...');
            const response = await fetch('http://localhost:5001/api/v1/auth/me', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('User profile data from /auth/me:', data);
              
              // Extract workspace ID from response
              const workspaceId = data.data?.workspace?._id || 
                                 data.workspace?._id || 
                                 data.data?.workspace?.id ||
                                 data.workspace?.id;
              
              if (workspaceId) {
                console.log('Found workspace ID from API:', workspaceId);
                setWorkspaceId(workspaceId);
                // Store it in localStorage for future use
                localStorage.setItem('workspaceId', workspaceId);
              } else {
                console.error('Workspace ID not found in API response. Full response:', data);
              }
            } else {
              console.error('Failed to fetch user profile. Status:', response.status);
              const errorText = await response.text();
              console.error('Error response:', errorText);
            }
          } catch (e) {
            console.error('Error fetching workspace ID from API:', e);
          }
        };
        
        fetchWorkspaceId();
      }
    }
  }, [params]);

  // Fetch FAQs when workspace ID is available
  useEffect(() => {
    if (workspaceId) {
      fetchFAQs();
    }
  }, [workspaceId]);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const response = await getAnswerBotFAQs(workspaceId, { status: 'draft' });
      setFaqs(response.faqs || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch FAQs');
      console.error('Error fetching FAQs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFAQs = async (e) => {
    e.preventDefault();
    if (!websiteUrl.trim()) {
      setError('Please enter a website URL');
      return;
    }

    try {
      setGenerating(true);
      setError('');
      setSuccess('');

      const response = await generateAnswerBotFAQs(workspaceId, websiteUrl);

      if (response.success) {
        setFaqs(response.faqs || []);
        setSuccess(`Generated ${response.faqs?.length || 0} FAQs from website`);
        setSelectedFaqIds(new Set());
      } else {
        setError(response.error || 'Failed to generate FAQs');
      }
    } catch (err) {
      setError(err.message || 'Error generating FAQs');
      console.error('Error generating FAQs:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveFAQs = async () => {
    if (selectedFaqIds.size === 0) {
      setError('Please select at least one FAQ to approve');
      return;
    }

    try {
      setApproving(true);
      setError('');

      const response = await approveAnswerBotFAQs(
        workspaceId,
        Array.from(selectedFaqIds)
      );

      if (response.success) {
        setSuccess(`Approved ${response.modifiedCount} FAQs`);
        const approvedIds = new Set(selectedFaqIds);
        setFaqs(faqs.filter(faq => !approvedIds.has(faq._id)));
        setSelectedFaqIds(new Set());
      } else {
        setError(response.error || 'Failed to approve FAQs');
      }
    } catch (err) {
      setError(err.message || 'Error approving FAQs');
      console.error('Error approving FAQs:', err);
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteFAQ = async (faqId) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      const response = await deleteAnswerBotFAQ(workspaceId, faqId);
      if (response.success) {
        setFaqs(faqs.filter(faq => faq._id !== faqId));
        setSelectedFaqIds(prev => {
          const updated = new Set(prev);
          updated.delete(faqId);
          return updated;
        });
      }
    } catch (err) {
      setError(err.message || 'Error deleting FAQ');
    }
  };

  const toggleFaqSelection = (faqId) => {
    setSelectedFaqIds(prev => {
      const updated = new Set(prev);
      if (updated.has(faqId)) {
        updated.delete(faqId);
      } else {
        updated.add(faqId);
      }
      return updated;
    });
  };

  const toggleFaqExpanded = (faqId) => {
    setExpandedFaqIds(prev => {
      const updated = new Set(prev);
      if (updated.has(faqId)) {
        updated.delete(faqId);
      } else {
        updated.add(faqId);
      }
      return updated;
    });
  };

  const handleClearUrl = () => {
    setWebsiteUrl('');
    setFaqs([]);
    setSelectedFaqIds(new Set());
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {!workspaceId ? (
        <div className="border-b border-gray-200 dark:border-gray-800 p-6">
          <div className="max-w-5xl">
            <p className="text-red-600 dark:text-red-400">
              Error: Workspace ID not found. Please make sure you're logged in and try again.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-800 p-6">
            <div className="max-w-5xl">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    AnswerBot
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Import FAQs from your website within minutes so that your customers don't have to wait long to get answers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-5xl mx-auto p-6">
        {/* Sandbox Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>In Sandbox mode,</strong> utilize a single web URL input for a one-time scan.
            </p>
          </div>
          <a href="/dashboard/settings/plan" className="text-blue-600 dark:text-blue-400 text-sm font-semibold hover:underline whitespace-nowrap ml-4">
            Upgrade Plan
          </a>
        </div>

        {/* Website Input Section */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Web URL
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={generating}
              />
              {websiteUrl && (
                <button
                  type="button"
                  onClick={handleClearUrl}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  disabled={generating}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={handleGenerateFAQs}
              disabled={generating || !websiteUrl}
              className="px-6 py-2.5 rounded-lg bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating...' : 'Generate FAQs'}
            </button>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
          </div>
        )}

        {/* FAQs Results Section */}
        {loading ? (
          <div className="flex justify-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading FAQs...</p>
          </div>
        ) : faqs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              Generate FAQs by entering a website URL above
            </p>
          </div>
        ) : (
          <div>
            {/* Info Message */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>Explore the list below</strong> to see the FAQs I've generated for your website. Customize and enhance them to guarantee a seamless customer experience.
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                Approved FAQs move to Autoreply further edits can be made there!
              </p>
            </div>

            {/* FAQ List */}
            <div className="space-y-3 mb-6">
              {faqs.map((faq) => (
                <div
                  key={faq._id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedFaqIds.has(faq._id)}
                      onChange={() => toggleFaqSelection(faq._id)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />

                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                        {faq.question}
                      </h3>
                      {faq.variations && faq.variations.length > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          +{faq.variations.length} variations
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => toggleFaqExpanded(faq._id)}
                      className="text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors text-lg"
                    >
                      {expandedFaqIds.has(faq._id) ? '−' : '+'}
                    </button>
                  </div>

                  {expandedFaqIds.has(faq._id) && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                            Answer
                          </label>
                          <p className="text-gray-900 dark:text-gray-100 text-sm">
                            {faq.answer}
                          </p>
                        </div>

                        {faq.variations && faq.variations.length > 0 && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                              Variations
                            </label>
                            <div className="space-y-1">
                              {faq.variations.map((variation, idx) => (
                                <p key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                                  • {variation}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClearUrl}
                className="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                Complete without saving
              </button>
              <button
                onClick={handleApproveFAQs}
                disabled={approving || selectedFaqIds.size === 0}
                className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approving ? 'Saving...' : `Save approved FAQs (${selectedFaqIds.size})`}
              </button>
            </div>
          </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}

