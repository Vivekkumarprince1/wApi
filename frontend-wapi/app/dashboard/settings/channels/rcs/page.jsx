'use client';

import React, { useState, useEffect } from 'react';
import { 
  Rocket, Server, Key, ShieldCheck, 
  ExternalLink, Info, CheckCircle2, 
  AlertCircle, Loader2, Save, ArrowLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api';
import { toast } from '@/lib/toast';

export default function RCSConfigurationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'test'

  const [config, setConfig] = useState({
    provider: 'JIO',
    credentials: {
      apiKey: '',
      apiSecret: '',
      senderId: '',
      endpoint: 'https://jio-rcs.central.api.com/v1'
    },
    status: 'PENDING'
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await get('/settings/channels/rcs');
      if (res.success && res.data) {
        setConfig(res.data);
      }
    } catch (err) {
      console.error('Failed to load RCS config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await post('/settings/channels/rcs', config);
      if (res.success) {
        toast?.success?.('RCS credentials saved successfully');
        loadConfig();
      }
    } catch (err) {
      toast?.error?.(err.message || 'Failed to save RCS config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading RCS configuration...</p>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-foreground">RCS (Rich Communication Services)</h1>
          <p className="text-sm text-muted-foreground">Configure fallback channel for WhatsApp campaigns.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <div className={`p-5 rounded-2xl border flex items-center justify-between ${
            config.status === 'ACTIVE' 
              ? 'bg-emerald-500/5 border-emerald-500/20' 
              : 'bg-amber-500/5 border-amber-500/20'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                config.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'
              }`}>
                {config.status === 'ACTIVE' ? <CheckCircle2 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Connection Status</p>
                <p className={`font-bold ${config.status === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {config.status === 'ACTIVE' ? 'Connected & Active' : 'Pending Configuration'}
                </p>
              </div>
            </div>
            {config.status === 'ACTIVE' && (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">LIVE</span>
            )}
          </div>

          {/* Configuration Form */}
          <div className="bg-card border border-border rounded-2xl shadow-premium overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" /> Channel Credentials
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Provider</label>
                  <select 
                    value={config.provider}
                    onChange={(e) => setConfig(c => ({ ...c, provider: e.target.value }))}
                    className="input-premium text-sm w-full"
                  >
                    <option value="JIO">Jio (Recommended India)</option>
                    <option value="GUPSHUP">Gupshup RCS</option>
                    <option value="META_RCS">Meta RCS (Beta)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">RCS Agent ID / Sender ID</label>
                  <input 
                    type="text"
                    value={config.credentials.senderId}
                    onChange={(e) => setConfig(c => ({ ...c, credentials: { ...c.credentials, senderId: e.target.value } }))}
                    placeholder="e.g. MyStoreRCS"
                    className="input-premium text-sm w-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">API Endpoint URL</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={config.credentials.endpoint}
                    onChange={(e) => setConfig(c => ({ ...c, credentials: { ...c.credentials, endpoint: e.target.value } }))}
                    className="input-premium text-sm w-full"
                  />
                  <div className="p-2.5 bg-muted rounded-xl">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-between">
                    API Key
                    <span className="text-[10px] lowercase font-normal italic">Requires DLT registration</span>
                  </label>
                  <input 
                    type="password"
                    value={config.credentials.apiKey}
                    onChange={(e) => setConfig(c => ({ ...c, credentials: { ...c.credentials, apiKey: e.target.value } }))}
                    placeholder="*****************************"
                    className="input-premium text-sm w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">API Secret</label>
                  <input 
                    type="password"
                    value={config.credentials.apiSecret}
                    onChange={(e) => setConfig(c => ({ ...c, credentials: { ...c.credentials, apiSecret: e.target.value } }))}
                    placeholder="*****************************"
                    className="input-premium text-sm w-full"
                  />
                </div>
              </div>

              <div className="pt-4">
                 <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving...' : 'Save RCS Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info / Sidebar */}
        <div className="space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3">
              <Rocket className="h-4 w-4" /> Why enable RCS?
            </h4>
            <ul className="space-y-3">
              {[
                'Fallback delivery when WhatsApp is offline.',
                'Brand trust with verified "check" marks.',
                'Rich cards, carousels, and quick replies.',
                'Lower cost for generic fallback alerts.'
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
              <Info className="h-4 w-4" /> Requirements
            </h4>
            <p className="text-xs text-foreground/80 leading-relaxed mb-4">
              To use RCS fallback in India, you must have an active DLT registration and a Jio/Carrier partnership. 
            </p>
            <a href="#" className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1">
              Read DLT Setup Guide <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <button className="w-full p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/50 transition-all flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground group">
            <ExternalLink className="h-4 w-4 group-hover:text-primary" />
            Developer Documentation
          </button>
        </div>
      </div>
    </div>
  );
}
