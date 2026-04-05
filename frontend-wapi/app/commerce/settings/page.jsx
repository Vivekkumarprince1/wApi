'use client';

import { useState, useEffect } from 'react';
import { 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ShoppingBag, 
  Settings, 
  CreditCard, 
  Truck, 
  Bell, 
  Building2, 
  Layers,
  Globe,
  Percent,
  Mail,
  Plus,
  Trash2,
  Clock,
  Trophy
} from 'lucide-react';
import { getCommerceSettings, updateCommerceSettings, validateCommerceConfig } from '@/lib/api';
import PageLoader from '@/components/ui/PageLoader';
import { toast } from '@/lib/toast';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'];

const NOTIFICATION_OPTIONS = [
  { key: 'notifyAdminOnOrder', label: 'Admin Notification on Order', description: 'Alert administrators when a new order is placed.' },
  { key: 'notifyCustomerOnOrder', label: 'Customer Notification on Order', description: 'Send a confirmation message to the customer after ordering.' },
  { key: 'notifyAdminOnPayment', label: 'Admin Notification on Payment', description: 'Alert administrators when a payment is successfully received.' },
  { key: 'notifyCustomerOnPayment', label: 'Customer Notification on Payment', description: 'Send a payment receipt to the customer.' }
];

const Toggle = ({ enabled, onChange, disabled }) => (
  <button 
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
      enabled ? 'bg-primary shadow-[0_0_12px_rgba(var(--primary),0.3)]' : 'bg-muted'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
      enabled ? 'translate-x-6' : 'translate-x-1'
    }`} />
  </button>
);

export default function CommerceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [planDisabled, setPlanDisabled] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [activeTab, setActiveTab] = useState('general');

  const [settings, setSettings] = useState({
    enabled: false, 
    currency: 'INR', 
    taxPercentage: 0, 
    orderAutoConfirm: false,
    paymentMethods: {
      cashOnDelivery: { enabled: false },
      razorpay: { enabled: false, keyId: '', keySecret: '' },
      stripe: { enabled: false, publicKey: '', secretKey: '' },
      paypal: { enabled: false, clientId: '', clientSecret: '', mode: 'sandbox' }
    },
    notifications: {
      notifyAdminOnOrder: true, 
      notifyCustomerOnOrder: true,
      notifyAdminOnPayment: false, 
      notifyCustomerOnPayment: false,
      adminEmails: []
    },
    shipping: { 
      enabled: false,
      flatRate: { enabled: false, amount: 0 },
      freeShippingAbove: { enabled: false, amount: 0 }
    },
    business: { 
      storeName: '',
      storeDescription: '', 
      policies: {
        returnPolicy: '',
        cancellationPolicy: '',
        shippingPolicy: '',
        privacyPolicy: '',
        termsConditions: ''
      }
    }
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getCommerceSettings();
      
      // If we got here, 403 is handled by the interceptor or logic below
      if (data?.settings) {
        // Deep merge with defaults to ensure all fields exist
        setSettings(prev => ({
          ...prev,
          ...data.settings,
          paymentMethods: {
            ...prev.paymentMethods,
            ...data.settings.paymentMethods
          },
          notifications: {
            ...prev.notifications,
            ...data.settings.notifications
          },
          shipping: {
            ...prev.shipping,
            ...data.settings.shipping
          },
          business: {
            ...prev.business,
            ...data.settings.business,
            policies: {
              ...prev.business.policies,
              ...(data.settings.business?.policies || {})
            }
          }
        }));
      }
    } catch (error) {
      console.error('Loader Error:', error);
      if (error.response?.status === 403) {
        setPlanDisabled(true);
      } else {
        toast?.error?.('Failed to synchronize with Commerce Vault');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const data = await updateCommerceSettings(settings);
      if (data.success || data.settings) {
        toast?.success?.('Commerce ecosystem synchronized!');
        if (data.settings) {
           // Update with returned settings to get 'configured' flags if needed
           setSettings(prev => ({ ...prev, ...data.settings }));
        }
      }
    } catch (error) {
      toast?.error?.(error.message || 'Synchronization failed');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    try {
      setValidating(true);
      const data = await validateCommerceConfig();
      if (data.validation) {
        setValidationReport(data.validation);
        if (data.validation.issues?.length > 0) {
          toast?.warning?.(`Found ${data.validation.issues.length} configuration anomalies.`);
        } else {
          toast?.success?.('System integrity confirmed! ✅');
        }
      }
    } catch (error) {
      toast?.error?.('Audit failed to initialize');
    } finally {
      setValidating(false);
    }
  };

  const togglePaymentMethod = (method, value) => {
    setSettings(prev => ({
      ...prev,
      paymentMethods: { ...prev.paymentMethods, [method]: { ...prev.paymentMethods[method], enabled: value } }
    }));
  };

  const updatePaymentCredential = (method, field, value) => {
    setSettings(prev => ({
      ...prev,
      paymentMethods: { ...prev.paymentMethods, [method]: { ...prev.paymentMethods[method], [field]: value } }
    }));
  };

  const toggleNotification = (key) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: !prev.notifications[key] }
    }));
  };

  const updateAdminEmail = (index, value) => {
    const newEmails = [...settings.notifications.adminEmails];
    newEmails[index] = value;
    setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, adminEmails: newEmails } }));
  };

  const addAdminEmail = () => {
    setSettings(prev => ({ ...prev, notifications: { ...prev.notifications, adminEmails: [...prev.notifications.adminEmails, ''] } }));
  };

  const removeAdminEmail = (index) => {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, adminEmails: prev.notifications.adminEmails.filter((_, i) => i !== index) }
    }));
  };

  if (loading) return <PageLoader message="Opening Commerce Vault..." />;

  const inputClass = "input-premium bg-muted/30 border-muted-foreground/10 focus:bg-background transition-all placeholder:text-muted-foreground/40";

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'shipping', label: 'Shipping', icon: Truck },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'business', label: 'Business Info', icon: Building2 },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#13C18D] to-[#0e8c6c] flex items-center justify-center shadow-xl shadow-[#13C18D]/20 ring-4 ring-[#13C18D]/5">
            <ShoppingBag className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight font-outfit">Commerce Ecosystem</h1>
            <p className="text-muted-foreground font-medium text-sm mt-1">Manage shared catalogs, payments, and storefront directives</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleValidate} 
            disabled={validating || planDisabled}
            className="flex items-center gap-2 px-5 py-2.5 bg-muted/50 hover:bg-muted text-foreground border border-border rounded-2xl text-sm font-bold transition-all disabled:opacity-50"
          >
            {validating ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Layers className="h-4 w-4 text-primary" />}
            {validating ? 'Analyzing...' : 'Audit Config'}
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving || planDisabled}
            className="flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-2xl font-black text-sm tracking-tight shadow-xl shadow-primary/25 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Syncing...' : 'Deploy Changes'}
          </button>
        </div>
      </div>

      {planDisabled ? (
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-[3rem] p-16 text-center shadow-2xl animate-in zoom-in-95 duration-700">
          <div className="w-24 h-24 bg-primary/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 animate-bounce">
            <Trophy className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-3xl font-black text-foreground mb-4 font-outfit tracking-tighter">Commerce is an Enterprise Tier</h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-base font-medium leading-relaxed mb-10">
            WhatsApp Storefront, Automated Payment Gateways, and Global Shipping Matrix are exclusive to our high-growth advanced commerce plans.
          </p>
          <button className="px-10 py-4 bg-primary text-white rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
            Upgrade Your Business
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Navigation Sidebar */}
          <div className="lg:w-64 shrink-0">
            <div className="flex flex-col gap-1.5 p-2 bg-card border border-border shadow-sm rounded-[2rem]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-5 py-4 rounded-xl text-sm font-bold transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <tab.icon className={`h-4.5 w-4.5 ${activeTab === tab.id ? 'text-white' : 'text-primary/70'}`} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-w-0 space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
            {activeTab === 'general' && (
              <div className="space-y-8">
                <div className="bg-card border border-border/50 rounded-[2.5rem] p-10 shadow-sm group hover:border-primary/20 transition-all">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h2 className="text-2xl font-black font-outfit text-foreground group-hover:text-primary transition-colors tracking-tight">Module Engagement</h2>
                      <p className="text-muted-foreground text-sm font-medium mt-1">Globally activate or pause your commerce logic</p>
                    </div>
                    <Toggle enabled={settings.enabled} onChange={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))} />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        <Globe className="w-3.5 h-3.5 text-primary" /> Store Currency
                      </label>
                      <select 
                        value={settings.currency}
                        onChange={(e) => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                        className={inputClass}
                      >
                        {CURRENCIES.map(curr => (<option key={curr} value={curr}>{curr}</option>))}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        <Percent className="w-3.5 h-3.5 text-primary" /> Global Tax / GST (%)
                      </label>
                      <input 
                        type="number" min="0" max="100" step="0.1" 
                        value={settings.taxPercentage}
                        onChange={(e) => setSettings(prev => ({ ...prev, taxPercentage: parseFloat(e.target.value) || 0 }))}
                        className={inputClass} 
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border/50 rounded-[2.5rem] p-10 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black font-outfit text-foreground tracking-tight">Order Lifecycle</h2>
                      <p className="text-muted-foreground text-sm font-medium mt-1">Automatic verification and processing workflows</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">{settings.orderAutoConfirm ? 'Auto-Confirm' : 'Manual Lock'}</span>
                      <Toggle enabled={settings.orderAutoConfirm} onChange={() => setSettings(prev => ({ ...prev, orderAutoConfirm: !prev.orderAutoConfirm }))} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="grid grid-cols-1 gap-8">
                {/* Razorpay */}
                <div className={`bg-card rounded-[3rem] border-2 transition-all p-10 shadow-sm ${
                  settings.paymentMethods.razorpay.enabled ? 'border-primary/40 bg-primary/[0.03]' : 'border-border/50'
                }`}>
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-[#3395FF]/10 rounded-[1.25rem] flex items-center justify-center">
                        <CreditCard className="w-7 h-7 text-[#3395FF]" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold font-outfit text-foreground tracking-tight">Razorpay Integration</h3>
                        <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] mt-1 uppercase">Preferred Digital Checkout</p>
                      </div>
                    </div>
                    <Toggle 
                      enabled={settings.paymentMethods.razorpay.enabled}
                      onChange={() => togglePaymentMethod('razorpay', !settings.paymentMethods.razorpay.enabled)} 
                    />
                  </div>
                  {settings.paymentMethods.razorpay.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-6 duration-500">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase tracking-widest">Live Key ID</label>
                        <input type="password" placeholder="rzp_live_..."
                          value={settings.paymentMethods.razorpay.keyId || ''}
                          onChange={(e) => updatePaymentCredential('razorpay', 'keyId', e.target.value)}
                          className={inputClass} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase tracking-widest">Secret Identity</label>
                        <input type="password" placeholder="••••••••••••"
                          value={settings.paymentMethods.razorpay.keySecret || ''}
                          onChange={(e) => updatePaymentCredential('razorpay', 'keySecret', e.target.value)}
                          className={inputClass} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Stripe */}
                <div className={`bg-card rounded-[3rem] border-2 transition-all p-10 shadow-sm ${
                  settings.paymentMethods.stripe.enabled ? 'border-[#635BFF]/40 bg-[#635BFF]/[0.03]' : 'border-border/50'
                }`}>
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-[#635BFF]/10 rounded-[1.25rem] flex items-center justify-center">
                        <Globe className="w-7 h-7 text-[#635BFF]" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold font-outfit text-foreground tracking-tight">Stripe Global</h3>
                        <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] mt-1 uppercase">Universal Payment Ledger</p>
                      </div>
                    </div>
                    <Toggle 
                      enabled={settings.paymentMethods.stripe.enabled}
                      onChange={() => togglePaymentMethod('stripe', !settings.paymentMethods.stripe.enabled)} 
                    />
                  </div>
                  {settings.paymentMethods.stripe.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-6 duration-500">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase tracking-widest">Publishable Key</label>
                        <input type="password" placeholder="pk_live_..."
                          value={settings.paymentMethods.stripe.publicKey || ''}
                          onChange={(e) => updatePaymentCredential('stripe', 'publicKey', e.target.value)}
                          className={inputClass} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted-foreground ml-1 uppercase tracking-widest">Restricted Secret</label>
                        <input type="password" placeholder="sk_live_..."
                          value={settings.paymentMethods.stripe.secretKey || ''}
                          onChange={(e) => updatePaymentCredential('stripe', 'secretKey', e.target.value)}
                          className={inputClass} />
                      </div>
                    </div>
                  )}
                </div>

                {/* COD */}
                <div className={`bg-card rounded-[3.5rem] border-2 transition-all p-8 md:p-10 shadow-sm ${
                  settings.paymentMethods.cashOnDelivery?.enabled ? 'border-amber-500/40 bg-amber-500/[0.03]' : 'border-border/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-amber-500/10 rounded-[1.25rem] flex items-center justify-center">
                        <Clock className="w-7 h-7 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold font-outfit text-foreground tracking-tight">Cash on Delivery</h3>
                        <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] mt-1 uppercase">Local Trust & Logistics</p>
                      </div>
                    </div>
                    <Toggle 
                      enabled={settings.paymentMethods.cashOnDelivery?.enabled}
                      onChange={() => togglePaymentMethod('cashOnDelivery', !settings.paymentMethods.cashOnDelivery?.enabled)} 
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="bg-card border border-border/50 rounded-[3rem] p-12 shadow-sm animate-in zoom-in-95 duration-700 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Truck className="w-40 h-40 text-primary rotate-12" />
                </div>
                <div className="mb-12 relative z-10">
                  <h2 className="text-2xl font-black font-outfit text-foreground tracking-tight">Logistics Matrix</h2>
                  <p className="text-muted-foreground text-sm font-medium mt-1">Synchronize shipping costs across global regions</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      <Truck className="w-4.5 h-4.5 text-primary" /> Flat Shipping Logic
                    </div>
                    <div className="relative group">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-lg font-black text-primary/40 group-focus-within:text-primary transition-colors">{settings.currency === 'INR' ? '₹' : '$'}</span>
                      <input 
                        type="number" min="0" step="0.01" value={settings.shipping.flatRate?.amount || 0}
                        onChange={(e) => setSettings(prev => ({
                          ...prev, shipping: { ...prev.shipping, flatRate: { ...prev.shipping.flatRate, amount: parseFloat(e.target.value) || 0 } }
                        }))} 
                        className={`${inputClass} pl-12 h-14 text-lg font-bold outline-none`} 
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold px-2 italic uppercase tracking-tighter">Applied as default base fee</p>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      <ShoppingBag className="w-4.5 h-4.5 text-primary" /> Free Tier Threshold
                    </div>
                    <div className="relative group">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-lg font-black text-primary/40 group-focus-within:text-primary transition-colors">{settings.currency === 'INR' ? '₹' : '$'}</span>
                      <input 
                        type="number" min="0" step="0.01" value={settings.shipping.freeShippingAbove?.amount || 0}
                        onChange={(e) => setSettings(prev => ({
                          ...prev, shipping: { ...prev.shipping, freeShippingAbove: { ...prev.shipping.freeShippingAbove, amount: parseFloat(e.target.value) || 0 } }
                        }))} 
                        className={`${inputClass} pl-12 h-14 text-lg font-bold outline-none`} 
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold px-2 italic uppercase tracking-tighter">Waiver limit for high-value orders</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-10">
                <div className="bg-card border border-border/50 rounded-[3rem] p-10 shadow-sm">
                  <h2 className="text-2xl font-black font-outfit text-foreground mb-8 tracking-tight">Workflow Automations</h2>
                  <div className="grid grid-cols-1 gap-6">
                    {NOTIFICATION_OPTIONS.map(option => (
                      <div key={option.key} className="flex items-center justify-between p-6 rounded-[1.5rem] bg-muted/20 border border-border/40 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer">
                        <div className="flex-1 pr-8">
                          <label className="text-base font-bold text-foreground block tracking-tight">{option.label}</label>
                          <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">{option.description}</p>
                        </div>
                        <Toggle 
                          enabled={settings.notifications[option.key]}
                          onChange={() => toggleNotification(option.key)} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border/50 rounded-[3rem] p-10 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-black font-outfit text-foreground tracking-tight">Administrative Alert Hub</h2>
                      <p className="text-muted-foreground text-sm font-medium mt-1">Multi-agent email distribution for order success</p>
                    </div>
                    <button onClick={addAdminEmail} className="p-4 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-2xl transition-all shadow-md active:scale-90">
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {settings.notifications.adminEmails?.length === 0 ? (
                      <div className="py-16 text-center border-2 border-dashed border-border rounded-[2.5rem] opacity-40">
                        <Mail className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-xs font-black uppercase tracking-[0.2em]">Zero Alert Nodes Configured</p>
                      </div>
                    ) : settings.notifications.adminEmails.map((email, index) => (
                      <div key={index} className="flex gap-4 animate-in slide-in-from-left-6 duration-500">
                        <div className="relative flex-1 group">
                          <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-primary opacity-50 group-focus-within:opacity-100 transition-opacity" />
                          <input type="email" value={email}
                            onChange={(e) => updateAdminEmail(index, e.target.value)}
                            placeholder="agent.operational@enterprise.com" className={`${inputClass} pl-12 h-14`} />
                        </div>
                        <button 
                          onClick={() => removeAdminEmail(index)}
                          className="px-6 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-[1.25rem] transition-all group"
                        >
                          <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'business' && (
              <div className="bg-card border border-border/50 rounded-[3rem] p-12 shadow-sm space-y-10 animate-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary">
                      <Building2 className="w-8 h-8" />
                   </div>
                   <div>
                      <h2 className="text-2xl font-black font-outfit text-foreground tracking-tight">Commerce Directives</h2>
                      <p className="text-muted-foreground text-sm font-medium mt-1">Official store policies and brand narratives</p>
                   </div>
                </div>
                
                <div className="space-y-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Store Narrative (Description)</label>
                    <textarea 
                      value={settings.business.storeDescription || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev, business: { ...prev.business, storeDescription: e.target.value }
                      }))}
                      placeholder="Tell your customers about your value proposition..."
                      rows="4" 
                      className={`${inputClass} resize-none py-5 leading-relaxed bg-muted/10`} 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {[
                      { label: 'Return & Refund Protocol', key: 'returnPolicy', placeholder: '7-day replacement, or store credit?' },
                      { label: 'Shipping Timelines', key: 'shippingPolicy', placeholder: '2-3 days local, 7 days international.' },
                      { label: 'Security & Privacy', key: 'privacyPolicy', placeholder: 'How you handle customer metadata.' },
                      { label: 'Legal Terms', key: 'termsConditions', placeholder: 'Standard trade agreements.' },
                    ].map(field => (
                      <div key={field.key} className="space-y-4">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">{field.label}</label>
                        <textarea 
                          value={settings.business.policies?.[field.key] || ''}
                          onChange={(e) => setSettings(prev => ({
                            ...prev, business: { ...prev.business, policies: { ...(prev.business.policies || {}), [field.key]: e.target.value } }
                          }))}
                          placeholder={field.placeholder}
                          rows="5" 
                          className={`${inputClass} resize-none py-5 leading-relaxed bg-muted/10`} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Inspector */}
      {validationReport && (
        <div className="mt-16 animate-in fade-in slide-in-from-bottom-10 duration-1000">
          <div className={`rounded-[3rem] p-1.5 border-2 transition-all shadow-2xl ${validationReport.isValid
            ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
            : 'border-amber-500/30 bg-amber-500/[0.03]'}`}>
            <div className="p-10">
              <h2 className="text-2xl font-black font-outfit mb-6 flex items-center gap-4">
                {validationReport.isValid ? (
                  <><CheckCircle className="h-8 w-8 text-emerald-500 shadow-lg shadow-emerald-500/20" /><span className="text-emerald-700 tracking-tight">Ecosystem Status: Optimized</span></>
                ) : (
                  <><AlertCircle className="h-8 w-8 text-amber-500 shadow-lg shadow-amber-500/20" /><span className="text-amber-700 font-black uppercase tracking-tighter italic">Configuration Anomalies Detected</span></>
                )}
              </h2>
              {validationReport.issues?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {validationReport.issues.map((issue, idx) => (
                    <div key={idx} className="flex gap-3 p-4 bg-white/60 dark:bg-black/20 rounded-2xl border border-white/40 shadow-sm text-xs font-bold text-muted-foreground leading-snug">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                      {issue}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        .font-inter { font-family: 'Inter', sans-serif; }
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
