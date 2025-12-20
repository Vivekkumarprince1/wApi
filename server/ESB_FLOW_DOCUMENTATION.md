# Complete WhatsApp Business API SaaS Onboarding - ESB Flow Documentation

## Overview

This document provides complete working examples for the **Embedded Signup Business (ESB) Flow** - a fully automated Meta WhatsApp Business API onboarding system. Users can onboard without manually handling Meta assets like WABA ID, phone numbers, access tokens, or business verification.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ User Signs Up on Your Platform                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Step 1: Start ESB Flow (Your App → Meta OAuth)              │
│ GET https://business.instagram.com/ia/sign_up/              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼ (User completes signup in Meta dialog)
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Step 2: Handle Callback (Meta → Your Backend)               │
│ GET /api/onboarding/esb/callback?code=...&state=...         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Step 3: Exchange Code for Token (Backend → Meta API)         │
│ GET /oauth/access_token?client_id=...&code=...              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Step 4: Verify Business & Get/Create WABA                   │
│ POST /{businessAccountId} - Update business info            │
│ GET /{businessAccountId}/owned_whatsapp_business_accounts   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Step 5: Register WhatsApp Number with OTP                   │
│ POST /{wabaId}/phone_numbers - Register phone               │
│ POST /{phoneNumberId}/request_code - Send OTP               │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Step 6: Verify OTP Code                                     │
│ POST /{phoneNumberId}/verify_code - Confirm OTP             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Step 7: Create System User for API Access                   │
│ POST /{businessAccountId}/system_users - Create system user │
│ POST /{systemUserId}/system_user_access_tokens - Get token  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ Step 8: Activate WABA with Settings                         │
│ POST /{wabaId} - Update WABA settings (name, about, etc)    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ ✅ Onboarding Complete                                      │
│ User has fully automated WhatsApp Business Account          │
│ Can now send messages immediately                           │
└─────────────────────────────────────────────────────────────┘
```

## Environment Variables Required

Add these to your `.env` file:

```bash
# Meta App Credentials
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_BUSINESS_ID=your_business_id_here

# ESB Configuration
META_CONFIG_ID=your_esb_config_id_here  # Generate in Meta Business Suite

# For fallback system (if needed)
META_WABA_ID=your_parent_waba_id_here
META_PHONE_NUMBER_ID=your_phone_number_id_here
META_ACCESS_TOKEN=your_permanent_access_token_here
META_VERIFY_TOKEN=webhook_verify_token_here

# App URL
APP_URL=https://yourapp.com  # Used for ESB callback URL
```

## API Endpoints

### 1. START EMBEDDED SIGNUP FLOW

**Endpoint:** `POST /api/onboarding/esb/start`

**Purpose:** Generate the ESB URL that redirects user to Meta for business signup

**Authentication:** Required (Bearer token)

**Request:**
```bash
curl -X POST https://yourapp.com/api/onboarding/esb/start \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "ESB flow initiated",
  "esbUrl": "https://business.instagram.com/ia/sign_up/?client_id=YOUR_APP_ID&config_id=YOUR_CONFIG_ID&state=abc123xyz&redirect_uri=https://yourapp.com/api/onboarding/esb/callback",
  "state": "abc123xyz",
  "configId": "YOUR_CONFIG_ID"
}
```

**Frontend Usage:**
```javascript
// In your React/Vue/Angular app
const response = await fetch('/api/onboarding/esb/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
if (data.success) {
  // Redirect user to ESB URL
  window.location.href = data.esbUrl;
}
```

---

### 2. HANDLE OAUTH CALLBACK

**Endpoint:** `GET /api/onboarding/esb/callback`

**Purpose:** Meta redirects here after user completes signup. Exchanges authorization code for access token.

**Query Parameters:**
- `code` - Authorization code from Meta
- `state` - State parameter for CSRF protection

**Note:** This endpoint is called directly by Meta (server-to-server). The user is then redirected back to your frontend.

**Response (if successful):**
```json
{
  "success": true,
  "message": "Authorization successful",
  "userInfo": {
    "id": "user_id_from_meta",
    "name": "Business Owner Name",
    "email": "owner@business.com",
    "businessAccounts": [
      {
        "id": "business_account_id",
        "name": "My Business"
      }
    ],
    "wabaAccounts": [
      {
        "id": "waba_id_123",
        "name": "My WhatsApp Business Account",
        "businessId": "business_account_id"
      }
    ],
    "phoneNumbers": []
  },
  "nextStep": "verify_business"
}
```

---

### 3. VERIFY BUSINESS & GET WABA

**Endpoint:** `POST /api/onboarding/esb/verify-business`

**Purpose:** Verify business account and ensure WABA exists (create if needed)

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "businessAccountId": "business_account_id_from_callback",
  "businessData": {
    "businessName": "Your Business Name",
    "industry": "RETAIL",
    "email": "owner@business.com",
    "timezone": "Asia/Kolkata",
    "website": "https://yourwebsite.com"
  }
}
```

**cURL Example:**
```bash
curl -X POST https://yourapp.com/api/onboarding/esb/verify-business \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessAccountId": "12345",
    "businessData": {
      "businessName": "Acme Corp",
      "industry": "RETAIL",
      "email": "admin@acmecorp.com",
      "timezone": "Asia/Kolkata"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Business verified successfully",
  "businessAccountId": "12345",
  "wabaId": "waba_123456",
  "nextStep": "register_phone"
}
```

---

### 4. REGISTER PHONE NUMBER & SEND OTP

**Endpoint:** `POST /api/onboarding/esb/register-phone`

**Purpose:** Register WhatsApp number and initiate OTP verification

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "phoneNumber": "+919876543210"
}
```

**cURL Example:**
```bash
curl -X POST https://yourapp.com/api/onboarding/esb/register-phone \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+919876543210"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number registered. OTP sent via SMS.",
  "phoneNumberId": "phone_number_id_123",
  "displayNumber": "919876543210",
  "expiresIn": 600,
  "nextStep": "verify_otp"
}
```

**How it works:**
1. Meta sends OTP via SMS to the phone number
2. OTP is valid for 10 minutes
3. User receives SMS with 6-digit code

---

### 5. VERIFY PHONE OTP

**Endpoint:** `POST /api/onboarding/esb/verify-otp`

**Purpose:** Verify the OTP code sent to WhatsApp number

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "otpCode": "123456"
}
```

