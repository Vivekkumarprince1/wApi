# ESB Flow - Code Examples & Implementation Guide

Complete working code examples for implementing the Embedded Signup Business (ESB) flow in your application.

## Table of Contents

1. [Backend Implementation](#backend-implementation)
2. [Frontend React Components](#frontend-react-components)
3. [API Integration Examples](#api-integration-examples)
4. [Error Handling](#error-handling)
5. [Webhook Handlers](#webhook-handlers)

---

## Backend Implementation

### Initialize metaAutomationService

```javascript
// services/metaAutomationService.js - Already created
// This file contains all the ESB flow logic

const metaAutomationService = require('../services/metaAutomationService');

// Example usage:
const esbUrl = await metaAutomationService.generateEmbeddedSignupURL(
  userId,
  'https://yourapp.com/api/onboarding/esb/callback'
);

const token = await metaAutomationService.exchangeCodeForToken(
  authCode,
  'https://yourapp.com/api/onboarding/esb/callback'
);
```

### Setup Express Routes

```javascript
// routes/onboardingRoutes.js - Already updated
// Routes are ready to use

// POST /api/onboarding/esb/start - Start ESB
// GET /api/onboarding/esb/callback - Handle callback
// POST /api/onboarding/esb/verify-business - Verify business
// POST /api/onboarding/esb/register-phone - Register phone
// POST /api/onboarding/esb/verify-otp - Verify OTP
// POST /api/onboarding/esb/create-system-user - Create system user
// POST /api/onboarding/esb/activate-waba - Activate WABA
// GET /api/onboarding/esb/status - Get status
```

### Webhook Handler for Meta Callbacks

```javascript
// webhooks/metaWebhookHandler.js - Create this file

const express = require('express');
const router = express.Router();
const Workspace = require('../models/Workspace');
const { verifyWebhookSignature } = require('../services/metaService');

// Verify webhook token
router.get('/webhook', (req, res) => {
  const verifyToken = process.env.META_VERIFY_TOKEN;
  const challenge = req.query['hub.challenge'];
  const token = req.query['hub.verify_token'];

  if (token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: 'Invalid verify token' });
  }
});

// Handle webhook events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.get('x-hub-signature-256');
    const body = req.body.toString('utf-8');
    
    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature, process.env.META_APP_SECRET)) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body);

    // Handle different webhook events
    if (event.object === 'whatsapp_business_account') {
      for (const entry of event.entry) {
        for (const change of entry.changes) {
          const field = change.field;
          const value = change.value;

          console.log(`[Webhook] Field: ${field}, Value:`, value);

          // Handle phone number status changes
          if (field === 'phone_number_quality_update') {
            await handlePhoneQualityUpdate(value);
          }

          // Handle business verification status
          if (field === 'business_verification_update') {
            await handleBusinessVerificationUpdate(value);
          }

          // Handle message template status
          if (field === 'message_template_status_update') {
            await handleTemplateStatusUpdate(value);
          }
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Handler: Phone number quality update
async function handlePhoneQualityUpdate(value) {
  try {
    const { phone_number_id, quality_rating, status } = value;

    // Find workspace with this phone number
    const workspace = await Workspace.findOne({
      'whatsappPhoneNumberId': phone_number_id
    });

    if (workspace) {
      workspace.whatsappSetup = workspace.whatsappSetup || {};
      workspace.whatsappSetup.phoneQuality = quality_rating;
      workspace.whatsappSetup.phoneStatus = status;
      await workspace.save();

      console.log(`[Webhook] Phone quality updated: ${quality_rating}`);
    }
  } catch (error) {
    console.error('Error handling phone quality update:', error);
  }
}

// Handler: Business verification update
async function handleBusinessVerificationUpdate(value) {
  try {
    const { business_account_id, verification_status, is_verified } = value;

    // Find workspace with this business account
    const workspace = await Workspace.findOne({
      'businessAccountId': business_account_id
    });

    if (workspace) {
      workspace.businessVerification = workspace.businessVerification || {};
      workspace.businessVerification.status = is_verified ? 'verified' : verification_status;
      workspace.businessVerification.lastCheckedAt = new Date();
      await workspace.save();

      console.log(`[Webhook] Business verification: ${is_verified ? 'VERIFIED' : verification_status}`);
    }
  } catch (error) {
    console.error('Error handling business verification update:', error);
  }
}

// Handler: Message template status update
async function handleTemplateStatusUpdate(value) {
  try {
    const { template_name, template_id, status, rejection_reason } = value;

    // Handle template approval/rejection
    console.log(`[Webhook] Template "${template_name}" status: ${status}`);
    
    if (status === 'APPROVED') {
      // Template is ready to use
    } else if (status === 'REJECTED') {
      console.error(`[Webhook] Template rejected: ${rejection_reason}`);
    }
  } catch (error) {
    console.error('Error handling template status update:', error);
  }
}

module.exports = router;
```

---

## Frontend React Components

### Complete Onboarding Flow Component

```typescript
// components/WhatsAppOnboardingFlow.tsx

'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export default function WhatsAppOnboardingFlow() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    businessName: '',
    industry: 'RETAIL',
    email: '',
    phoneNumber: '',
    otpCode: '',
    about: 'Welcome to our business'
  });
  const [businessData, setBusinessData] = useState<any>(null);
  const [wabaData, setWabaData] = useState<any>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  const steps: OnboardingStep[] = [
    {
      id: 'meta_signup',
      title: 'Connect with Meta',
      description: 'Redirect to Meta to complete business signup',
      status: currentStep >= 0 ? (currentStep > 0 ? 'completed' : 'active') : 'pending'
    },
    {
      id: 'verify_business',
      title: 'Verify Business',
      description: 'Confirm your business details',
      status: currentStep >= 1 ? (currentStep > 1 ? 'completed' : 'active') : 'pending'
    },
    {
      id: 'register_phone',
      title: 'Register Phone',
      description: 'Add WhatsApp phone number',
      status: currentStep >= 2 ? (currentStep > 2 ? 'completed' : 'active') : 'pending'
    },
    {
      id: 'verify_otp',
      title: 'Verify OTP',
      description: 'Confirm with OTP code',
      status: currentStep >= 3 ? (currentStep > 3 ? 'completed' : 'active') : 'pending'
    },
    {
      id: 'system_user',
      title: 'Create System User',
      description: 'Generate API access token',
      status: currentStep >= 4 ? (currentStep > 4 ? 'completed' : 'active') : 'pending'
    },
    {
      id: 'activate_waba',
      title: 'Activate Account',
      description: 'Finalize setup and activation',
      status: currentStep >= 5 ? (currentStep > 5 ? 'completed' : 'active') : 'pending'
    }
  ];

  // Step 1: Start ESB
  const handleStartESB = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${apiUrl}/onboarding/esb/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setSuccess('Redirecting to Meta signup...');
        // Redirect to ESB URL
        setTimeout(() => {
          window.location.href = response.data.esbUrl;
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start ESB flow');
    } finally {
      setLoading(false);
    }
  };

  // Check if callback completed
  useEffect(() => {
    const checkCallbackStatus = async () => {
      try {
        const response = await axios.get(
          `${apiUrl}/onboarding/esb/status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data.esbStatus?.callbackReceived) {
          setCurrentStep(1);
          setBusinessData(response.data.esbStatus?.callbackData);
          setSuccess('Meta signup completed! Now verify your business.');
        }
      } catch (err) {
        // Status check failed, that's ok during ESB
      }
    };

    // Check every 3 seconds for callback
    const interval = setInterval(checkCallbackStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Step 2: Verify Business
  const handleVerifyBusiness = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${apiUrl}/onboarding/esb/verify-business`,
        {
          businessAccountId: businessData.businessAccounts[0]?.id,
          businessData: {
            businessName: formData.businessName,
            industry: formData.industry,
            email: businessData.email,
            timezone: 'Asia/Kolkata'
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setWabaData(response.data);
        setCurrentStep(2);
        setSuccess('Business verified successfully!');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to verify business');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Register Phone
  const handleRegisterPhone = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${apiUrl}/onboarding/esb/register-phone`,
        { phoneNumber: formData.phoneNumber },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setCurrentStep(3);
        setSuccess('Phone number registered! OTP sent via SMS.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register phone');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Verify OTP
  const handleVerifyOTP = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${apiUrl}/onboarding/esb/verify-otp`,
        { otpCode: formData.otpCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setCurrentStep(4);
        setSuccess('OTP verified! Creating system user...');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Create System User
  const handleCreateSystemUser = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${apiUrl}/onboarding/esb/create-system-user`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setCurrentStep(5);
        setSuccess('System user created! Finalizing setup...');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create system user');
    } finally {
      setLoading(false);
    }
  };

  // Step 6: Activate WABA
  const handleActivateWABA = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${apiUrl}/onboarding/esb/activate-waba`,
        {
          displayName: formData.businessName,
          about: formData.about
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setCurrentStep(6);
        setSuccess('🎉 Onboarding complete! Your WhatsApp Business is ready!');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to activate WABA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            WhatsApp Business Setup
          </h1>
          <p className="text-gray-600">
            Complete onboarding in {steps.length} simple steps
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex-1">
                <div
                  className={`h-2 rounded-full ${
                    step.status === 'completed'
                      ? 'bg-green-500'
                      : step.status === 'active'
                      ? 'bg-blue-500'
                      : 'bg-gray-200'
                  } ${index < steps.length - 1 ? 'mr-2' : ''}`}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {steps.map((step) => (
              <div key={step.id} className="text-center text-sm">
                <div
                  className={`font-semibold ${
                    step.status === 'completed'
                      ? 'text-green-600'
                      : step.status === 'active'
                      ? 'text-blue-600'
                      : 'text-gray-400'
                  }`}
                >
                  {step.title}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">❌ {error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">✅ {success}</p>
            </div>
          )}

          {/* Step 1: Meta Signup */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Step 1: Connect with Meta</h2>
              <p className="text-gray-600 mb-6">
                You'll be redirected to Meta to create your WhatsApp Business Account.
                This is secure and only takes a few minutes.
              </p>
              <button
                onClick={handleStartESB}
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
              >
                {loading ? 'Redirecting to Meta...' : 'Start Meta Signup'}
              </button>
            </div>
          )}

          {/* Step 2: Verify Business */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Step 2: Verify Business</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Business Name"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
                <select
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value="RETAIL">Retail</option>
                  <option value="SERVICES">Services</option>
                  <option value="RESTAURANT">Restaurant</option>
                  <option value="HEALTHCARE">Healthcare</option>
                  <option value="TECHNOLOGY">Technology</option>
                </select>
                <button
                  onClick={handleVerifyBusiness}
                  disabled={loading || !formData.businessName}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
                >
                  {loading ? 'Verifying...' : 'Verify Business'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Register Phone */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Step 3: Register Phone Number</h2>
              <p className="text-gray-600 mb-4">
                Enter the WhatsApp Business phone number. Include country code.
              </p>
              <div className="space-y-4">
                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={handleRegisterPhone}
                  disabled={loading || !formData.phoneNumber}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
                >
                  {loading ? 'Registering...' : 'Register & Send OTP'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Verify OTP */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Step 4: Verify OTP</h2>
              <p className="text-gray-600 mb-4">
                Enter the 6-digit code sent to your WhatsApp number.
              </p>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={formData.otpCode}
                  onChange={(e) => setFormData({ ...formData, otpCode: e.target.value.replace(/\D/g, '') })}
                  className="w-full p-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-mono"
                />
                <button
                  onClick={handleVerifyOTP}
                  disabled={loading || formData.otpCode.length !== 6}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
                >
                  {loading ? 'Verifying OTP...' : 'Verify OTP'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: System User */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Step 5: Create System User</h2>
              <p className="text-gray-600 mb-6">
                We're setting up API access for your WhatsApp Business Account.
              </p>
              <button
                onClick={handleCreateSystemUser}
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
              >
                {loading ? 'Creating...' : 'Create System User'}
              </button>
            </div>
          )}

          {/* Step 6: Activate WABA */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Step 6: Finalize Setup</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Display Name"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
                <textarea
                  placeholder="About message (shown to customers)"
                  value={formData.about}
                  onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  rows={3}
                />
                <button
                  onClick={handleActivateWABA}
                  disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
                >
                  {loading ? 'Activating...' : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}

          {/* Completion */}
          {currentStep === 6 && (
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold mb-2">All Set!</h2>
              <p className="text-gray-600 mb-8">
                Your WhatsApp Business Account is ready to use. You can now start sending messages!
              </p>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          <p>Need help? <a href="/support" className="text-blue-600 hover:underline">Contact support</a></p>
        </div>
      </div>
    </div>
  );
}
```

---

## API Integration Examples

### Node.js/Express Integration

```javascript
// services/whatsappService.js - Use after onboarding is complete

const axios = require('axios');

class WhatsAppService {
  constructor(accessToken, phoneNumberId, wabaId) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.wabaId = wabaId;
    this.baseUrl = 'https://graph.facebook.com/v21.0';
  }

  async sendMessage(to, message) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0]?.id
      };
    } catch (error) {
      console.error('Send message error:', error.response?.data);
      throw error;
    }
  }

  async createTemplate(name, language, category, components) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.wabaId}/message_templates`,
        {
          name,
          language,
          category,
          components
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        templateId: response.data.id
      };
    } catch (error) {
      console.error('Create template error:', error.response?.data);
      throw error;
    }
  }

  async getPhoneNumbers() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.wabaId}/phone_numbers`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      return {
        success: true,
        phoneNumbers: response.data.data
      };
    } catch (error) {
      console.error('Get phone numbers error:', error.response?.data);
      throw error;
    }
  }
}

module.exports = WhatsAppService;
```

