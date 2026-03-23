'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, Bug, Save, Settings, User, Code, Phone, Users, Shield, Tag, Reply, Calendar, MessageSquare, ShoppingBag } from 'lucide-react';
import { getWABASettings, updateWABASettings, testWABAConnection, initializeWABAFromEnv, debugWABACredentials } from '@/lib/api';
import PageLoader from '@/components/ui/PageLoader';

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

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getWABASettings();
      setCurrentSettings(data);
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
      setSettings(prev => ({ ...prev, whatsappAccessToken: '' }));
    } catch (error) {
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
      setMessage({ type: data.success ? 'success' : 'error', text: data.success ? `Connection successful! Phone: ${data.phoneInfo?.display_phone_number || 'N/A'}` : (data.message || 'Test failed') });
    } catch (error) {
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
      setMessage({ type: 'success', text: `✅ WABA credentials loaded! WABA ID: ${data.workspace.wabaId}` });
      setTimeout(() => loadSettings(), 500);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to initialize' });
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
      setMessage({ type: data.success ? 'success' : 'error', text: data.success ? 'Debug info retrieved!' : (data.message || 'Debug failed') });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Debug failed' });
    } finally {
      setDebugging(false);
    }
  };

  const settingsLinks = [
    { href: '/dashboard/settings/whatsapp-profile', label: 'WhatsApp Profile', icon: User, color: 'from-violet-500 to-violet-600' },
    { href: '/dashboard/settings/developer', label: 'Developer', icon: Code, color: 'from-blue-500 to-blue-600' },
    { href: '/dashboard/settings/contacts', label: 'Contacts', icon: Phone, color: 'from-amber-500 to-amber-600' },
    { href: '/dashboard/settings/agents', label: 'Agents', icon: Users, color: 'from-orange-500 to-orange-600' },
    { href: '/dashboard/settings/roles', label: 'Roles', icon: Shield, color: 'from-emerald-500 to-emerald-600' },
    { href: '/dashboard/settings/teams', label: 'Teams', icon: Users, color: 'from-pink-500 to-pink-600' },
    { href: '/dashboard/settings/tags', label: 'Tags', icon: Tag, color: 'from-purple-500 to-purple-600' },
    { href: '/dashboard/settings/quick-replies', label: 'Quick Replies', icon: Reply, color: 'from-cyan-500 to-cyan-600' },
    { href: '/dashboard/settings/member-profile', label: 'Member Profile', icon: User, color: 'from-teal-500 to-teal-600' },
    { href: '/dashboard/settings/events', label: 'Events', icon: Calendar, color: 'from-indigo-500 to-indigo-600' },
    { href: '/dashboard/settings/channels', label: 'Channels', icon: MessageSquare, color: 'from-sky-500 to-sky-600' },
    { href: '/dashboard/settings/commerce', label: 'Commerce', icon: ShoppingBag, color: 'from-rose-500 to-rose-600' },
  ];

  if (loading) return <PageLoader message="Loading settings..." />;

  const inputClass = "input-premium";

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your workspace and WhatsApp API</p>
        </div>
      </div>

      {/* Quick Navigation — Icon Cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {settingsLinks.map(link => (
            <a key={link.href} href={link.href}
              className="group flex flex-col items-center gap-2 p-3 bg-card border border-border/50 rounded-xl hover:shadow-premium hover:border-primary/20 transition-all text-center">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${link.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <link.icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight">{link.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Connection Status */}
      {currentSettings.connectedAt && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mr-3" />
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-300">Connected</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Connected on {new Date(currentSettings.connectedAt).toLocaleString()}
              </p>
              {currentSettings.maskedToken && (
                <p className="text-xs text-emerald-500 dark:text-emerald-500 mt-1">
                  Token: {currentSettings.maskedToken}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message Alert */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-xl border ${message.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
          : 'bg-destructive/5 border-destructive/20 text-destructive'
          }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-3 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-3 shrink-0" />
            )}
            <p>{message.text}</p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-card border border-border/50 shadow-premium rounded-xl p-6">
        <h2 className="text-xl font-semibold text-foreground mb-6">WhatsApp Business API Configuration</h2>

        <div className="space-y-6">
          {[
            { label: 'Access Token *', key: 'whatsappAccessToken', type: 'password', placeholder: currentSettings.hasToken ? "Enter new token to update" : "Enter access token", help: 'Get this from Meta Developer Portal → Your App → WhatsApp → API Setup' },
            { label: 'Phone Number ID *', key: 'whatsappPhoneNumberId', type: 'text', placeholder: '123456789012345', help: 'From Meta Developer Portal → WhatsApp → API Setup → Phone Number ID' },
            { label: 'Webhook Verify Token', key: 'whatsappVerifyToken', type: 'text', placeholder: 'my-verify-token-123', help: 'Must match the verify token configured in Meta webhook settings' },
            { label: 'WhatsApp Business Account ID (WABA ID)', key: 'wabaId', type: 'text', placeholder: '123456789012345', help: 'Required for template management. Find in Meta Business Settings' },
            { label: 'Business Account ID (Optional)', key: 'businessAccountId', type: 'text', placeholder: '123456789012345' },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-foreground mb-2">{field.label}</label>
              <input
                type={field.type}
                value={settings[field.key]}
                onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className={inputClass}
              />
              {field.help && <p className="text-xs text-muted-foreground mt-1">{field.help}</p>}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8 flex-wrap">
          {!currentSettings.hasToken && (
            <button onClick={handleInitializeFromEnv} disabled={initializing}
              className="flex items-center px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
              {initializing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {initializing ? 'Initializing...' : 'Load from Environment'}
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !settings.whatsappPhoneNumberId}
            className="btn-primary flex items-center text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {currentSettings.hasToken && (
            <button onClick={handleTest} disabled={testing}
              className="flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          )}
          {currentSettings.hasToken && (
            <button onClick={handleDebug} disabled={debugging}
              className="flex items-center px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
              {debugging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bug className="h-4 w-4 mr-2" />}
              {debugging ? 'Debugging...' : 'Debug WABA'}
            </button>
          )}
        </div>

        {/* Debug Info Panel */}
        {debugInfo && (
          <div className="mt-6 p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-sm overflow-auto max-h-96">
            <h3 className="text-white font-bold mb-2">🔍 WABA Debug Information</h3>
            {debugInfo.phoneInfo && (
              <div className="mb-4">
                <p className="text-amber-400 font-bold">📱 Phone Number Info:</p>
                <p>Phone: {debugInfo.phoneInfo.display_phone_number || 'N/A'}</p>
                <p>Verified Name: {debugInfo.phoneInfo.verified_name || 'N/A'}</p>
                <p>Quality Rating: {debugInfo.phoneInfo.quality_rating || 'N/A'}</p>
                <p>Status: {debugInfo.phoneInfo.code_verification_status || 'N/A'}</p>
              </div>
            )}
            {debugInfo.wabaDiscovery && (
              <div className="mb-4">
                <p className="text-amber-400 font-bold">🏢 WABA Discovery:</p>
                {debugInfo.wabaDiscovery.data?.length > 0 ? (
                  debugInfo.wabaDiscovery.data.map((waba, i) => (
                    <div key={i} className="ml-2 mt-1">
                      <p className="text-emerald-300 font-bold">✅ Found WABA ID: {waba.id}</p>
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
                <p className="text-amber-400 font-bold">⚙️ Currently Configured:</p>
                <p>Phone Number ID: {debugInfo.configuredValues.phoneNumberId || 'Not set'}</p>
                <p>WABA ID: {debugInfo.configuredValues.wabaId || 'Not set'}</p>
              </div>
            )}
            {debugInfo.recommendation && (
              <div className="mt-4 p-2 bg-amber-900/50 rounded-lg">
                <p className="text-amber-300 font-bold">💡 Recommendation:</p>
                <p className="text-amber-200">{debugInfo.recommendation}</p>
              </div>
            )}
            {debugInfo.error && (
              <div className="mt-4 p-2 bg-red-900/50 rounded-lg">
                <p className="text-red-300 font-bold">❌ Error:</p>
                <p className="text-red-200">{JSON.stringify(debugInfo.error, null, 2)}</p>
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <h3 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Need Help?</h3>
          <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
            <li>• Get credentials from <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline">Meta Developer Portal</a></li>
            <li>• Configure webhook at: <code className="bg-blue-500/10 px-1 rounded">https://your-domain.com/api/v1/webhook/meta</code></li>
            <li>• Ensure your server is publicly accessible for webhooks</li>
            <li>• Subscribe to webhook fields: messages, message_template_status_update</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