**cURL Example:**
```bash
curl -X POST https://yourapp.com/api/onboarding/esb/verify-otp \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "otpCode": "123456"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number verified successfully",
  "phoneNumberId": "phone_number_id_123",
  "displayPhone": "+919876543210",
  "verifiedName": "Acme Corp",
  "nextStep": "create_system_user"
}
```

**Error Response (if OTP is wrong):**
```json
{
  "success": false,
  "message": "Invalid OTP",
  "attemptsRemaining": 4
}
```

---

### 6. CREATE SYSTEM USER & GENERATE TOKEN

**Endpoint:** `POST /api/onboarding/esb/create-system-user`

**Purpose:** Create a system user in Meta Business that can generate long-lived API tokens

**Authentication:** Required (Bearer token)

**Request Body:** (empty, uses workspace data)
```json
{}
```

**cURL Example:**
```bash
curl -X POST https://yourapp.com/api/onboarding/esb/create-system-user \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**
```json
{
  "success": true,
  "message": "System user created and token generated",
  "systemUserId": "system_user_id_123",
  "systemUserToken": "EAABpZCDI5x0BANA...very_long_token",
  "expiresIn": 5184000,
  "nextStep": "activate_waba"
}
```

**What is System User Token?**
- 60-day validity (longest available)
- Can be stored securely on your backend
- Used for sending messages, managing templates, etc.
- Not dependent on user's Meta password

---

### 7. ACTIVATE WABA & COMPLETE ONBOARDING

**Endpoint:** `POST /api/onboarding/esb/activate-waba`

**Purpose:** Finalize WABA setup, configure settings, complete onboarding

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "displayName": "Acme Corp WhatsApp",
  "about": "Welcome to Acme Corp. We're here to help!"
}
```

**cURL Example:**
```bash
curl -X POST https://yourapp.com/api/onboarding/esb/activate-waba \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Acme Corp",
    "about": "Welcome to Acme Corp!"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "WABA activated successfully. Onboarding complete!",
  "wabaStatus": {
    "success": true,
    "wabaId": "waba_123456",
    "settings": {
      "name": "Acme Corp WhatsApp",
      "about": "Welcome to Acme Corp. We're here to help!",
      "website": "https://acmecorp.com",
      "vertical": "RETAIL"
    },
    "status": "active"
  },
  "onboardingStatus": {
    "success": true,
    "business": {
      "id": "biz_123456",
      "name": "Acme Corp",
      "verificationStatus": "verified",
      "isVerified": true
    },
    "waba": {
      "id": "waba_123456",
      "name": "Acme Corp WhatsApp",
      "status": "CONNECTED",
      "currency": "USD"
    },
    "phoneNumbers": [
      {
        "id": "phone_123456",
        "display_phone_number": "+919876543210",
        "verified_name": "Acme Corp",
        "quality_rating": "GREEN",
        "status": "CONNECTED"
      }
    ],
    "ready": true
  },
  "phoneNumbers": [...],
  "ready": true
}
```