### Usage Example

```javascript
// controllers/messageController.js

const WhatsAppService = require('../services/whatsappService');
const Workspace = require('../models/Workspace');

async function sendWhatsAppMessage(req, res) {
  try {
    const { phoneNumber, message } = req.body;
    const user = await require('../models/User').findById(req.user._id);
    const workspace = await Workspace.findById(user.workspace);

    // Use system user token from ESB completion
    const whatsappService = new WhatsAppService(
      workspace.whatsappAccessToken, // This is the system user token
      workspace.whatsappPhoneNumberId,
      workspace.wabaId
    );

    const result = await whatsappService.sendMessage(phoneNumber, message);

    res.json({
      success: true,
      messageId: result.messageId
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = { sendWhatsAppMessage };
```

---

## Error Handling

### Comprehensive Error Handler

```typescript
// utils/errorHandler.ts

export interface APIError {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
}

export const ErrorCodes = {
  // Authentication
  INVALID_TOKEN: 'invalid_token',
  TOKEN_EXPIRED: 'token_expired',
  
  // ESB Flow
  STATE_MISMATCH: 'state_mismatch',
  INVALID_CODE: 'invalid_code',
  
  // Phone Registration
  PHONE_INVALID_FORMAT: 'phone_invalid_format',
  PHONE_NOT_WHITELISTED: 'phone_not_whitelisted',
  
  // OTP
  OTP_INVALID: 'otp_invalid',
  OTP_EXPIRED: 'otp_expired',
  OTP_ATTEMPTS_EXCEEDED: 'otp_attempts_exceeded',
  
  // Business
  BUSINESS_UNVERIFIED: 'business_unverified',
  WABA_NOT_FOUND: 'waba_not_found',
  
  // System
  NETWORK_ERROR: 'network_error',
  RATE_LIMITED: 'rate_limited'
};

export function parseError(error: any): APIError {
  // Parse Meta API errors
  if (error.response?.data?.error) {
    const metaError = error.response.data.error;
    
    if (metaError.code === 190) {
      return {
        code: ErrorCodes.TOKEN_EXPIRED,
        message: 'Your access token has expired. Please re-authenticate.',
        statusCode: 401,
        retryable: false
      };
    }
    
    if (metaError.code === 400) {
      if (metaError.message.includes('phone')) {
        return {
          code: ErrorCodes.PHONE_INVALID_FORMAT,
          message: 'Phone number format is invalid. Use +country_code format.',
          statusCode: 400,
          retryable: false
        };
      }
    }
  }

  // Network errors (retryable)
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Network connection failed. Please try again.',
      statusCode: 503,
      retryable: true
    };
  }

  // Default error
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'An unknown error occurred',
    statusCode: error.response?.status || 500,
    retryable: false
  };
}

export function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    [ErrorCodes.INVALID_TOKEN]: 'Your session has expired. Please log in again.',
    [ErrorCodes.TOKEN_EXPIRED]: 'Token expired. Please re-authenticate.',
    [ErrorCodes.STATE_MISMATCH]: 'Security verification failed. Please try again.',
    [ErrorCodes.OTP_INVALID]: 'Invalid OTP. Please check and try again.',
    [ErrorCodes.OTP_EXPIRED]: 'OTP has expired. Request a new one.',
    [ErrorCodes.OTP_ATTEMPTS_EXCEEDED]: 'Too many attempts. Request a new OTP.',
    [ErrorCodes.PHONE_INVALID_FORMAT]: 'Phone number format is invalid.',
    [ErrorCodes.PHONE_NOT_WHITELISTED]: 'This phone number is not authorized.',
    [ErrorCodes.BUSINESS_UNVERIFIED]: 'Business account not verified yet. Try again later.',
    [ErrorCodes.WABA_NOT_FOUND]: 'WhatsApp Business Account not found.',
    [ErrorCodes.NETWORK_ERROR]: 'Network error. Please check your connection.',
    [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please wait a moment.'
  };

  return messages[code] || 'An error occurred. Please try again.';
}
```

