'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Key, ShieldCheck, 
  Info, CheckCircle2, 
  Loader2, Save, ArrowLeft,
  Mail
} from 'lucide-react';
import FlashLoader from '@/components/ui/FlashLoader';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api';
import { toast } from '@/lib/toast';

export default function SMSConfigurationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState({
    provider: 'GUPSHUP',
    credentials: {
      apiKey: '',
      senderId: '',
      entityId: '',
      templateId: '',
      endpoint: 'https://api.gupshup.io/sm/api/v1/msg'
    },
    status: 'PENDING'
  });
  const [isManaged, setIsManaged] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await get('/settings/channels/sms');
      if (res.success && res.data) {
        setIsManaged(res.isManaged || false);
        setConfig(prev => ({
          ...prev,
          ...res.data,
          credentials: {
            ...prev.credentials,
            ...(res.data.credentials || {})
          }
        }));
      }
    } catch (err) {
      console.error('Failed to load SMS config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Only require API key if not managed
    if (!isManaged && !config.credentials.apiKey) {
      toast?.error?.('Please fill in your Gupshup API Key');
      return;
    }

    if (!config.credentials.senderId) {
      toast?.error?.('Please fill in your SMS Sender ID (Header)');
      return;
    }

    try {
      setSaving(true);
      const res = await post('/settings/channels/sms', config);
      if (res.success) {
        toast?.success?.('SMS settings saved successfully');
        loadConfig();
      }
    } catch (err) {
      toast?.error?.(err.message || 'Failed to save SMS settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FlashLoader />;

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.push('/dashboard/settings/channels')}
          className="p-2 hover:bg-muted rounded-xl transition-all"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">SMS Gateway Configuration</h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              (isManaged || config.credentials.apiKey) && config.credentials.senderId
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {(isManaged || config.credentials.apiKey) && config.credentials.senderId ? 'Active' : 'Setup Required'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Configure your SMS Sender ID and DLT credentials.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Card */}
          <div className="p-5 rounded-2xl border bg-orange-500/5 border-orange-500/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 text-orange-600 flex items-center justify-center">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Primary Gateway</p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-orange-600">Gupshup SMS (Enterprise)</p>
                  {isManaged && (
                    <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold uppercase">Managed</span>
                  )}
                </div>
              </div>
            </div>
            {isManaged && (
              <div className="flex items-center gap-2 text-orange-600/60 font-medium text-xs">
                <ShieldCheck className="h-4 w-4" />
                Trusted Partner Connectivity
              </div>
            )}
          </div>

          {/* Configuration Form */}
          <div className="bg-card border border-border rounded-2xl shadow-premium overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Credentials & DLT Compliance
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Sender ID (Header)</label>
                  <input 
                    type="text"
                    maxLength={6}
                    value={config.credentials.senderId}
                    onChange={(e) => setConfig(c => ({ ...c, credentials: { ...c.credentials, senderId: e.target.value.toUpperCase() } }))}
                    placeholder="e.g. WAPIIN"
                    className="input-premium text-sm w-full"
                  />
                  <p className="text-[10px] text-muted-foreground italic">Exactly 6 characters for India.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Entity ID (PE ID)</label>
                  <input 
                    type="text"
                    value={config.credentials.entityId}
                    onChange={(e) => setConfig(c => ({ ...c, credentials: { ...c.credentials, entityId: e.target.value } }))}
                    placeholder="1201XXXXXXXXXXXX"
                    className="input-premium text-sm w-full"
                  />
                </div>
              </div>

              {!isManaged ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Gupshup API Key</label>
                  <input 
                    type="password"
                    value={config.credentials.apiKey}
                    onChange={(e) => setConfig(c => ({ ...c, credentials: { ...c.credentials, apiKey: e.target.value } }))}
                    placeholder="*****************************"
                    className="input-premium text-sm w-full"
                  />
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted/50 border border-dashed border-border flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-foreground">API Credentials Managed</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                      Your Gupshup API connectivity is automatically handled by the platform using your onboarded app credentials. No manual API Key is required.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border/50">
                <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-foreground">Fallback Template Configuration</p>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">DLT Template ID</label>
                    <input 
                      type="text"
                      value={config.credentials.templateId}
                      onChange={(e) => setConfig(c => ({ ...c, credentials: { ...c.credentials, templateId: e.target.value } }))}
                      placeholder="e.g. 1207XXXXXXXXXXXX"
                      className="input-premium text-sm w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                 <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving...' : 'Save SMS Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info / Sidebar */}
        <div className="space-y-6">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
            <h4 className="font-bold text-blue-600 flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4" /> DLT Compliance
            </h4>
            <p className="text-xs text-foreground/80 leading-relaxed mb-4">
              In India, SMS delivery requires DLT registration. Ensure your Header and Templates are approved on portals like Jio, Vil, or BSNL.
            </p>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
            <h4 className="font-bold text-amber-600 flex items-center gap-2 mb-3">
              <Info className="h-4 w-4" /> Usage Tips
            </h4>
            <ul className="space-y-2">
              <li className="text-[10px] text-muted-foreground">• Use SMS as the final fallback.</li>
              <li className="text-[10px] text-muted-foreground">• Keep messages under 160 characters.</li>
              <li className="text-[10px] text-muted-foreground">• Ensure Entity ID matches Header Owner.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
