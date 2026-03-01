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
    <div className=" p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
            <FaKey className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Developer Settings</h1>
            <p className="text-sm text-muted-foreground">Manage API keys, webhooks, and integrations</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* API Keys Section */}
        <div className="bg-card rounded-xl shadow-premium p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
              <p className="text-sm text-muted-foreground">Use these keys to authenticate API requests</p>
            </div>
            <button
              onClick={handleCreateKey}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
            >
              <FaPlus /> Create New Key
            </button>
          </div>

          <div className="space-y-3">
            {apiKeys.map(key => (
              <div key={key.id} className="border border-border rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-foreground">{key.name}</h3>
                      <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-sm bg-muted px-3 py-1 rounded font-mono">
                        {showKeys[key.id] ? key.key : '•'.repeat(30)}
                      </code>
                      <button
                        onClick={() => toggleKeyVisibility(key.id)}
                        className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
                      >
                        {showKeys[key.id] ? <FaEyeSlash /> : <FaEye />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(key.key)}
                        className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
                      >
                        <FaCopy />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Created: {key.created}</span>
                      <span>Last used: {key.lastUsed}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="text-destructive hover:text-destructive/80 dark:text-red-400 dark:hover:text-red-300 ml-4"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Webhook Configuration */}
        <div className="bg-card rounded-xl shadow-premium p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Webhook Configuration</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure webhooks to receive real-time updates for messages, delivery status, and other events
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl bg-white dark:bg-muted text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="https://your-domain.com/webhook"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Webhook Secret
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={webhookSecret}
                  readOnly
                  className="flex-1 px-4 py-2 border border-border rounded-xl bg-muted text-foreground font-mono"
                />
                <button
                  onClick={() => copyToClipboard(webhookSecret)}
                  className="px-4 py-2 border border-border rounded-xl hover:bg-accent transition-colors"
                >
                  <FaCopy />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use this secret to verify webhook requests
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Events to Subscribe
              </label>
              <div className="space-y-2">
                {['Message Received', 'Message Delivered', 'Message Read', 'Message Failed', 'Contact Updated'].map(event => (
                  <label key={event} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 text-primary focus:ring-ring border-border rounded"
                    />
                    <span className="text-sm text-foreground">{event}</span>
                  </label>
                ))}
              </div>
            </div>

            <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
              Save Webhook Configuration
            </button>
          </div>
        </div>

        {/* API Documentation */}
        <div className="bg-card rounded-xl shadow-premium p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">API Documentation</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Access comprehensive API documentation and code examples
          </p>
          <div className="space-y-3">
            <a
              href="#"
              className="block p-4 border border-border rounded-xl hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">REST API Reference</h3>
                  <p className="text-sm text-muted-foreground">Complete API endpoint documentation</p>
                </div>
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </a>
            <a
              href="#"
              className="block p-4 border border-border rounded-xl hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">Webhook Events</h3>
                  <p className="text-sm text-muted-foreground">Learn about webhook event types and payloads</p>
                </div>
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </a>
            <a
              href="#"
              className="block p-4 border border-border rounded-xl hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">Code Examples</h3>
                  <p className="text-sm text-muted-foreground">Sample code in multiple languages</p>
                </div>
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
