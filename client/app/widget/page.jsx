"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare, Copy, Check, Save } from 'lucide-react';
// Sidebar is rendered globally by LayoutWrapper
import { getWidgetConfig, updateWidgetConfig } from '@/lib/api';

const WidgetPage = () => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
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
      await updateWidgetConfig({
        position,
        color: { primary: '#008069', secondary: '#ffffff', text: '#333333' },
        greeting: { text: 'Hello! How can we help?', enabled: true },
        defaultMessage: 'Hi, I have a question...',
      });
      alert('Widget configuration saved successfully!');
    } catch (err) {
      alert('Error saving configuration: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/auth/login'); return; }
    setIsAuthenticated(true);

    const fetchWidgetConfig = async () => {
      try {
        const response = await getWidgetConfig();
        setWidgetConfig(response.data);
        if (response.data?.position) setPosition(response.data.position);
        if (response.data?.color?.primary) setPhoneNumber(response.data.phoneNumber || '');
      } catch (err) {
        console.error('Error fetching widget config:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchWidgetConfig();
  }, [router]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!isAuthenticated) return null;

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Chat Widget</h1>
        </div>
        <p className="text-muted-foreground">Embed a WhatsApp chat widget on your website to enable customer communication.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Widget Preview */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border/50 rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Widget Preview</h3>
            <div className="bg-card border-4 border-border rounded-xl overflow-hidden shadow-premium">
              <div className="bg-gradient-to-r from-primary/90 to-primary text-primary-foreground p-4">
                <h4 className="font-semibold text-sm">Support Chat</h4>
                <p className="text-xs opacity-80">We typically respond in minutes</p>
              </div>
              <div className="h-52 bg-muted p-4 flex flex-col gap-2">
                <div className="bg-primary/10 rounded-xl p-3 text-sm text-foreground max-w-[80%]">👋 Hi there! How can we help?</div>
                <div className="self-end bg-blue-500/10 rounded-xl p-3 text-sm text-foreground max-w-[80%]">I have a question about pricing</div>
              </div>
              <div className="bg-muted/50 p-3 border-t border-border">
                <input type="text" placeholder="Type a message..." disabled
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Installation */}
          <div className="bg-card border border-border/50 rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Copy className="h-4 w-4 text-muted-foreground" /> Installation Code
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add this code to your website&apos;s HTML, just before the closing <code className="bg-muted px-1.5 py-0.5 rounded text-xs">&lt;/body&gt;</code> tag:
            </p>
            <div className="relative bg-slate-900 rounded-xl p-4 overflow-x-auto mb-4">
              <pre className="text-emerald-400 text-sm font-mono"><code>{widgetCode}</code></pre>
              <button onClick={copyToClipboard}
                className="absolute top-3 right-3 p-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {copied && (
              <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl text-sm">
                ✓ Code copied to clipboard!
              </div>
            )}
          </div>

          {/* Config Options */}
          <div className="bg-card border border-border/50 rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Configuration Options</h3>
            {error && (
              <div className="bg-destructive/5 text-destructive border border-destructive/20 px-4 py-2 rounded-xl text-sm mb-4">Error: {error}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Business Phone Number</label>
                <input type="text" placeholder="+1234567890" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="input-premium" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Widget Theme</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value)} className="input-premium">
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Widget Position</label>
                <select value={position} onChange={(e) => setPosition(e.target.value)} className="input-premium">
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>
              <button onClick={handleSaveConfiguration} disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>

          {/* Help */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
            <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Need Help?</h3>
            <p className="text-blue-600 dark:text-blue-400 text-sm mb-3">
              Check our documentation for advanced customization options, styling, and troubleshooting.
            </p>
            <a href="#" className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium text-sm transition-colors">
              View Documentation →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetPage;