---

### 8. GET ESB STATUS

**Endpoint:** `GET /api/onboarding/esb/status`

**Purpose:** Get current onboarding status at any time

**Authentication:** Required (Bearer token)

**Request:**
```bash
curl -X GET https://yourapp.com/api/onboarding/esb/status \
  -H "Authorization: Bearer USER_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "esbStatus": {
    "status": "waba_activated",
    "startedAt": "2025-01-15T10:30:00Z",
    "completedAt": "2025-01-15T10:45:00Z",
    "createdBy": "user@example.com"
  },
  "wabaInfo": {
    "wabaId": "waba_123456",
    "businessAccountId": "biz_123456",
    "phoneNumberId": "phone_123456",
    "phoneNumber": "+919876543210",
    "connectedAt": "2025-01-15T10:45:00Z"
  },
  "onboarding": {
    "businessInfoCompleted": true,
    "wabaConnectionCompleted": true,
    "completed": true,
    "completedAt": "2025-01-15T10:45:00Z"
  }
}
```

---

## Complete Frontend Flow Example

### React Implementation

```javascript
// pages/onboarding/whatsapp.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function WhatsAppOnboarding() {
  const [step, setStep] = useState('start'); // start, verify_business, register_phone, otp, system_user, activate, done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    businessName: '',
    industry: 'RETAIL',
    phoneNumber: '',
    otpCode: ''
  });
  const [response, setResponse] = useState(null);

  const token = localStorage.getItem('authToken');

  // Step 1: Start ESB Flow
  const handleStartESB = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.post('/api/onboarding/esb/start', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        // Redirect to Meta ESB
        window.location.href = res.data.esbUrl;
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start ESB');
    } finally {
      setLoading(false);
    }
  };

  // After callback, verify business
  const handleVerifyBusiness = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First, get callback data
      const statusRes = await axios.get('/api/onboarding/esb/status', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const callbackData = statusRes.data.esbStatus?.callbackData;
      if (!callbackData?.businessAccounts?.length) {
        throw new Error('No business account found. Please complete ESB signup.');
      }

      const bizId = callbackData.businessAccounts[0].id;

      // Verify business
      const res = await axios.post('/api/onboarding/esb/verify-business', {
        businessAccountId: bizId,
        businessData: {
          businessName: data.businessName,
          industry: data.industry,
          email: callbackData.email,
          timezone: 'Asia/Kolkata'
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setResponse(res.data);
        setStep('register_phone');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify business');
    } finally {
      setLoading(false);
    }
  };

  // Register phone and send OTP
  const handleRegisterPhone = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.post('/api/onboarding/esb/register-phone', {
        phoneNumber: data.phoneNumber
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setResponse(res.data);
        setStep('otp');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register phone');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.post('/api/onboarding/esb/verify-otp', {
        otpCode: data.otpCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setResponse(res.data);
        setStep('system_user');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Create system user
  const handleCreateSystemUser = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.post('/api/onboarding/esb/create-system-user', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setResponse(res.data);
        setStep('activate');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create system user');
    } finally {
      setLoading(false);
    }
  };

  // Activate WABA
  const handleActivateWABA = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.post('/api/onboarding/esb/activate-waba', {
        displayName: data.businessName,
        about: 'Welcome to our business'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setResponse(res.data);
        setStep('done');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate WABA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">WhatsApp Business Onboarding</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {step === 'start' && (
        <div>
          <p className="text-gray-600 mb-4">Click below to complete WhatsApp Business signup with Meta</p>
          <button
            onClick={handleStartESB}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Starting...' : 'Start WhatsApp Signup'}
          </button>
        </div>
      )}

      {step === 'verify_business' && (
        <div>
          <input
            type="text"
            placeholder="Business Name"
            value={data.businessName}
            onChange={(e) => setData({ ...data, businessName: e.target.value })}
            className="w-full mb-3 p-2 border rounded"
          />
          <select
            value={data.industry}
            onChange={(e) => setData({ ...data, industry: e.target.value })}
            className="w-full mb-4 p-2 border rounded"
          >
            <option value="RETAIL">Retail</option>
            <option value="SERVICES">Services</option>
            <option value="RESTAURANT">Restaurant</option>
            <option value="HEALTHCARE">Healthcare</option>
          </select>
          <button
            onClick={handleVerifyBusiness}
            disabled={loading || !data.businessName}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Verifying...' : 'Verify Business'}
          </button>
        </div>
      )}

      {step === 'register_phone' && (
        <div>
          <input
            type="tel"
            placeholder="Phone Number (+919876543210)"
            value={data.phoneNumber}
            onChange={(e) => setData({ ...data, phoneNumber: e.target.value })}
            className="w-full mb-4 p-2 border rounded"
          />
          <button
            onClick={handleRegisterPhone}
            disabled={loading || !data.phoneNumber}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Registering...' : 'Register & Send OTP'}
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div>
          <p className="text-gray-600 mb-4">Enter the OTP sent to your phone</p>
          <input
            type="text"
            placeholder="6-digit OTP"
            maxLength="6"
            value={data.otpCode}
            onChange={(e) => setData({ ...data, otpCode: e.target.value.replace(/\D/g, '') })}
            className="w-full mb-4 p-2 border rounded text-center text-2xl tracking-widest"
          />
          <button
            onClick={handleVerifyOTP}
            disabled={loading || data.otpCode.length !== 6}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </div>
      )}

      {step === 'system_user' && (
        <div>
          <p className="text-gray-600 mb-4">Creating system user for API access...</p>
          <button
            onClick={handleCreateSystemUser}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Creating...' : 'Continue'}
          </button>
        </div>
      )}

      {step === 'activate' && (
        <div>
          <p className="text-gray-600 mb-4">Activating your WhatsApp Business Account...</p>
          <button
            onClick={handleActivateWABA}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Activating...' : 'Complete Setup'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-4">Onboarding Complete!</h2>
          <p className="text-gray-600 mb-6">Your WhatsApp Business Account is ready to use.</p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          >
            Go to Dashboard
          </button>
        </div>
      )}

      {response && (
        <div className="mt-6 p-4 bg-gray-100 rounded text-sm">
          <p className="font-bold mb-2">Status:</p>
          <pre className="overflow-auto max-h-40 text-xs">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

---

## Error Handling & Edge Cases

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Token_Expired` | Access token is expired | Call `/esb/refresh-token` or restart flow |
| `State_Mismatch` | CSRF attack suspected | Restart ESB flow |
| `OTP_Expired` | User took too long | Call `/esb/register-phone` again to get new OTP |
| `Invalid_OTP` | Wrong code entered | User has 5 attempts, then must request new OTP |
| `Phone_Not_In_Whitelist` | Test account restriction | Add number to Meta test account whitelist |
| `Business_Unverified` | Business verification pending | Wait 24-48 hours or manually verify in Meta |

