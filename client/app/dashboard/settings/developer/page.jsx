'use client';

import { useState, useEffect } from 'react';
import { FaKey, FaCopy, FaPlus, FaTrash, FaEye, FaEyeSlash } from 'react-icons/fa';

export default function DeveloperSettingsPage() {
  const [apiKeys, setApiKeys] = useState([
    { id: 1, name: 'Production API Key', key: 'sk_live_xxxxxxxxxxxxxxxxxx', created: '2025-01-15', lastUsed: '2 hours ago' },
    { id: 2, name: 'Development API Key', key: 'sk_test_xxxxxxxxxxxxxxxxxx', created: '2025-01-10', lastUsed: '1 day ago' },
  ]);
  const [showKeys, setShowKeys] = useState({});
  const [webhookUrl, setWebhookUrl] = useState('https://your-domain.com/webhook');
  const [webhookSecret, setWebhookSecret] = useState('whsec_xxxxxxxxxxxxxxxx');

  const toggleKeyVisibility = (id) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const handleCreateKey = () => {
    const name = prompt('Enter API Key name:');
    if (name) {
      const newKey = {
        id: Date.now(),
        name,
        key: `sk_live_${Math.random().toString(36).substring(2, 15)}`,
        created: new Date().toISOString().split('T')[0],
        lastUsed: 'Never'
      };
      setApiKeys([...apiKeys, newKey]);
    }
  };

  const handleDeleteKey = (id) => {
    if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      setApiKeys(apiKeys.filter(key => key.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
            <FaKey className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Developer Settings</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Manage API keys, webhooks, and integrations</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* API Keys Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">API Keys</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Use these keys to authenticate API requests</p>
            </div>
            <button
              onClick={handleCreateKey}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <FaPlus /> Create New Key
            </button>
          </div>

          <div className="space-y-3">
            {apiKeys.map(key => (
              <div key={key.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">{key.name}</h3>
                      <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded font-mono">
                        {showKeys[key.id] ? key.key : '•'.repeat(30)}
                      </code>
                      <button
                        onClick={() => toggleKeyVisibility(key.id)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showKeys[key.id] ? <FaEyeSlash /> : <FaEye />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(key.key)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <FaCopy />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>Created: {key.created}</span>
                      <span>Last used: {key.lastUsed}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-4"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Webhook Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Webhook Configuration</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Configure webhooks to receive real-time updates for messages, delivery status, and other events
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="https://your-domain.com/webhook"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Webhook Secret
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={webhookSecret}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                />
                <button
                  onClick={() => copyToClipboard(webhookSecret)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <FaCopy />
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use this secret to verify webhook requests
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Events to Subscribe
              </label>
              <div className="space-y-2">
                {['Message Received', 'Message Delivered', 'Message Read', 'Message Failed', 'Contact Updated'].map(event => (
                  <label key={event} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300 dark:border-gray-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{event}</span>
                  </label>
                ))}
              </div>
            </div>

            <button className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
              Save Webhook Configuration
            </button>
          </div>
        </div>

        {/* API Documentation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API Documentation</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Access comprehensive API documentation and code examples
          </p>
          <div className="space-y-3">
            <a
              href="#"
              className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">REST API Reference</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Complete API endpoint documentation</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </a>
            <a
              href="#"
              className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Webhook Events</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Learn about webhook event types and payloads</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </a>
            <a
              href="#"
              className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Code Examples</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sample code in multiple languages</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
