'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, MessageCircle, Copy, Check, Save, X, Eye,
  Palette, Image, MessageSquare, Move, Settings, Code,
  Monitor, Smartphone, ToggleLeft, ToggleRight, ExternalLink,
  ChevronRight, AlertCircle, Sparkles, Download, RefreshCcw,
  Globe, Zap, ChevronDown
} from 'lucide-react';
import { get, put, post } from '@/lib/api';
import { toast } from '@/lib/toast';

// ═══════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════
const DEFAULT_CONFIG = {
  enabled: false,
  position: 'bottom-right',
  color: { primary: '#25D366', secondary: '#1ea652', text: '#ffffff' },
  greeting: { text: 'Welcome! How can we help?', subtext: 'We typically reply within minutes', enabled: true },
  defaultMessage: 'Hi, I have a question from your website',
  behavior: { showByDefault: false, buttonLabel: 'Chat with us', delayBeforeShow: 0, allowedPages: ['*'], excludedPages: [] },
  conversation: { showHistory: true, autoCloseAfter: 0, collectName: true, collectEmail: true, collectPhoneNumber: false },
  attribution: { enabled: true, customText: '' }
};

// Interakt-style step nav
const STEPS = [
  { id: 'style', label: 'Style your Button', icon: Palette, desc: 'Button style, colors & text' },
  { id: 'message', label: 'Design Your Message', icon: Image, desc: 'Header image & chat preview' },
  { id: 'welcome', label: 'Set Welcome Message', icon: MessageSquare, desc: 'Greeting text & sub-text' },
  { id: 'position', label: 'Adjust Position', icon: Move, desc: 'Desktop & mobile placement' },
  { id: 'trigger', label: 'Configure API & Trigger', icon: Zap, desc: 'WABA number & pre-filled message' },
];

