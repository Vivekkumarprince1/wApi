'use client';

import { useState, useEffect } from 'react';
import { FaSave, FaCheckCircle, FaExclamationCircle, FaSpinner, FaBug } from 'react-icons/fa';
import { getWABASettings, updateWABASettings, testWABAConnection, initializeWABAFromEnv, debugWABACredentials } from '@/lib/api';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [debugging, setDebugging] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [settings, setSettings] = useState({
    whatsappAccessToken: '',
    whatsappPhoneNumberId: '',
    whatsappVerifyToken: '',
    wabaId: '',
    businessAccountId: ''
  });
  
  const [currentSettings, setCurrentSettings] = useState({
    hasToken: false,
    maskedToken: null,
    connectedAt: null
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const data = await getWABASettings();
      setCurrentSettings(data);
      
      // Pre-fill non-sensitive fields
      setSettings(prev => ({
        ...prev,
        whatsappPhoneNumberId: data.whatsappPhoneNumberId || '',
        whatsappVerifyToken: data.whatsappVerifyToken || '',
        wabaId: data.wabaId || '',
        businessAccountId: data.businessAccountId || ''
      }));
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      
      const data = await updateWABASettings(settings);
      setCurrentSettings(data.settings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Clear access token field after saving for security
      setSettings(prev => ({ ...prev, whatsappAccessToken: '' }));
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setMessage({ type: '', text: '' });
      
      const data = await testWABAConnection();
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `Connection successful! Phone: ${data.phoneInfo?.display_phone_number || 'N/A'}` 
        });
      } else {
        setMessage({ type: 'error', text: data.message || 'Connection test failed' });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setMessage({ type: 'error', text: error.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleInitializeFromEnv = async () => {
    try {
      setInitializing(true);
      setMessage({ type: '', text: '' });
      
      const data = await initializeWABAFromEnv();
      setMessage({ 
        type: 'success', 
        text: `✅ WABA credentials loaded from environment! WABA ID: ${data.workspace.wabaId}` 
      });
      
      // Reload settings to show updated values
      setTimeout(() => loadSettings(), 500);
    } catch (error) {
      console.error('Error initializing from env:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to initialize WABA from environment' });
    } finally {
      setInitializing(false);
    }
  };

  const handleDebug = async () => {
    try {
      setDebugging(true);
      setMessage({ type: '', text: '' });
      setDebugInfo(null);
      
      const data = await debugWABACredentials();
      setDebugInfo(data);
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `Debug info retrieved! Check the panel below for WABA details.` 
        });
      } else {
        setMessage({ type: 'error', text: data.message || 'Debug failed' });
      }
    } catch (error) {
      console.error('Error debugging WABA:', error);
      setMessage({ type: 'error', text: error.message || 'Debug failed' });
    } finally {
      setDebugging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FaSpinner className="animate-spin text-4xl text-green-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Quick Navigation */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Other Settings</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: '/dashboard/settings/whatsapp-profile', label: 'WhatsApp Profile' },
            { href: '/dashboard/settings/developer', label: 'Developer' },
            { href: '/dashboard/settings/agents', label: 'Agents' },
            { href: '/dashboard/settings/roles', label: 'Roles' },
            { href: '/dashboard/settings/teams', label: 'Teams' },
            { href: '/dashboard/settings/tags', label: 'Tags' },
            { href: '/dashboard/settings/quick-replies', label: 'Quick Replies' },
            { href: '/dashboard/settings/member-profile', label: 'Member Profile' },
            { href: '/dashboard/settings/events', label: 'Events' },
            { href: '/dashboard/settings/channels', label: 'Channels' },
            { href: '/dashboard/settings/contacts', label: 'Contacts' },
          ].map(link => (
            <a key={link.href} href={link.href} className="block p-3 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Configure your WhatsApp Business API credentials</p>
      </div>

      {/* Connection Status */}
      {currentSettings.connectedAt && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <FaCheckCircle className="text-green-600 mr-3" />
            <div>
              <p className="font-medium text-green-900">Connected</p>
              <p className="text-sm text-green-700">
                Connected on {new Date(currentSettings.connectedAt).toLocaleString()}
              </p>
              {currentSettings.maskedToken && (
                <p className="text-xs text-green-600 mt-1">
                  Token: {currentSettings.maskedToken}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message Alert */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-900' 
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <FaCheckCircle className="mr-3" />
            ) : (
              <FaExclamationCircle className="mr-3" />
            )}
            <p>{message.text}</p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-6">WhatsApp Business API Configuration</h2>
        
        <div className="space-y-6">
          {/* Access Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Token *
            </label>
            <input
              type="password"
              value={settings.whatsappAccessToken}
              onChange={(e) => setSettings({ ...settings, whatsappAccessToken: e.target.value })}
              placeholder={currentSettings.hasToken ? "Enter new token to update" : "Enter access token"}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get this from Meta Developer Portal → Your App → WhatsApp → API Setup
            </p>
          </div>

          {/* Phone Number ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number ID *
            </label>
            <input
              type="text"
              value={settings.whatsappPhoneNumberId}
              onChange={(e) => setSettings({ ...settings, whatsappPhoneNumberId: e.target.value })}
              placeholder="123456789012345"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              From Meta Developer Portal → WhatsApp → API Setup → Phone Number ID
            </p>
          </div>

          {/* Verify Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook Verify Token
            </label>
            <input
              type="text"
              value={settings.whatsappVerifyToken}
              onChange={(e) => setSettings({ ...settings, whatsappVerifyToken: e.target.value })}
              placeholder="my-verify-token-123"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must match the verify token configured in Meta webhook settings
            </p>
          </div>

          {/* WABA ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WhatsApp Business Account ID (WABA ID)
            </label>
            <input
              type="text"
              value={settings.wabaId}
              onChange={(e) => setSettings({ ...settings, wabaId: e.target.value })}
              placeholder="123456789012345"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Required for template management. Find in Meta Business Settings
            </p>
          </div>

          {/* Business Account ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Account ID (Optional)
            </label>
            <input
              type="text"
              value={settings.businessAccountId}
              onChange={(e) => setSettings({ ...settings, businessAccountId: e.target.value })}
              placeholder="123456789012345"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-8 flex-wrap">
          {!currentSettings.hasToken && (
            <button
              onClick={handleInitializeFromEnv}
              disabled={initializing}
              className="flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              title="Load WABA credentials from environment variables (.env)"
            >
              {initializing ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  Initializing...
                </>
              ) : (
                <>
                  <FaCheckCircle className="mr-2" />
                  Load from Environment
                </>
              )}
            </button>
          )}
          
          <button
            onClick={handleSave}
            disabled={saving || !settings.whatsappPhoneNumberId}
            className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <FaSave className="mr-2" />
                Save Settings
              </>
            )}
          </button>

          {currentSettings.hasToken && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                <>
                  <FaCheckCircle className="mr-2" />
                  Test Connection
                </>
              )}
            </button>
          )}
          
          {currentSettings.hasToken && (
            <button
              onClick={handleDebug}
              disabled={debugging}
              className="flex items-center px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              title="Debug WABA credentials and discover correct IDs"
            >
              {debugging ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  Debugging...
                </>
              ) : (
                <>
                  <FaBug className="mr-2" />
                  Debug WABA
                </>
              )}
            </button>
          )}
        </div>

        {/* Debug Info Panel */}
        {debugInfo && (
          <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-sm overflow-auto max-h-96">
            <h3 className="text-white font-bold mb-2">🔍 WABA Debug Information</h3>
            
            {debugInfo.phoneInfo && (
              <div className="mb-4">
                <p className="text-yellow-400 font-bold">📱 Phone Number Info:</p>
                <p>Phone: {debugInfo.phoneInfo.display_phone_number || 'N/A'}</p>
                <p>Verified Name: {debugInfo.phoneInfo.verified_name || 'N/A'}</p>
                <p>Quality Rating: {debugInfo.phoneInfo.quality_rating || 'N/A'}</p>
                <p>Status: {debugInfo.phoneInfo.code_verification_status || 'N/A'}</p>
              </div>
            )}
            
            {debugInfo.wabaDiscovery && (
              <div className="mb-4">
                <p className="text-yellow-400 font-bold">🏢 WABA Discovery:</p>
                {debugInfo.wabaDiscovery.data?.length > 0 ? (
                  debugInfo.wabaDiscovery.data.map((waba, i) => (
                    <div key={i} className="ml-2 mt-1">
                      <p className="text-green-300 font-bold">✅ Found WABA ID: {waba.id}</p>
                      <p>Name: {waba.name || 'N/A'}</p>
                      <p>Currency: {waba.currency || 'N/A'}</p>
                      <p>Timezone: {waba.timezone_id || 'N/A'}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-red-400">❌ No WABA found via API. Check your access token permissions.</p>
                )}
              </div>
            )}
            
            {debugInfo.configuredValues && (
              <div className="mb-4">
                <p className="text-yellow-400 font-bold">⚙️ Currently Configured:</p>
                <p>Phone Number ID: {debugInfo.configuredValues.phoneNumberId || 'Not set'}</p>
                <p>WABA ID: {debugInfo.configuredValues.wabaId || 'Not set'}</p>
              </div>
            )}
            
            {debugInfo.recommendation && (
              <div className="mt-4 p-2 bg-yellow-900 rounded">
                <p className="text-yellow-300 font-bold">💡 Recommendation:</p>
                <p className="text-yellow-200">{debugInfo.recommendation}</p>
              </div>
            )}
            
            {debugInfo.error && (
              <div className="mt-4 p-2 bg-red-900 rounded">
                <p className="text-red-300 font-bold">❌ Error:</p>
                <p className="text-red-200">{JSON.stringify(debugInfo.error, null, 2)}</p>
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Need Help?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Get credentials from <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline">Meta Developer Portal</a></li>
            <li>• Configure webhook at: <code className="bg-blue-100 px-1 rounded">https://your-domain.com/api/v1/webhook/meta</code></li>
            <li>• Ensure your server is publicly accessible for webhooks</li>
            <li>• Subscribe to webhook fields: messages, message_template_status_update</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