---

## Security Best Practices

1. **State Parameter Verification:** Always verify the state parameter in callback to prevent CSRF attacks
2. **Token Storage:** Store system user tokens in secure backend database, never in frontend
3. **HTTPS Only:** Always use HTTPS for callback URLs
4. **Rate Limiting:** Implement rate limiting on OTP verification endpoints
5. **Audit Logging:** Log all onboarding events for compliance
6. **Permission Scoping:** System users have specific permissions, follow principle of least privilege

---

## Testing & Development

### Using Meta Test Account

```bash
# 1. Add test phone number to whitelist in Meta App Dashboard
# 2. Use test OTP when required
# 3. Test in development mode:

APP_URL=http://localhost:3000
NODE_ENV=development
```

### Testing without Meta Integration

```javascript
// metaAutomationService.js - Development bypass
if (process.env.NODE_ENV === 'development' && code === 'TEST_CODE') {
  // Return mock data for testing
  return {
    accessToken: 'mock_token_' + Date.now(),
    userInfo: { ... }
  };
}
```

---

## Database Schema

The Workspace model now includes the `esbFlow` object:

```javascript
esbFlow: {
  status: String, // not_started, signup_initiated, token_exchanged, ...
  authState: String,
  authCode: String,
  userAccessToken: String,
  userRefreshToken: String,
  systemUserId: String,
  systemUserToken: String,
  phoneNumberIdForOTP: String,
  phoneOTPCode: String,
  phoneOTPVerifiedAt: Date,
  callbackReceived: Boolean,
  startedAt: Date,
  completedAt: Date,
  failureReason: String
}
```

---

## Deployment Checklist

- [ ] Set all required environment variables
- [ ] Update `APP_URL` to production domain
- [ ] Generate ESB Config ID in Meta Business Suite
- [ ] Configure webhook callback endpoint
- [ ] Set up SSL/HTTPS certificate
- [ ] Test complete flow end-to-end
- [ ] Configure error monitoring/logging
- [ ] Set up database backups
- [ ] Document support process for failed onboardings
- [ ] Train support team on troubleshooting

---

## Support & Troubleshooting

If onboarding fails:

1. Check `/api/onboarding/esb/status` for current state
2. Review server logs for API errors
3. Verify all Meta API credentials
4. Ensure phone number is in correct format
5. Contact Meta support if business verification is stuck

