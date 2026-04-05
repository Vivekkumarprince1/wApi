'use client';

import { useState, useEffect } from 'react';
import { 
  Bot, 
  Settings, 
  ToggleRight, 
  ToggleLeft, 
  ShoppingCart, 
  CreditCard, 
  MessageSquare, 
  Zap, 
  ShieldCheck, 
  BarChart3, 
  ChevronRight, 
  Play, 
  Copy,
  Truck,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCcw,
  TrendingUp
} from 'lucide-react';
import { get, put } from '@/lib/api';
import { toast } from '@/lib/toast';

const BOT_TRIGGERS = [
  { id: 'welcome', label: 'Welcome Trigger', icon: MessageSquare, description: 'Sent when customer first types "Hi" or "Menu".', templateKey: 'welcome' },
  { id: 'catalog', label: 'Catalog Inquiry', icon: Package, description: 'Sent when customer asks for products or categories.', templateKey: 'catalog' },
  { id: 'order', label: 'Order Status', icon: Truck, description: 'Automatic updates on shipping and delivery.', templateKey: 'orderStatus' },
  { id: 'recovery', label: 'Abandoned Cart', icon: AlertCircle, description: 'Re-engage customers who left items in their cart.', templateKey: 'cartRecovery' }
];

const DEFAULT_TEMPLATES = {
  welcome: 'Welcome to our store! 🎉\nReply with:\n1️⃣ Browse Catalog\n2️⃣ Track Order\n3️⃣ Talk to Agent',
  catalog: 'Here are our latest products! 🛍️\nBrowse our full collection here: [CatalogLink]',
  orderStatus: 'Your order #[OrderID] is now [Status]! 📦\nTrack here: [TrackingLink]',
  cartRecovery: 'Hey [Name]! You left items in your cart 🛒\nComplete your purchase now and get 10% off!'
};