// ═══════════════════════════════════════
// MAIN WIDGET PAGE
// ═══════════════════════════════════════
export default function WidgetPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState('style');
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [headerImage, setHeaderImage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showInstall, setShowInstall] = useState(false);

  // Load config from backend
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await get('/widget/config');
      if (res?.data) {
        setConfig(prev => ({ ...prev, ...res.data }));
      } else if (res) {
        setConfig(prev => ({ ...prev, ...res }));
      }
    } catch (err) {
      console.error('Widget config load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Save config
  const handleSave = async () => {
    try {
      setSaving(true);
      await put('/widget/config', {
        enabled: config.enabled,
        position: config.position,
        color: config.color,
        greeting: config.greeting,
        defaultMessage: config.defaultMessage,
        behavior: config.behavior,
        conversation: config.conversation,
        attribution: config.attribution
      });
      toast?.success?.('Widget configuration saved!');
    } catch (err) {
      toast?.error?.(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Toggle widget enabled
  const toggleEnabled = async () => {
    try {
      if (config.enabled) {
        await post('/widget/disable');
      } else {
        await post('/widget/enable');
      }
      setConfig(prev => ({ ...prev, enabled: !prev.enabled }));
      toast?.success?.(config.enabled ? 'Widget disabled' : 'Widget enabled');
    } catch (err) {
      toast?.error?.(err.message || 'Failed to toggle');
    }
  };

  // Build embed code
  const embedCode = `<!-- WhatsApp Chat Widget -->
<script>
  (function() {
    var s = document.createElement('script');
    s.src = '${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/widget/embed.js?workspace=${config.id || 'YOUR_WORKSPACE_ID'}';
    s.async = true;
    document.head.appendChild(s);
  })();
</script>`;

  const copyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin h-8 w-8 text-[#25D366]" />
        <span className="text-sm text-muted-foreground font-medium">Loading widget settings...</span>
      </div>
    </div>
  );

  return (
    <div className="h-full">
      {/* Top Bar */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">WhatsApp Chat Widget</h1>
              <p className="text-xs text-muted-foreground">Let website visitors chat with you on WhatsApp instantly</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Enable/Disable toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
              <span className="text-xs font-medium text-muted-foreground">{config.enabled ? 'Live' : 'Disabled'}</span>
              <button onClick={toggleEnabled} className="flex items-center">
                {config.enabled
                  ? <ToggleRight className="h-6 w-6 text-[#25D366]" />
                  : <ToggleLeft className="h-6 w-6 text-gray-300" />
                }
              </button>
            </div>
            <button onClick={() => setShowInstall(true)}
              className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              <Code className="h-4 w-4" /> Install
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout: Steps + Config | Preview */}
      <div className="max-w-[1400px] mx-auto p-6">
        <div className="flex gap-6">
          {/* Left: Step Navigation + Config Panel */}
          <div className="flex-1 min-w-0">
            {/* Step Nav — Interakt style vertical steps */}
            <div className="flex gap-1 mb-6 bg-card border border-border rounded-lg p-1">
              {STEPS.map((step, idx) => (
                <button key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-md text-left transition-all ${
                    activeStep === step.id
                      ? 'bg-[#25D366]/10 border border-[#25D366]/20'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    activeStep === step.id ? 'bg-[#25D366] text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold truncate ${activeStep === step.id ? 'text-[#25D366]' : 'text-foreground'}`}>
                      {step.label}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Config Panel */}
            <div className="bg-card border border-border rounded-lg p-6">
              {activeStep === 'style' && <StyleStep config={config} setConfig={setConfig} />}
              {activeStep === 'message' && <MessageStep config={config} setConfig={setConfig} headerImage={headerImage} setHeaderImage={setHeaderImage} />}
              {activeStep === 'welcome' && <WelcomeStep config={config} setConfig={setConfig} />}
              {activeStep === 'position' && <PositionStep config={config} setConfig={setConfig} />}
              {activeStep === 'trigger' && <TriggerStep config={config} setConfig={setConfig} />}
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="w-[380px] shrink-0">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</span>
                <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                  <button onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded ${previewDevice === 'desktop' ? 'bg-card shadow-sm' : ''}`}>
                    <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded ${previewDevice === 'mobile' ? 'bg-card shadow-sm' : ''}`}>
                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <WidgetPreview config={config} device={previewDevice} headerImage={headerImage} />
            </div>
          </div>
        </div>
      </div>

      {/* Install Panel */}
      {showInstall && (
        <InstallPanel embedCode={embedCode} copied={copied} onCopy={copyCode} onClose={() => setShowInstall(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 1: STYLE YOUR BUTTON
// ═══════════════════════════════════════
function StyleStep({ config, setConfig }) {
  const presetColors = [
    { name: 'WhatsApp', color: '#25D366' },
    { name: 'Ocean', color: '#0088CC' },
    { name: 'Sunset', color: '#FF6B35' },
    { name: 'Purple', color: '#7C3AED' },
    { name: 'Rose', color: '#E11D48' },
    { name: 'Slate', color: '#475569' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Style your Button</h3>
        <p className="text-xs text-muted-foreground">Choose how the chat button looks on your website</p>
      </div>

      {/* Button Label */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Button Text</label>
        <input value={config.behavior?.buttonLabel || ''}
          onChange={(e) => setConfig(p => ({ ...p, behavior: { ...p.behavior, buttonLabel: e.target.value } }))}
          placeholder="Chat with us on WhatsApp"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
        />
      </div>

      {/* Brand Colors */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">Background Color</label>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {presetColors.map(p => (
              <button key={p.color}
                onClick={() => setConfig(prev => ({ ...prev, color: { ...prev.color, primary: p.color } }))}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  config.color?.primary === p.color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: p.color }}
                title={p.name}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input type="color" value={config.color?.primary || '#25D366'}
              onChange={(e) => setConfig(p => ({ ...p, color: { ...p.color, primary: e.target.value } }))}
              className="w-8 h-8 rounded-lg border border-border cursor-pointer"
            />
            <input type="text" value={config.color?.primary || '#25D366'}
              onChange={(e) => setConfig(p => ({ ...p, color: { ...p.color, primary: e.target.value } }))}
              className="w-24 px-2 py-1.5 bg-background border border-border rounded text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Text Color */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">Button Text Color</label>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {['#ffffff', '#000000', '#1a1a1a', '#f5f5f5'].map(c => (
              <button key={c}
                onClick={() => setConfig(p => ({ ...p, color: { ...p.color, text: c } }))}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  config.color?.text === c ? 'border-foreground scale-110' : 'border-border hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input type="color" value={config.color?.text || '#ffffff'}
              onChange={(e) => setConfig(p => ({ ...p, color: { ...p.color, text: e.target.value } }))}
              className="w-8 h-8 rounded-lg border border-border cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* WhatsApp Logo toggle */}
      <div className="flex items-center justify-between p-3 border border-border rounded-lg">
        <div>
          <div className="text-sm font-medium text-foreground">Show WhatsApp Logo</div>
          <div className="text-[10px] text-muted-foreground">Display the WhatsApp icon inside the button</div>
        </div>
        <button onClick={() => setConfig(p => ({ ...p, attribution: { ...p.attribution, enabled: !p.attribution?.enabled } }))} className="flex items-center">
          {config.attribution?.enabled !== false
            ? <ToggleRight className="h-6 w-6 text-[#25D366]" />
            : <ToggleLeft className="h-6 w-6 text-gray-300" />
          }
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 2: DESIGN YOUR MESSAGE
// ═══════════════════════════════════════
function MessageStep({ config, setConfig, headerImage, setHeaderImage }) {
  const fileRef = useRef(null);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Design Your Message</h3>
        <p className="text-xs text-muted-foreground">Add a header image to your widget chat window</p>
      </div>

      {/* Header Image */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">Header Image</label>
        <div className="flex gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-lg hover:border-[#25D366] transition-colors cursor-pointer"
          >
            <Image className="h-8 w-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Click to upload image</span>
            <span className="text-[10px] text-muted-foreground">PNG, JPG up to 2MB</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => setHeaderImage(ev.target.result);
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>
        {headerImage && (
          <div className="relative inline-block">
            <img src={headerImage} alt="Header" className="h-24 rounded-lg border border-border" />
            <button onClick={() => setHeaderImage(null)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Chat Bubble Preview Text */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Chat Bubble Greeting Preview</label>
        <input value={config.greeting?.subtext || ''}
          onChange={(e) => setConfig(p => ({ ...p, greeting: { ...p.greeting, subtext: e.target.value } }))}
          placeholder="We typically reply within minutes"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 3: SET WELCOME MESSAGE
// ═══════════════════════════════════════
function WelcomeStep({ config, setConfig }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Set a Welcome Message</h3>
        <p className="text-xs text-muted-foreground">This text appears in the chat window when visitors open the widget</p>
      </div>

      {/* Welcome Text */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Welcome Message <span className="text-red-500">*</span></label>
        <textarea value={config.greeting?.text || ''}
          onChange={(e) => setConfig(p => ({ ...p, greeting: { ...p.greeting, text: e.target.value } }))}
          rows={3} maxLength={200}
          placeholder="Welcome! How can we help you today? 👋"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] resize-none"
        />
        <div className="text-[10px] text-muted-foreground text-right">{config.greeting?.text?.length || 0}/200</div>
      </div>

      {/* Enable Greeting */}
      <div className="flex items-center justify-between p-3 border border-border rounded-lg">
        <div>
          <div className="text-sm font-medium text-foreground">Show Welcome Message</div>
          <div className="text-[10px] text-muted-foreground">Toggle the welcome bubble on/off</div>
        </div>
        <button onClick={() => setConfig(p => ({ ...p, greeting: { ...p.greeting, enabled: !p.greeting?.enabled } }))}>
          {config.greeting?.enabled !== false
            ? <ToggleRight className="h-6 w-6 text-[#25D366]" />
            : <ToggleLeft className="h-6 w-6 text-gray-300" />
          }
        </button>
      </div>

      {/* Auto-open delay */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Auto-open Delay (seconds)</label>
        <input type="number" min={0} max={60} value={config.behavior?.delayBeforeShow || 0}
          onChange={(e) => setConfig(p => ({ ...p, behavior: { ...p.behavior, delayBeforeShow: parseInt(e.target.value) || 0 } }))}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
        />
        <p className="text-[10px] text-muted-foreground">0 = widget opens on click only. Set a delay to auto-show the bubble.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 4: ADJUST POSITION
// ═══════════════════════════════════════
function PositionStep({ config, setConfig }) {
  const positions = [
    { val: 'bottom-right', label: 'Bottom Right', desc: 'Most common placement' },
    { val: 'bottom-left', label: 'Bottom Left', desc: 'Good for RTL layouts' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Adjust Position</h3>
        <p className="text-xs text-muted-foreground">Set where the widget appears on Desktop and Mobile</p>
      </div>

      {/* Desktop Position */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <Monitor className="h-3.5 w-3.5 text-muted-foreground" /> Desktop Position
        </label>
        <div className="grid grid-cols-2 gap-3">
          {positions.map(pos => (
            <label key={pos.val}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                config.position === pos.val ? 'border-[#25D366] bg-[#25D366]/5' : 'border-border hover:border-gray-300'
              }`}
            >
              <input type="radio" name="position" value={pos.val}
                checked={config.position === pos.val}
                onChange={() => setConfig(p => ({ ...p, position: pos.val }))}
                className="sr-only"
              />
              <div className="text-sm font-medium text-foreground">{pos.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{pos.desc}</div>
            </label>
          ))}
        </div>
      </div>

      {/* Visual Position Grid */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">Position Preview</label>
        <div className="relative w-full h-48 bg-muted/30 border border-border rounded-lg overflow-hidden">
          <div className="absolute inset-2 border border-dashed border-border/50 rounded-lg" />
          <div className={`absolute w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
            config.position === 'bottom-right' ? 'bottom-3 right-3' :
            config.position === 'bottom-left' ? 'bottom-3 left-3' :
            config.position === 'top-right' ? 'top-3 right-3' : 'top-3 left-3'
          }`} style={{ backgroundColor: config.color?.primary || '#25D366' }}>
            <MessageCircle className="h-5 w-5" style={{ color: config.color?.text || '#fff' }} />
          </div>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-medium">Your Website</div>
        </div>
      </div>

      {/* Hide on specific pages */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Hide on Specific Pages</label>
        <input
          value={config.behavior?.excludedPages?.join(', ') || ''}
          onChange={(e) => setConfig(p => ({
            ...p,
            behavior: { ...p.behavior, excludedPages: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
          }))}
          placeholder="/checkout, /admin/*, /privacy"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366]"
        />
        <p className="text-[10px] text-muted-foreground">Comma-separated URL patterns. Use * as wildcard.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// STEP 5: CONFIGURE API & TRIGGER
// ═══════════════════════════════════════
function TriggerStep({ config, setConfig }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Configure API & Trigger</h3>
        <p className="text-xs text-muted-foreground">Connect your WABA number and set the pre-filled message</p>
      </div>

      {/* Pre-filled Message (Trigger) */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Pre-filled Message (Trigger) <span className="text-red-500">*</span></label>
        <textarea value={config.defaultMessage || ''}
          onChange={(e) => setConfig(p => ({ ...p, defaultMessage: e.target.value }))}
          rows={3} maxLength={1024}
          placeholder="Hi, I'm interested in your product from the website"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] resize-none"
        />
        <p className="text-[10px] text-muted-foreground">
          This message auto-populates in WhatsApp when a visitor clicks the widget. It can trigger workflows, AnswerBot, or AI Intent Matching.
        </p>
      </div>

      {/* Collect User Info */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">Collect Information Before Chat</label>
        <div className="space-y-2">
          {[
            { key: 'collectName', label: 'Visitor Name' },
            { key: 'collectEmail', label: 'Email Address' },
            { key: 'collectPhoneNumber', label: 'Phone Number' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-2.5 border border-border rounded-lg">
              <span className="text-sm text-foreground">{item.label}</span>
              <button onClick={() => setConfig(p => ({
                ...p,
                conversation: { ...p.conversation, [item.key]: !p.conversation?.[item.key] }
              }))}>
                {config.conversation?.[item.key]
                  ? <ToggleRight className="h-5 w-5 text-[#25D366]" />
                  : <ToggleLeft className="h-5 w-5 text-gray-300" />
                }
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Info */}
      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Connected to Your Shared Inbox</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              Every widget conversation lands in your Shared Team Inbox, triggers automations, saves to CRM, and works with your chatbots.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// LIVE PREVIEW
// ═══════════════════════════════════════
function WidgetPreview({ config, device, headerImage }) {
  const [isOpen, setIsOpen] = useState(true);
  const isMobile = device === 'mobile';

  return (
    <div className={`bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-border overflow-hidden ${
      isMobile ? 'max-w-[320px] mx-auto' : ''
    }`} style={{ height: isMobile ? '560px' : '500px' }}>
      {/* Browser chrome */}
      <div className="bg-white dark:bg-gray-800 border-b border-border px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] text-muted-foreground">
            <Globe className="h-2.5 w-2.5" />
            yourwebsite.com
          </div>
        </div>
      </div>

      {/* Website mockup */}
      <div className="relative h-full p-4">
        {/* Fake content */}
        <div className="space-y-3 opacity-30">
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
          <div className="h-16 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/3" />
        </div>

        {/* Widget bubble / chat window */}
        <div className={`absolute ${config.position === 'bottom-left' ? 'left-3' : 'right-3'} bottom-12`}>
          {isOpen ? (
            <div className="w-[260px] rounded-xl shadow-2xl overflow-hidden border border-border/50 animate-in slide-in-from-bottom-2 duration-300">
              {/* Chat Header */}
              <div className="p-3" style={{ backgroundColor: config.color?.primary || '#25D366' }}>
                {headerImage && (
                  <img src={headerImage} alt="" className="w-full h-16 object-cover rounded-lg mb-2" />
                )}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <MessageCircle className="h-4 w-4" style={{ color: config.color?.text || '#fff' }} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: config.color?.text || '#fff' }}>Support Chat</div>
                    <div className="text-[9px] opacity-70" style={{ color: config.color?.text || '#fff' }}>
                      {config.greeting?.subtext || 'We typically reply within minutes'}
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="ml-auto opacity-60 hover:opacity-100">
                    <X className="h-3 w-3" style={{ color: config.color?.text || '#fff' }} />
                  </button>
                </div>
              </div>

              {/* Chat Body */}
              <div className="bg-[#e5ddd5] dark:bg-gray-700 p-3 min-h-[100px]">
                {config.greeting?.enabled !== false && (
                  <div className="bg-white dark:bg-gray-600 rounded-lg rounded-tl-none p-2 text-[11px] text-foreground max-w-[85%] shadow-sm">
                    {config.greeting?.text || 'Welcome! How can we help?'}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="bg-white dark:bg-gray-800 p-2 flex items-center gap-2 border-t border-border">
                <div className="flex-1 px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] text-muted-foreground">
                  {config.defaultMessage || 'Type a message...'}
                </div>
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: config.color?.primary || '#25D366' }}>
                  <ChevronRight className="h-3 w-3" style={{ color: config.color?.text || '#fff' }} />
                </div>
              </div>
            </div>
          ) : null}

          {/* Floating Button */}
          <div className={`mt-2 flex ${config.position === 'bottom-left' ? 'justify-start' : 'justify-end'}`}>
            <button onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-xs font-medium transition-transform hover:scale-105"
              style={{ backgroundColor: config.color?.primary || '#25D366', color: config.color?.text || '#fff' }}
            >
              {config.attribution?.enabled !== false && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              )}
              <span>{isOpen ? '✕' : config.behavior?.buttonLabel || 'Chat with us'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// INSTALL PANEL
// ═══════════════════════════════════════
function InstallPanel({ embedCode, copied, onCopy, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="ml-auto relative w-full max-w-lg bg-card border-l border-border shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-foreground">Install Widget</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-md transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Method 1: Script tag */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
              <Code className="h-4 w-4 text-[#25D366]" />
              Any Website (Script Tag)
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Copy this code and paste it in your website's HTML, just before the closing <code className="bg-muted px-1 py-0.5 rounded text-[10px]">&lt;/body&gt;</code> tag.
            </p>
            <div className="relative bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-emerald-400 text-xs font-mono whitespace-pre-wrap">{embedCode}</pre>
              <button onClick={onCopy}
                className="absolute top-2 right-2 p-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            {copied && (
              <div className="mt-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs">
                ✓ Code copied to clipboard!
              </div>
            )}
          </div>

          {/* Method 2: Shopify */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-[#25D366]" />
              Shopify Store
            </h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="space-y-2 text-xs text-foreground">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <span>Go to Shopify Admin → Online Store → Themes → Customize</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <span>Click App Embeds in the left toolbar</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#25D366] text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <span>Toggle "WhatsApp Widget" ON and Save</span>
                </div>
              </div>
            </div>
          </div>

          {/* Method 3: WordPress */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
              <Globe className="h-4 w-4 text-[#25D366]" />
              WordPress / Wix / Custom
            </h3>
            <p className="text-xs text-muted-foreground">
              Paste the script tag code into your site's header/footer code injection area. In WordPress, use a plugin like "Insert Headers and Footers" or paste directly in theme's <code className="bg-muted px-1 py-0.5 rounded text-[10px]">footer.php</code>.
            </p>
          </div>

          {/* Help */}
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Widget appears instantly once the code is added. Make sure the widget is <strong>Enabled</strong> (toggle in top bar) for it to show on your website.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
