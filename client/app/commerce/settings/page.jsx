'use client';

import { useState, useEffect } from 'react';
import { FaSave, FaCheckCircle, FaExclamationCircle, FaSpinner, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { getCommerceSettings, updateCommerceSettings, validateCommerceConfig } from '@/lib/api';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'];

const PAYMENT_METHODS = {
  cod: { label: 'Cash on Delivery', color: 'blue' },
  razorpay: { label: 'Razorpay', color: 'emerald' },
  stripe: { label: 'Stripe', color: 'violet' },
  paypal: { label: 'PayPal', color: 'amber' }
};

const NOTIFICATION_OPTIONS = [
  { key: 'notifyAdminOnOrder', label: 'Admin Notification on Order' },
  { key: 'notifyCustomerOnOrder', label: 'Customer Notification on Order' },
  { key: 'notifyAdminOnPayment', label: 'Admin Notification on Payment' },
  { key: 'notifyCustomerOnPayment', label: 'Customer Notification on Payment' }
];

export default function CommerceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [planDisabled, setPlanDisabled] = useState(false);
  const [validationReport, setValidationReport] = useState(null);

  const [settings, setSettings] = useState({
    enabled: false,
    currency: 'INR',
    taxPercentage: 0,
    orderAutoConfirm: false,
    paymentMethods: {
      cod: { enabled: false },
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
      flatRate: 0,
      freeShippingAbove: 0
    },
    businessInfo: {
      storeDescription: '',
      policies: '',
      termsConditions: ''
    }
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setMessage({ type: '', text: '' });

      const data = await getCommerceSettings();

      if (data.statusCode === 403) {
        setPlanDisabled(true);
        setMessage({ 
          type: 'error', 
          text: 'Commerce Settings is only available on Premium or Enterprise plans' 
        });
        return;
      }

      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      if (error.message?.includes('403')) {
        setPlanDisabled(true);
        setMessage({ 
          type: 'error', 
          text: 'Commerce Settings is only available on Premium or Enterprise plans' 
        });
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
        setMessage({ 
          type: 'error', 
          text: 'You do not have permission to update commerce settings. Only workspace owners can modify these settings.' 
        });
        return;
      }

      if (data.success || data.settings) {
        setMessage({ type: 'success', text: 'Commerce settings saved successfully!' });
        setSettings(data.settings || settings);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
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
        if (data.validation.isValid) {
          setMessage({ type: 'success', text: 'Configuration is valid! ✅' });
        } else {
          setMessage({ type: 'error', text: `Configuration has ${data.validation.issues?.length || 0} issue(s)` });
        }
      }
    } catch (error) {
      console.error('Error validating:', error);
      setMessage({ type: 'error', text: 'Failed to validate configuration' });
    } finally {
      setValidating(false);
    }
  };

  const togglePaymentMethod = (method, value) => {
    setSettings(prev => ({
      ...prev,
      paymentMethods: {
        ...prev.paymentMethods,
        [method]: {
          ...prev.paymentMethods[method],
          enabled: value
        }
      }
    }));
  };

  const updatePaymentCredential = (method, field, value) => {
    setSettings(prev => ({
      ...prev,
      paymentMethods: {
        ...prev.paymentMethods,
        [method]: {
          ...prev.paymentMethods[method],
          [field]: value
        }
      }
    }));
  };

  const toggleNotification = (key) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key]
      }
    }));
  };

  const updateAdminEmail = (index, value) => {
    const newEmails = [...settings.notifications.adminEmails];
    newEmails[index] = value;
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        adminEmails: newEmails
      }
    }));
  };

  const addAdminEmail = () => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        adminEmails: [...prev.notifications.adminEmails, '']
      }
    }));
  };

  const removeAdminEmail = (index) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        adminEmails: prev.notifications.adminEmails.filter((_, i) => i !== index)
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FaSpinner className="animate-spin text-4xl text-green-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Commerce Settings</h1>
        <p className="text-gray-600 mt-2">Configure WhatsApp commerce and payment settings</p>
      </div>

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

      {planDisabled ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">Plan Upgrade Required</h2>
          <p className="text-blue-800">Commerce Settings is available exclusively on Premium and Enterprise plans. Upgrade your plan to enable WhatsApp commerce features.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Enable Commerce</h2>
                <p className="text-gray-600 text-sm mt-1">Turn on WhatsApp commerce features for this workspace</p>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  settings.enabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    settings.enabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Basic Settings */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {CURRENCIES.map(curr => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
              </div>

              {/* Tax Percentage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tax Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.taxPercentage}
                  onChange={(e) => setSettings(prev => ({ ...prev, taxPercentage: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Order Auto Confirm */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Auto Confirm Orders</label>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, orderAutoConfirm: !prev.orderAutoConfirm }))}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    settings.orderAutoConfirm ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      settings.orderAutoConfirm ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h2>

            <div className="space-y-6">
              {/* COD */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">Cash on Delivery (COD)</h3>
                    <p className="text-sm text-gray-600">No credentials required</p>
                  </div>
                  <button
                    onClick={() => togglePaymentMethod('cod', !settings.paymentMethods.cod.enabled)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      settings.paymentMethods.cod.enabled ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        settings.paymentMethods.cod.enabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Razorpay */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">Razorpay</h3>
                  <button
                    onClick={() => togglePaymentMethod('razorpay', !settings.paymentMethods.razorpay.enabled)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      settings.paymentMethods.razorpay.enabled ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        settings.paymentMethods.razorpay.enabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {settings.paymentMethods.razorpay.enabled && (
                  <div className="space-y-3">
                    <input
                      type="password"
                      placeholder="Razorpay Key ID"
                      value={settings.paymentMethods.razorpay.keyId || ''}
                      onChange={(e) => updatePaymentCredential('razorpay', 'keyId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <input
                      type="password"
                      placeholder="Razorpay Key Secret"
                      value={settings.paymentMethods.razorpay.keySecret || ''}
                      onChange={(e) => updatePaymentCredential('razorpay', 'keySecret', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Stripe */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">Stripe</h3>
                  <button
                    onClick={() => togglePaymentMethod('stripe', !settings.paymentMethods.stripe.enabled)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      settings.paymentMethods.stripe.enabled ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        settings.paymentMethods.stripe.enabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {settings.paymentMethods.stripe.enabled && (
                  <div className="space-y-3">
                    <input
                      type="password"
                      placeholder="Stripe Publishable Key"
                      value={settings.paymentMethods.stripe.publicKey || ''}
                      onChange={(e) => updatePaymentCredential('stripe', 'publicKey', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <input
                      type="password"
                      placeholder="Stripe Secret Key"
                      value={settings.paymentMethods.stripe.secretKey || ''}
                      onChange={(e) => updatePaymentCredential('stripe', 'secretKey', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* PayPal */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">PayPal</h3>
                  <button
                    onClick={() => togglePaymentMethod('paypal', !settings.paymentMethods.paypal.enabled)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      settings.paymentMethods.paypal.enabled ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        settings.paymentMethods.paypal.enabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {settings.paymentMethods.paypal.enabled && (
                  <div className="space-y-3">
                    <select
                      value={settings.paymentMethods.paypal.mode || 'sandbox'}
                      onChange={(e) => updatePaymentCredential('paypal', 'mode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="sandbox">Sandbox (Testing)</option>
                      <option value="live">Live (Production)</option>
                    </select>
                    <input
                      type="password"
                      placeholder="PayPal Client ID"
                      value={settings.paymentMethods.paypal.clientId || ''}
                      onChange={(e) => updatePaymentCredential('paypal', 'clientId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <input
                      type="password"
                      placeholder="PayPal Client Secret"
                      value={settings.paymentMethods.paypal.clientSecret || ''}
                      onChange={(e) => updatePaymentCredential('paypal', 'clientSecret', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>

            <div className="space-y-4 mb-6">
              {NOTIFICATION_OPTIONS.map(option => (
                <div key={option.key} className="flex items-center justify-between">
                  <label className="text-gray-700 font-medium">{option.label}</label>
                  <button
                    onClick={() => toggleNotification(option.key)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      settings.notifications[option.key] ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                        settings.notifications[option.key] ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            {/* Admin Emails */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-3">Admin Email Addresses</h3>
              <div className="space-y-2">
                {settings.notifications.adminEmails.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateAdminEmail(index, e.target.value)}
                      placeholder="admin@example.com"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => removeAdminEmail(index)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addAdminEmail}
                className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                + Add Email
              </button>
            </div>
          </div>

          {/* Shipping Settings */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Flat Shipping Rate</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.shipping.flatRate}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    shipping: { ...prev.shipping, flatRate: parseFloat(e.target.value) || 0 } 
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Free Shipping Above</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.shipping.freeShippingAbove}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    shipping: { ...prev.shipping, freeShippingAbove: parseFloat(e.target.value) || 0 } 
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Business Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Store Description</label>
                <textarea
                  value={settings.businessInfo.storeDescription}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    businessInfo: { ...prev.businessInfo, storeDescription: e.target.value } 
                  }))}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Policies</label>
                <textarea
                  value={settings.businessInfo.policies}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    businessInfo: { ...prev.businessInfo, policies: e.target.value } 
                  }))}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Terms & Conditions</label>
                <textarea
                  value={settings.businessInfo.termsConditions}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    businessInfo: { ...prev.businessInfo, termsConditions: e.target.value } 
                  }))}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Validation Report */}
          {validationReport && (
            <div className={`rounded-lg p-6 border ${
              validationReport.isValid 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                {validationReport.isValid ? (
                  <>
                    <FaCheckCircle className="text-green-600 mr-2" />
                    <span className="text-green-900">Configuration Valid</span>
                  </>
                ) : (
                  <>
                    <FaExclamationCircle className="text-yellow-600 mr-2" />
                    <span className="text-yellow-900">Configuration Issues Found</span>
                  </>
                )}
              </h2>
              {validationReport.issues && validationReport.issues.length > 0 && (
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {validationReport.issues.map((issue, idx) => (
                    <li key={idx} className="text-yellow-800">{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 flex-wrap sticky bottom-0 bg-white py-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving || planDisabled}
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

            <button
              onClick={handleValidate}
              disabled={validating || planDisabled}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {validating ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  Validating...
                </>
              ) : (
                <>
                  <FaCheckCircle className="mr-2" />
                  Validate Config
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
