"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import Sidebar from '@/components/Sidebar';
import { getWidgetConfig, updateWidgetConfig } from '@/lib/api';

const WidgetPage = () => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [theme, setTheme] = useState('light');
  const [position, setPosition] = useState('bottom-right');

  const widgetCode = `<!-- WhatsApp Chat Widget -->
<script>
  (function() {
    const script = document.createElement('script');
    script.src = 'https://api.example.com/widget/v1/embed.js';
    script.async = true;
    script.onload = function() {
      InteraktWidget.init({
        apiKey: '${widgetConfig?.apiKey || 'YOUR_API_KEY_HERE'}',
        businessPhone: '${phoneNumber || '+1234567890'}',
        theme: '${theme}'
      });
    };
    document.head.appendChild(script);
  })();
</script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(widgetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveConfiguration = async () => {
    try {
      setSaving(true);
      const config = {
        position,
        color: {
          primary: '#008069',
          secondary: '#ffffff',
          text: '#333333'
        },
        greeting: {
          text: 'Hello! How can we help?',
          enabled: true
        },
        defaultMessage: 'Hi, I have a question...',
      };

      await updateWidgetConfig(config);
      alert('Widget configuration saved successfully!');
    } catch (err) {
      alert('Error saving configuration: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('No token found, redirecting to login');
      router.push('/auth/login');
      return;
    }

    console.log('Token found, user authenticated');
    setIsAuthenticated(true);
    
    // Fetch widget configuration
    const fetchWidgetConfig = async () => {
      try {
        const response = await getWidgetConfig();
        setWidgetConfig(response.data);
        if (response.data?.position) setPosition(response.data.position);
        if (response.data?.color?.primary) setPhoneNumber(response.data.phoneNumber || '');
        setLoading(false);
      } catch (err) {
        console.error('Error fetching widget config:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchWidgetConfig();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} currentPath="/widget" />
      
      <div className="flex-1 flex flex-col lg:ml-16">
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">💬</span>
                  <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Chat Widget</h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Embed a WhatsApp chat widget on your website to enable customer communication.
                </p>
              </div>

              {/* Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Widget Preview - Left Column */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Widget Preview</h3>
                    
                    {/* Phone Preview */}
                    <div className="bg-white dark:bg-gray-700 rounded-lg border-8 border-gray-300 dark:border-gray-600 overflow-hidden shadow-lg">
                      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-4">
                        <h4 className="font-semibold text-sm">Support Chat</h4>
                        <p className="text-xs opacity-80">We typically respond in minutes</p>
                      </div>
                      
                      <div className="h-64 bg-gray-100 dark:bg-gray-600 p-4 flex flex-col gap-2">
                        <div className="bg-teal-100 dark:bg-teal-900 rounded-lg p-3 text-sm max-w-xs">
                          👋 Hi there! How can we help?
                        </div>
                        <div className="self-end bg-blue-100 dark:bg-blue-900 rounded-lg p-3 text-sm max-w-xs">
                          I have a question about pricing
                        </div>
                      </div>

                      <div className="bg-gray-100 dark:bg-gray-700 p-4 border-t border-gray-200 dark:border-gray-600">
                        <input 
                          type="text" 
                          placeholder="Type a message..." 
                          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white text-sm"
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration - Right Columns */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Installation Section */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">💻</span>
                      <h3 className="font-semibold text-gray-800 dark:text-white">Installation Code</h3>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Add this code snippet to your website's HTML, just before the closing <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">&lt;/body&gt;</code> tag:
                    </p>

                    <div className="relative bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-x-auto mb-4">
                      <pre className="text-gray-100 text-sm font-mono">
                        <code>{widgetCode}</code>
                      </pre>
                      
                      <button
                        onClick={copyToClipboard}
                        className="absolute top-4 right-4 bg-teal-600 hover:bg-teal-700 text-white p-2 rounded transition-colors"
                        title="Copy code"
                      >
                        {copied ? '✓' : '📋'}
                      </button>
                    </div>

                    {copied && (
                      <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-4 py-2 rounded text-sm">
                        ✓ Code copied to clipboard!
                      </div>
                    )}
                  </div>

                  {/* Configuration Options */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                    <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Configuration Options</h3>
                    
                    {error && (
                      <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-4 py-2 rounded text-sm mb-4">
                        Error: {error}
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Business Phone Number
                        </label>
                        <input
                          type="text"
                          placeholder="+1234567890"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Widget Theme
                        </label>
                        <select
                          value={theme}
                          onChange={(e) => setTheme(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white text-sm"
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Widget Position
                        </label>
                        <select 
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white text-sm"
                        >
                          <option value="bottom-right">Bottom Right</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="top-right">Top Right</option>
                          <option value="top-left">Top Left</option>
                        </select>
                      </div>

                      <button 
                        onClick={handleSaveConfiguration}
                        disabled={saving}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition disabled:bg-gray-400"
                      >
                        {saving ? '⏳ Saving...' : '💾 Save Configuration'}
                      </button>
                    </div>
                  </div>

                  {/* Documentation Link */}
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                      Need Help?
                    </h3>
                    <p className="text-blue-800 dark:text-blue-300 text-sm mb-4">
                      Check our documentation for advanced customization options, styling, and troubleshooting.
                    </p>
                    <a
                      href="#"
                      className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
                    >
                      View Documentation →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default WidgetPage;
