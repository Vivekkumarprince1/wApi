'use client';

import { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Loader2, ShoppingBag, Settings } from 'lucide-react';
import { getCommerceSettings, updateCommerceSettings, validateCommerceConfig } from '@/lib/api';
import PageLoader from '@/components/ui/PageLoader';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'];

const NOTIFICATION_OPTIONS = [
  { key: 'notifyAdminOnOrder', label: 'Admin Notification on Order' },
  { key: 'notifyCustomerOnOrder', label: 'Customer Notification on Order' },
  { key: 'notifyAdminOnPayment', label: 'Admin Notification on Payment' },
  { key: 'notifyCustomerOnPayment', label: 'Customer Notification on Payment' }
];

const Toggle = ({ enabled, onChange }) => (
  <button onClick={onChange}
    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}>
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

export default function CommerceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [planDisabled, setPlanDisabled] = useState(false);
  const [validationReport, setValidationReport] = useState(null);

  const [settings, setSettings] = useState({
    enabled: false, currency: 'INR', taxPercentage: 0, orderAutoConfirm: false,
    paymentMethods: {
      cod: { enabled: false },
      razorpay: { enabled: false, keyId: '', keySecret: '' },
      stripe: { enabled: false, publicKey: '', secretKey: '' },
      paypal: { enabled: false, clientId: '', clientSecret: '', mode: 'sandbox' }
    },
    notifications: {
      notifyAdminOnOrder: true, notifyCustomerOnOrder: true,
      notifyAdminOnPayment: false, notifyCustomerOnPayment: false,
      adminEmails: []
    },
    shipping: { flatRate: 0, freeShippingAbove: 0 },
    businessInfo: { storeDescription: '', policies: '', termsConditions: '' }
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getCommerceSettings();
      if (data.statusCode === 403) {
        setPlanDisabled(true);
        setMessage({ type: 'error', text: 'Commerce Settings is only available on Premium or Enterprise plans' });
        return;
      }
      if (data.settings) setSettings(data.settings);
    } catch (error) {
      if (error.message?.includes('403')) {
        setPlanDisabled(true);
        setMessage({ type: 'error', text: 'Commerce Settings is only available on Premium or Enterprise plans' });
      } else {
        setMessage({ type: 'error', text: 'Failed to load commerce settings' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      const data = await updateCommerceSettings(settings);
      if (data.statusCode === 403) {
        setMessage({ type: 'error', text: 'Only workspace owners can modify these settings.' });
        return;
      }
      if (data.success || data.settings) {
        setMessage({ type: 'success', text: 'Commerce settings saved successfully!' });
        setSettings(data.settings || settings);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    try {
      setValidating(true);
      setMessage({ type: '', text: '' });
      const data = await validateCommerceConfig();
      if (data.validation) {
        setValidationReport(data.validation);
        setMessage({
          type: data.validation.isValid ? 'success' : 'error',
          text: data.validation.isValid ? 'Configuration is valid! ✅' : `Configuration has ${data.validation.issues?.length || 0} issue(s)`
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to validate configuration' });
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

  if (loading) return <PageLoader message="Loading commerce settings..." />;

  const inputClass = "input-premium";

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-md">
          <ShoppingBag className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Commerce Settings</h1>
          <p className="text-sm text-muted-foreground">Configure WhatsApp commerce and payment settings</p>
        </div>
      </div>

      {/* Message Alert */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${message.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
          : 'bg-destructive/5 border-destructive/20 text-destructive'}`}>
          {message.type === 'success'
            ? <CheckCircle className="h-5 w-5 shrink-0" />
            : <AlertCircle className="h-5 w-5 shrink-0" />}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {planDisabled ? (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2">Plan Upgrade Required</h2>
          <p className="text-blue-600 dark:text-blue-400 text-sm">Commerce Settings is available exclusively on Premium and Enterprise plans.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="bg-card border border-border/50 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Enable Commerce</h2>
                <p className="text-muted-foreground text-sm mt-1">Turn on WhatsApp commerce features for this workspace</p>
              </div>
              <Toggle enabled={settings.enabled} onChange={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))} />
            </div>
          </div>

          {/* Basic Settings */}
          <div className="bg-card border border-border/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Basic Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Currency</label>
                <select value={settings.currency}
                  onChange={(e) => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                  className={inputClass}>
                  {CURRENCIES.map(curr => (<option key={curr} value={curr}>{curr}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Tax Percentage (%)</label>
                <input type="number" min="0" max="100" step="0.1" value={settings.taxPercentage}
                  onChange={(e) => setSettings(prev => ({ ...prev, taxPercentage: parseFloat(e.target.value) || 0 }))}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Auto Confirm Orders</label>
                <Toggle enabled={settings.orderAutoConfirm}
                  onChange={() => setSettings(prev => ({ ...prev, orderAutoConfirm: !prev.orderAutoConfirm }))} />
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-card border border-border/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Payment Methods</h2>
            <div className="space-y-4">
              {/* COD */}
              <div className="border border-border/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">Cash on Delivery (COD)</h3>
                    <p className="text-xs text-muted-foreground">No credentials required</p>
                  </div>
                  <Toggle enabled={settings.paymentMethods.cod.enabled}
                    onChange={() => togglePaymentMethod('cod', !settings.paymentMethods.cod.enabled)} />
                </div>
              </div>

              {/* Razorpay */}
              <div className="border border-border/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-foreground">Razorpay</h3>
                  <Toggle enabled={settings.paymentMethods.razorpay.enabled}
                    onChange={() => togglePaymentMethod('razorpay', !settings.paymentMethods.razorpay.enabled)} />
                </div>
                {settings.paymentMethods.razorpay.enabled && (
                  <div className="space-y-3">
                    <input type="password" placeholder="Razorpay Key ID"
                      value={settings.paymentMethods.razorpay.keyId || ''}
                      onChange={(e) => updatePaymentCredential('razorpay', 'keyId', e.target.value)}
                      className={inputClass} />
                    <input type="password" placeholder="Razorpay Key Secret"
                      value={settings.paymentMethods.razorpay.keySecret || ''}
                      onChange={(e) => updatePaymentCredential('razorpay', 'keySecret', e.target.value)}
                      className={inputClass} />
                  </div>
                )}
              </div>

              {/* Stripe */}
              <div className="border border-border/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-foreground">Stripe</h3>
                  <Toggle enabled={settings.paymentMethods.stripe.enabled}
                    onChange={() => togglePaymentMethod('stripe', !settings.paymentMethods.stripe.enabled)} />
                </div>
                {settings.paymentMethods.stripe.enabled && (
                  <div className="space-y-3">
                    <input type="password" placeholder="Stripe Publishable Key"
                      value={settings.paymentMethods.stripe.publicKey || ''}
                      onChange={(e) => updatePaymentCredential('stripe', 'publicKey', e.target.value)}
                      className={inputClass} />
                    <input type="password" placeholder="Stripe Secret Key"
                      value={settings.paymentMethods.stripe.secretKey || ''}
                      onChange={(e) => updatePaymentCredential('stripe', 'secretKey', e.target.value)}
                      className={inputClass} />
                  </div>
                )}
              </div>

              {/* PayPal */}
              <div className="border border-border/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-foreground">PayPal</h3>
                  <Toggle enabled={settings.paymentMethods.paypal.enabled}
                    onChange={() => togglePaymentMethod('paypal', !settings.paymentMethods.paypal.enabled)} />
                </div>
                {settings.paymentMethods.paypal.enabled && (
                  <div className="space-y-3">
                    <select value={settings.paymentMethods.paypal.mode || 'sandbox'}
                      onChange={(e) => updatePaymentCredential('paypal', 'mode', e.target.value)}
                      className={inputClass}>
                      <option value="sandbox">Sandbox (Testing)</option>
                      <option value="live">Live (Production)</option>
                    </select>
                    <input type="password" placeholder="PayPal Client ID"
                      value={settings.paymentMethods.paypal.clientId || ''}
                      onChange={(e) => updatePaymentCredential('paypal', 'clientId', e.target.value)}
                      className={inputClass} />
                    <input type="password" placeholder="PayPal Client Secret"
                      value={settings.paymentMethods.paypal.clientSecret || ''}
                      onChange={(e) => updatePaymentCredential('paypal', 'clientSecret', e.target.value)}
                      className={inputClass} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-card border border-border/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Notifications</h2>
            <div className="space-y-4 mb-6">
              {NOTIFICATION_OPTIONS.map(option => (
                <div key={option.key} className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">{option.label}</label>
                  <Toggle enabled={settings.notifications[option.key]}
                    onChange={() => toggleNotification(option.key)} />
                </div>
              ))}
            </div>

            <div className="border-t border-border/50 pt-4">
              <h3 className="font-medium text-foreground mb-3 text-sm">Admin Email Addresses</h3>
              <div className="space-y-2">
                {settings.notifications.adminEmails.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <input type="email" value={email}
                      onChange={(e) => updateAdminEmail(index, e.target.value)}
                      placeholder="admin@example.com" className={`flex-1 ${inputClass}`} />
                    <button onClick={() => removeAdminEmail(index)}
                      className="px-3 py-2 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 text-sm transition-colors">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addAdminEmail}
                className="mt-3 px-4 py-2 bg-muted text-muted-foreground rounded-xl hover:bg-accent text-sm transition-colors">
                + Add Email
              </button>
            </div>
          </div>

          {/* Shipping Settings */}
          <div className="bg-card border border-border/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Shipping</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Flat Shipping Rate</label>
                <input type="number" min="0" step="0.01" value={settings.shipping.flatRate}
                  onChange={(e) => setSettings(prev => ({
                    ...prev, shipping: { ...prev.shipping, flatRate: parseFloat(e.target.value) || 0 }
                  }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Free Shipping Above</label>
                <input type="number" min="0" step="0.01" value={settings.shipping.freeShippingAbove}
                  onChange={(e) => setSettings(prev => ({
                    ...prev, shipping: { ...prev.shipping, freeShippingAbove: parseFloat(e.target.value) || 0 }
                  }))} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Business Info */}
          <div className="bg-card border border-border/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Business Information</h2>
            <div className="space-y-4">
              {[
                { label: 'Store Description', key: 'storeDescription' },
                { label: 'Policies', key: 'policies' },
                { label: 'Terms & Conditions', key: 'termsConditions' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-foreground mb-2">{field.label}</label>
                  <textarea value={settings.businessInfo[field.key]}
                    onChange={(e) => setSettings(prev => ({
                      ...prev, businessInfo: { ...prev.businessInfo, [field.key]: e.target.value }
                    }))}
                    rows="3" className={inputClass} />
                </div>
              ))}
            </div>
          </div>

          {/* Validation Report */}
          {validationReport && (
            <div className={`rounded-xl p-6 border ${validationReport.isValid
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/20'}`}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                {validationReport.isValid ? (
                  <><CheckCircle className="h-5 w-5 text-emerald-500" /><span className="text-emerald-700 dark:text-emerald-300">Configuration Valid</span></>
                ) : (
                  <><AlertCircle className="h-5 w-5 text-amber-500" /><span className="text-amber-700 dark:text-amber-300">Issues Found</span></>
                )}
              </h2>
              {validationReport.issues?.length > 0 && (
                <ul className="list-disc list-inside space-y-1 text-sm text-amber-700 dark:text-amber-300">
                  {validationReport.issues.map((issue, idx) => (<li key={idx}>{issue}</li>))}
                </ul>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap sticky bottom-0 bg-background/80 backdrop-blur-sm py-4 border-t border-border/50">
            <button onClick={handleSave} disabled={saving || planDisabled}
              className="btn-primary flex items-center gap-2 text-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button onClick={handleValidate} disabled={validating || planDisabled}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {validating ? 'Validating...' : 'Validate Config'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
