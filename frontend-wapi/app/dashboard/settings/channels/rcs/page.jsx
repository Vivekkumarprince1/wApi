'use client';

import React, { useState, useEffect } from 'react';
import { 
  Rocket, Server, Key, ShieldCheck, 
  ExternalLink, Info, CheckCircle2, 
  AlertCircle, Loader2, Save, ArrowLeft,
  Smartphone
} from 'lucide-react';
import FlashLoader from '@/components/ui/FlashLoader';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api';
import { toast } from '@/lib/toast';

export default function RCSConfigurationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState({
    provider: 'GUPSHUP',
    credentials: {
      apiKey: '',
      senderId: '',
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
      const res = await get('/settings/channels/rcs');
      if (res.success && res.data) {
        setIsManaged(res.isManaged || false);
        // Merge with defaults while preserving existing credentials
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
      console.error('Failed to load RCS config:', err);
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
      toast?.error?.('Please fill in your RCS Business Name (Sender ID)');
      return;
    }

    try {
      setSaving(true);
      const res = await post('/settings/channels/rcs', config);
      if (res.success) {
        toast?.success?.('RCS details saved. Identity verified.');
        loadConfig();
      }
    } catch (err) {
      toast?.error?.(err.message || 'Failed to save RCS details');
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
            <h1 className="text-2xl font-bold text-foreground">RCS Brand Identity</h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              (isManaged || config.credentials.apiKey) && config.credentials.senderId
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {(isManaged || config.credentials.apiKey) && config.credentials.senderId ? 'Active' : 'Setup Required'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Configure how your brand appears on RCS fallback messages.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gupshup Branding Card */}
          <div className="p-5 rounded-2xl border bg-blue-500/5 border-blue-500/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-600 flex items-center justify-center">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Primary Gateway</p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-blue-600">Gupshup Single Messaging API</p>
                  {isManaged && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">Managed</span>
                  )}
                </div>
              </div>
            </div>
            {isManaged && (
              <div className="flex items-center gap-2 text-blue-600/60 font-medium text-xs">
                <ShieldCheck className="h-4 w-4" />
                Trusted Partner Connectivity
              </div>
            )}
          </div>

          {/* Configuration Form */}
          <div className="bg-card border border-border rounded-2xl shadow-premium overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" /> Delivery Configuration
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">RCS Business Name (Sender ID)</label>
                <input 
                  type="text"
                  value={config.credentials.senderId}
                  onChange={(e) => setConfig(c => ({ ...c, credentials: { ...c.credentials, senderId: e.target.value } }))}
                  placeholder="e.g. MyBrandOfficial"
                  className="input-premium text-sm w-full"
                />
                <p className="text-[10px] text-muted-foreground italic">This is the name customers will see on their phones.</p>
              </div>

              {!isManaged ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Gupshup API Key</label>
                  <input 
                    type="password"
                    value={config.credentials.apiKey}
                    onChange={(e) => setConfig(c => ({ ...c, credentials: { ...c.credentials, apiKey: e.target.value } }))}
                    placeholder="Paste your Gupshup API Key here"
                    className="input-premium text-sm w-full"
                  />
                  <p className="text-[10px] text-amber-500/80 italic flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Required for independent connectivity.
                  </p>
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

              <div className="pt-4">
                 <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving...' : 'Save RCS Brand Identity'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info / Sidebar */}
        <div className="space-y-6">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
            <h4 className="font-bold text-emerald-600 flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4" /> Why enable RCS?
            </h4>
            <ul className="space-y-3 font-medium">
              {[
                'Fallback when WhatsApp delivery fails.',
                'Verified brand name on customer screen.',
                'Interactive buttons and carousels.',
                'High conversion rich messaging.'
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80 leading-relaxed">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
            <h4 className="font-bold text-amber-600 flex items-center gap-2 mb-3">
              <Info className="h-4 w-4" /> Setup Notice
            </h4>
            <p className="text-xs text-foreground/80 leading-relaxed mb-4">
              RCS agents require a 7-10 day setup process. Ensure your brand is whitelisted on Gupshup before activating fallback.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