### React Hook for Error Handling

```typescript
// hooks/useESBFlow.ts

import { useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { parseError, APIError, getErrorMessage } from '../utils/errorHandler';

export function useESBFlow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<APIError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleError = useCallback((err: unknown) => {
    const parsed = parseError(err);
    setError(parsed);
    
    // Auto-retry if retryable
    if (parsed.retryable) {
      console.log('Error is retryable, will retry...');
    }
    
    return parsed;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearSuccess = useCallback(() => {
    setSuccess(null);
  }, []);

  return {
    loading,
    setLoading,
    error,
    setError,
    handleError,
    clearError,
    success,
    setSuccess,
    clearSuccess,
    errorMessage: error ? getErrorMessage(error.code) : null
  };
}
```

---

## Webhook Handlers

### Register Webhook Routes

```javascript
// routes/webhooks.js

const express = require('express');
const router = express.Router();
const webhookHandler = require('../webhooks/metaWebhookHandler');

// Verify webhook (GET)
router.get('/webhook', webhookHandler.verifyWebhook);

// Handle webhook events (POST)
router.post('/webhook', webhookHandler.handleWebhook);

module.exports = router;
```

### Main Server Configuration

```javascript
// server.js

const express = require('express');
const webhookRoutes = require('./routes/webhooks');

const app = express();

// Raw body parser for webhook signature verification
app.use(express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json());

// Mount webhook routes
app.use('/api/webhooks', webhookRoutes);

// Other routes...

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook URL: ${process.env.APP_URL}/api/webhooks/webhook`);
});
```

---

## Complete Usage Example

```javascript
// Full example: Setup and send message

// 1. User completes ESB onboarding
// → Workspace has systemUserToken, wabaId, phoneNumberId

// 2. Get workspace and create WhatsApp service
const workspace = await Workspace.findById(userId.workspace);
const wa = new WhatsAppService(
  workspace.whatsappAccessToken, // System user token
  workspace.whatsappPhoneNumberId,
  workspace.wabaId
);

// 3. Send message
const result = await wa.sendMessage(
  '+919876543210',
  'Hello! This is your first WhatsApp message'
);

// 4. Create template
const template = await wa.createTemplate(
  'order_confirmation',
  'en',
  'MARKETING',
  [{
    type: 'BODY',
    text: 'Your order {{1}} is confirmed. Total: {{2}}'
  }]
);

// Done! 🎉
```

---

This completes the full implementation guide with working code examples!