export default function CheckoutBotPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [botActive, setBotActive] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState('welcome');
  const [stats, setStats] = useState(null);
  const [templates, setTemplates] = useState({ ...DEFAULT_TEMPLATES });
  const [triggerStates, setTriggerStates] = useState({
    welcome: true,
    catalog: true,
    order: true,
    recovery: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch bot stats and commerce settings in parallel
      const [statsRes, settingsRes] = await Promise.allSettled([
        get('/checkout-bot/stats'),
        get('/settings/commerce')
      ]);

      // Load stats
      if (statsRes.status === 'fulfilled' && statsRes.value?.stats) {
        setStats(statsRes.value.stats);
      }

      // Load bot config from commerce settings
      if (settingsRes.status === 'fulfilled' && settingsRes.value?.settings) {
        const s = settingsRes.value.settings;
        setBotActive(s.enabled || false);
        
        // Load saved templates if they exist in settings
        if (s.checkoutBot?.templates) {
          setTemplates(prev => ({ ...prev, ...s.checkoutBot.templates }));
        }
        if (s.checkoutBot?.triggers) {
          setTriggerStates(prev => ({ ...prev, ...s.checkoutBot.triggers }));
        }
      }
    } catch (err) {
      console.error('Failed to load checkout bot data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBot = async () => {
    const newState = !botActive;
    setBotActive(newState);
    try {
      await put('/settings/commerce', { enabled: newState });
      toast?.success?.(newState ? 'Checkout Bot activated! 🤖' : 'Checkout Bot paused');
    } catch (err) {
      setBotActive(!newState); // revert
      toast?.error?.('Failed to update bot status');
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await put('/settings/commerce', {
        enabled: botActive,
        checkoutBot: {
          templates,
          triggers: triggerStates
        }
      });
      toast?.success?.('Bot configuration synchronized!');
    } catch (err) {
      toast?.error?.(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateChange = (value) => {
    const trigger = BOT_TRIGGERS.find(t => t.id === activeTrigger);
    if (trigger) {
      setTemplates(prev => ({ ...prev, [trigger.templateKey]: value }));
    }
  };

  const toggleTrigger = (triggerId) => {
    setTriggerStates(prev => ({ ...prev, [triggerId]: !prev[triggerId] }));
  };

  const handleCopyTemplate = () => {
    const trigger = BOT_TRIGGERS.find(t => t.id === activeTrigger);
    const text = templates[trigger?.templateKey] || '';
    navigator.clipboard.writeText(text).then(() => {
      toast?.success?.('Template copied!');
    });
  };

  // Format revenue for display
  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount.toLocaleString()}`;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="animate-spin h-10 w-10 text-primary" />
      <p className="text-muted-foreground font-black tracking-widest text-[10px] uppercase">Loading checkout bot...</p>
    </div>
  );

  const activeTriggerData = BOT_TRIGGERS.find(t => t.id === activeTrigger);
  const currentTemplate = templates[activeTriggerData?.templateKey] || '';

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] flex items-center justify-center shadow-xl shadow-[#13C18D]/20">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tighter font-outfit">Checkout Bot</h1>
            <p className="text-muted-foreground font-medium text-sm mt-0.5 flex items-center gap-1.5">
              Automated sales & support <ChevronRight className="h-3 w-3" /> {botActive ? 'Online' : 'Paused'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleToggleBot}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm tracking-tight transition-all active:scale-[0.98] ${
              botActive 
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            {botActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
            {botActive ? 'BOT ONLINE' : 'BOT OFFLINE'}
          </button>
          <button 
            onClick={handleSaveConfig}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-2xl font-black text-sm tracking-tight shadow-xl shadow-primary/25 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {saving ? 'Syncing...' : 'Deploy Config'}
          </button>
        </div>
      </div>

      {/* Real-Time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          label="Total Orders" 
          value={stats?.revenue?.orderCount || 0} 
          icon={ShoppingCart} 
          color="bg-emerald-500" 
        />
        <StatCard 
          label="Conversion" 
          value={`${stats?.conversion?.rate || 0}%`} 
          icon={TrendingUp} 
          color="bg-blue-500" 
        />
        <StatCard 
          label="Revenue" 
          value={formatCurrency(stats?.revenue?.total || 0)} 
          icon={CreditCard} 
          color="bg-[#13C18D]" 
        />
        <StatCard 
          label="Abandoned" 
          value={stats?.carts?.abandoned || 0} 
          icon={BarChart3} 
          color="bg-purple-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trigger Selection */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-2 mb-4">Automation Triggers</h2>
          <div className="space-y-2 p-1 bg-card border border-border/50 rounded-[2rem] shadow-sm">
            {BOT_TRIGGERS.map((trigger) => (
              <div
                key={trigger.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveTrigger(trigger.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all group cursor-pointer ${
                  activeTrigger === trigger.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${activeTrigger === trigger.id ? 'bg-white/20' : 'bg-primary/10 group-hover:bg-primary/20 transition-colors'}`}>
                  <trigger.icon className={`h-5 w-5 ${activeTrigger === trigger.id ? 'text-white' : 'text-primary'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm leading-tight">{trigger.label}</div>
                  <div className={`text-[10px] mt-0.5 ${activeTrigger === trigger.id ? 'text-white/70' : 'text-muted-foreground/60'}`}>
                    {triggerStates[trigger.id] ? 'Active' : 'Disabled'}
                  </div>
                </div>
                {/* Trigger toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleTrigger(trigger.id); }}
                  className={`w-8 h-5 rounded-full transition-all flex items-center ${
                    triggerStates[trigger.id] 
                      ? (activeTrigger === trigger.id ? 'bg-white/30' : 'bg-emerald-500') 
                      : 'bg-muted-foreground/20'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all ${
                    triggerStates[trigger.id] ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>

          {/* Active Carts Indicator */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-[2rem] border border-primary/10">
            <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" /> Live Status
            </h3>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="text-center p-3 bg-white/50 dark:bg-black/10 rounded-xl">
                <div className="text-lg font-black text-foreground">{stats?.carts?.active || 0}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Active Carts</div>
              </div>
              <div className="text-center p-3 bg-white/50 dark:bg-black/10 rounded-xl">
                <div className="text-lg font-black text-foreground">{stats?.conversion?.pendingOrders || 0}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Pending</div>
              </div>
            </div>
          </div>
        </div>

        {/* Trigger Configuration & Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border/50 rounded-[2.5rem] p-8 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black font-outfit text-foreground tracking-tight">
                  {activeTriggerData?.label}
                </h2>
                <p className="text-xs text-muted-foreground font-medium mt-1">
                  {activeTriggerData?.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyTemplate}
                  className="p-2.5 bg-muted hover:bg-border text-muted-foreground hover:text-foreground rounded-xl transition-all"
                  title="Copy template"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => loadData()}
                  className="p-2.5 bg-muted hover:bg-border text-muted-foreground hover:text-foreground rounded-xl transition-all"
                  title="Refresh"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Template Editor */}
            <div className="space-y-4 mb-8">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Response Template</label>
              <div className="relative group">
                <textarea 
                  value={currentTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  placeholder="Type your bot response template here..."
                  className="w-full bg-muted/20 border-2 border-border/40 rounded-3xl p-6 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all resize-none min-h-[140px]"
                />
                <div className="absolute right-4 bottom-4 flex items-center gap-2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded">{currentTemplate.length} chars</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {['[Name]', '[OrderID]', '[Status]', '[CatalogLink]', '[StoreName]'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTemplateChange(currentTemplate + ' ' + tag)}
                    className="px-3 py-1 text-[10px] font-bold bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Preview */}
            <div className="mt-auto">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 mb-3 block">Message Preview</label>
              <div className="bg-gradient-to-br from-[#ECE5DD] to-[#d9d2c5] dark:from-muted/30 dark:to-muted/10 border border-border/50 rounded-[2rem] p-6">
                {/* Incoming message bubble */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gray-400/30 flex items-center justify-center text-xs font-bold text-gray-500">U</div>
                  <div className="bg-white dark:bg-card px-4 py-2.5 rounded-2xl rounded-tl-none shadow-sm max-w-[200px]">
                    <p className="text-xs text-foreground font-medium">Hi</p>
                    <span className="text-[9px] text-muted-foreground float-right mt-1">10:30 AM</span>
                  </div>
                </div>
                {/* Bot response bubble */}
                <div className="flex items-start justify-end gap-3 animate-in slide-in-from-right-8 duration-700">
                  <div className="bg-[#DCF8C6] dark:bg-primary/20 border border-[#b4e197]/30 dark:border-primary/20 px-4 py-2.5 rounded-2xl rounded-tr-none shadow-sm max-w-[280px]">
                    <p className="text-xs text-foreground font-medium whitespace-pre-line leading-relaxed">{currentTemplate || 'Configure your template above...'}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[9px] text-muted-foreground">10:30 AM</span>
                      <CheckCircle2 className="h-3 w-3 text-blue-500" />
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}

// Stat card component
function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-card border border-border/50 rounded-[1.5rem] p-6 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
          <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
        </div>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-3xl font-black text-foreground tracking-tighter">{value}</div>
      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-muted/20 rounded-full group-hover:scale-150 transition-all duration-700" />
    </div>
  );
}
