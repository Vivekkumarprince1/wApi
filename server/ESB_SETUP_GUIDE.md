# Meta WhatsApp Business API - ESB Setup & Configuration Guide

## Quick Setup Summary

This guide walks you through setting up a fully automated WhatsApp Business API SaaS platform using Meta's Embedded Signup Business (ESB) flow.

**What you'll get:**
- Users can onboard WhatsApp Business with Zero Manual Setup
- Automated phone number registration with OTP verification
- Automatic business account creation under your parent WABA
- System user tokens for backend API access
- Complete WABA activation in 7-10 minutes

---

## Part 1: Meta App Setup

### Step 1.1: Create Meta App (if not exists)

1. Go to [Meta Developers](https://developers.facebook.com)
2. Click "My Apps" → "Create App"
3. Choose "Business" app type
4. Fill in app details:
   - App Name: "WhatsApp SaaS Platform"
   - App Contact Email: your@email.com
   - App Purpose: Communication & Messaging

### Step 1.2: Get App ID & Secret

1. In App Dashboard → Settings → Basic
2. Copy:
   - **App ID**: `META_APP_ID`
   - **App Secret**: `META_APP_SECRET`

### Step 1.3: Add WhatsApp Business Product

1. Dashboard → "Add Product"
2. Search for "WhatsApp Business"
3. Click "Setup"
4. Agree to terms

### Step 1.4: Get Your Business ID

1. Go to [Meta Business Manager](https://business.facebook.com)
2. Click Settings (bottom left) → Business Settings
3. Copy **Business ID**: `META_BUSINESS_ID`

---

## Part 2: Embedded Signup Configuration

### Step 2.1: Create ESB Config

This config tells Meta what to ask users during signup.

1. Go to [Meta Business Manager](https://business.facebook.com)
2. Left menu → WhatsApp → Get Started (or Configuration)
3. Look for "Embedded Signup" section
4. Click "Create Configuration"
5. Fill form:
   - **Configuration Name**: "Default Signup"
   - **Accepted Features**: ✓ WhatsApp (select)
   - **Permissions**: Select all needed permissions

### Step 2.2: Copy ESB Config ID

After creating config:
1. Click on config name
2. Copy Config ID in URL or settings: `META_CONFIG_ID`

### Step 2.3: Set Redirect URIs

1. In ESB config settings
2. Add Redirect URIs:
   ```
   https://yourapp.com/api/onboarding/esb/callback
   http://localhost:5000/api/onboarding/esb/callback (for development)
   ```

---

## Part 3: Get Parent WABA Details (Optional but Recommended)

### Why? 
Parent WABA ID helps validate user's WABA is under your business structure.

### Getting Parent WABA ID

```bash
# Using Graph API
curl -X GET "https://graph.facebook.com/v21.0/YOUR_BUSINESS_ID/owned_whatsapp_business_accounts" \
  -H "Authorization: Bearer YOUR_PERMANENT_ACCESS_TOKEN"
```

Response:
```json
{
  "data": [
    {
      "id": "waba_123456789",  ← This is META_WABA_ID
      "name": "Your Main WhatsApp Account"
    }
  ]
}
```

### Get Phone Number ID (Optional)

```bash
# Get from first WABA
curl -X GET "https://graph.facebook.com/v21.0/waba_123456789/phone_numbers" \
  -H "Authorization: Bearer YOUR_PERMANENT_ACCESS_TOKEN"
```

Save this as `META_PHONE_NUMBER_ID`

### Get Permanent Access Token

1. Go to [Developers Page](https://developers.facebook.com/apps/YOUR_APP_ID/whatsapp-business-account/get-started)
2. In "Access Token" section
3. Click "Generate Token" 
4. Copy: `META_ACCESS_TOKEN`

---

## Part 4: .env Configuration

Create `.env` file in `/server` directory:

```bash
# ========== REQUIRED FOR ESB FLOW ==========

# Meta App Credentials
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_BUSINESS_ID=your_business_id_here

# ESB Configuration (get from Meta setup)
META_CONFIG_ID=your_esb_config_id_here

# ========== OPTIONAL BUT RECOMMENDED ==========

# Parent WABA (for validation)
META_WABA_ID=waba_123456789

# Fallback Phone Number (for system messages)
META_PHONE_NUMBER_ID=phone_number_id_123

# Permanent Access Token (for admin operations)
META_ACCESS_TOKEN=your_permanent_token_here

# Webhook Verification
META_VERIFY_TOKEN=random_string_for_webhook_verification

# ========== APPLICATION URLS ==========

# Production
APP_URL=https://yourapp.com

# Development
# APP_URL=http://localhost:3000

# ========== DATABASE & REDIS ==========

MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db_name
REDIS_URL=redis://localhost:6379

# ========== JWT & SECURITY ==========

JWT_SECRET=your_super_secret_jwt_key_here

# ========== ENVIRONMENT ==========

NODE_ENV=production
PORT=5000
```

---

## Part 5: Frontend Configuration

### Update your client `.env` file:

```bash
# .env.local (or .env)

NEXT_PUBLIC_API_URL=https://yourapp.com/api
NEXT_PUBLIC_ONBOARDING_FLOW=esb
NEXT_PUBLIC_META_BUSINESS_ID=your_business_id_here
```

### Frontend Setup Component

Create `components/WhatsAppESBOnboarding.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WhatsAppESBOnboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('start');

  const startESB = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/onboarding/esb/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        // Redirect to Meta ESB
        window.location.href = data.esbUrl;
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-6">Setup WhatsApp Business</h1>
        
        <p className="text-gray-600 text-center mb-8">
          Complete your WhatsApp Business Account setup in just a few minutes.
        </p>

        <button
          onClick={startESB}
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition"
        >
          {loading ? 'Starting...' : 'Start Setup with Meta'}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          You'll be redirected to Meta to complete the signup. This takes about 5-10 minutes.
        </p>
      </div>
    </div>
  );
}
```

---

## Part 6: Verify Setup

### Test ESB Start Endpoint

```bash
# Get auth token first
TOKEN="your_jwt_token_here"

# Test ESB start
curl -X POST http://localhost:5000/api/onboarding/esb/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Should return:
# {
#   "success": true,
#   "esbUrl": "https://business.instagram.com/ia/sign_up/...",
#   "state": "abc123xyz"
# }
```

### Test Configuration Check

```bash
# Verify all environment variables are set
curl http://localhost:5000/api/health

# Response should include Meta configuration status
```

---

## Part 7: Testing Flow

### Development Testing

1. **Start Server:**
   ```bash
   cd server
   npm run dev
   ```

2. **Start Client:**
   ```bash
   cd client
   npm run dev
   ```

3. **Test Signup:**
   - Go to http://localhost:3000/onboarding
   - Click "Start WhatsApp Setup"
   - You'll be redirected to Meta
   - Use test account credentials
   - Complete the signup
   - You'll be redirected back with callback

### Using Test Account

In Meta App:
1. Settings → Test Accounts
2. Create test business account
3. Add test phone number to whitelist
4. Use test number during onboarding

### Mock Testing (for development)

```javascript
// metaAutomationService.js - Add at top for development

if (process.env.NODE_ENV === 'development') {
  const MOCK_MODE = process.env.MOCK_META_FLOW === 'true';
  
  if (MOCK_MODE) {
    // Return mock data instead of calling Meta API
    console.log('🧪 Using mocked Meta API responses');
  }
}
```

---

## Part 8: Production Deployment

### Prerequisites

- SSL/HTTPS certificate ✓
- Production MongoDB ✓
- Production Redis ✓
- Meta app approved for production ✓

### Deployment Steps

1. **Update Environment:**
   ```bash
   # Set production URLs
   APP_URL=https://yourapp.com
   NODE_ENV=production
   ```

2. **Configure Meta Redirect URI:**
   - Go to Meta App settings
   - Add: `https://yourapp.com/api/onboarding/esb/callback`

3. **Deploy Backend:**
   ```bash
   git push origin main
   # Your CI/CD deploys to production
   ```

4. **Verify Deployment:**
   ```bash
   curl https://yourapp.com/api/onboarding/esb/status \
     -H "Authorization: Bearer TEST_TOKEN"
   ```

5. **Monitor:**
   - Set up error tracking (Sentry, etc.)
   - Monitor ESB flow completion rate
   - Track OTP verification success rate

---

## Part 9: Monitoring & Maintenance

### Key Metrics to Track

```javascript
// Add to your monitoring dashboard

// 1. ESB Flow Completion Rate
SELECT 
  COUNT(*) as total_started,
  COUNT(CASE WHEN status = 'waba_activated' THEN 1 END) as completed,
  ROUND(100.0 * COUNT(CASE WHEN status = 'waba_activated' THEN 1 END) / COUNT(*), 2) as completion_rate
FROM workspaces
WHERE esbFlow.startedAt > NOW() - INTERVAL 7 DAY;

// 2. Failure Points
SELECT 
  esbFlow.status,
  COUNT(*) as count,
  esbFlow.failureReason
FROM workspaces
WHERE esbFlow.status NOT IN ('waba_activated')
GROUP BY esbFlow.status;

// 3. Average Completion Time
SELECT 
  AVG(EXTRACT(EPOCH FROM (esbFlow.completedAt - esbFlow.startedAt))) as avg_seconds
FROM workspaces
WHERE esbFlow.status = 'waba_activated';
```

### Common Maintenance Tasks

1. **Token Refresh (Monthly):**
   ```bash
   # Check token expiry dates
   # Refresh system user tokens approaching expiry
   
   node scripts/refresh-tokens.js
   ```

2. **Verify WABA Status (Weekly):**
   ```bash
   node scripts/verify-waba-status.js
   ```

3. **Cleanup Failed Onboardings (Monthly):**
   ```bash
   node scripts/cleanup-failed-onboardings.js
   ```

---

## Troubleshooting

### Issue: "No ESB Config ID"

**Solution:**
1. Create ESB config in Meta Business Manager
2. Copy exact Config ID
3. Verify in .env: `META_CONFIG_ID=your_config_id`
4. Restart server

### Issue: "State Verification Failed"

**Solution:**
1. Check localStorage for state mismatch
2. Clear browser cookies
3. Start ESB flow again
4. Ensure APP_URL matches exactly

### Issue: "OTP Not Received"

**Solutions:**
1. Add number to test whitelist (if test account)
2. Wait 60 seconds before requesting new OTP
3. Check phone number format: `+919876543210`
4. Use SMS instead of voice (change code_method)

### Issue: "Business Verification Pending"

**Solution:**
1. This is normal - Meta verifies in 24-48 hours
2. You can still send messages
3. Check status: `GET /esb/status`
4. Check Meta Business Manager for issues

### Issue: "System User Token Expired"

**Solution:**
```bash
# System user tokens are valid for 60 days
# Before expiry, generate new token:

curl -X POST https://graph.facebook.com/v21.0/{systemUserId}/system_user_access_tokens \
  -H "Authorization: Bearer USER_ACCESS_TOKEN" \
  -d access_token_expiration_days=60
```

---

## API Reference Quick Links

- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Embedded Signup Business](https://developers.facebook.com/docs/whatsapp/business-platform/get-started/embedded-signup)
- [System Users & Tokens](https://developers.facebook.com/docs/business-sdk/system-users)
- [Phone Number Registration](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-number-management/phone-number-registration)

---

## Support & Resources

| Resource | Link |
|----------|------|
| Meta Documentation | https://developers.facebook.com/docs/whatsapp |
| Community Support | https://github.com/yourusername/waapi-saas/discussions |
| Issues | https://github.com/yourusername/waapi-saas/issues |
| Email Support | support@yourapp.com |

---

## Next Steps

1. ✅ Complete all configuration steps above
2. ✅ Test ESB flow in development
3. ✅ Deploy to production
4. ✅ Monitor onboarding flow
5. ✅ Scale to your users!

Happy building! 🚀
