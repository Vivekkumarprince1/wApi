# BSP WABA Configuration Issue & Resolution

## Problem

Template submission is failing with:
```
Error: Unsupported post request. Object with ID '955699277123809' does not exist, 
cannot be loaded due to missing permissions, or does not support this operation.
```

## Root Cause

Diagnostic Results Show:
- ✅ System user token is **valid**
- ✅ Token can make API calls
- ❌ **No WABAs are accessible** with this token
- ❌ **WABA ID `955699277123809` is not accessible**

This means the system user has not been granted access to any WABAs, or the WABA ID is incorrect.

---

## Solution

### Step 1: Verify WABA ID and Get Correct One

The WABA ID might be incorrect. To find your correct WABA ID:

#### Option A: Via Meta Business Manager (Recommended)
1. Go to https://business.facebook.com
2. Select your Business Account
3. Go to **Settings** → **WhatsApp Accounts**
4. Copy the **WhatsApp Business Account ID** (not the phone number ID)

#### Option B: Via Graph API (If you have correct token)
```bash
curl -G https://graph.facebook.com/v21.0/{BUSINESS_ID}/owned_whatsapp_business_accounts \
  -d "access_token={YOUR_TOKEN}"
```

Replace:
- `{BUSINESS_ID}` = Your Meta Business ID (789846416555877)
- `{YOUR_TOKEN}` = Your system user token

### Step 2: Configure System User Properly

The system user token must have explicit access to the WABA. Follow these steps:

1. **Go to Business Manager**
   - https://business.facebook.com

2. **Go to Settings → System Users**
   - Click the system user that owns the token

3. **Assign Assets**
   - Click "Assign Assets"
   - Select your WhatsApp Business Account
   - Grant these roles:
     - ✅ Manage WhatsApp business
     - ✅ Manage WhatsApp messaging

4. **Generate New Token**
   - Click the system user
   - Click "Generate New Token"
   - Select the app
   - Grant scopes:
     - ✅ `whatsapp_business_management`
     - ✅ `whatsapp_business_messaging`
   - Copy the token

### Step 3: Update .env

Replace your `.env` values with the correct WABA ID and token:

```bash
# Get the correct WABA ID from Business Manager
# The one that shows in: Settings → WhatsApp Accounts
BSP_WABA_ID=YOUR_CORRECT_WABA_ID

# Use the newly generated system user token with proper permissions
# From: System Users → Generate Token
BSP_SYSTEM_USER_TOKEN=YOUR_NEW_SYSTEM_USER_TOKEN

BSP_BUSINESS_ID=789846416555877
BSP_WEBHOOK_VERIFY_TOKEN=your-webhook-verify-token-151
```

### Step 4: Verify Configuration

Run the diagnostic again to verify:

```bash
cd /Users/vivek/Desktop/wApi/server
node diagnostics/bsp-meta-api-diagnostics.js
```

Expected output:
```
✅ Token is valid
✅ WABA is accessible
✅ Phone Numbers found
✅ Template endpoint is accessible
✅ Template submission successful
```

---

## Quick Checklist

- [ ] WABA ID verified in Business Manager
- [ ] System user assigned to WhatsApp account
- [ ] System user has "Manage WhatsApp business" role
- [ ] System user has "Manage WhatsApp messaging" role
- [ ] New token generated with correct scopes
- [ ] `.env` updated with new token and WABA ID
- [ ] Diagnostic passes all tests
- [ ] Server restarted

---

## Testing After Fix

Once the diagnostic passes, test the full flow:

```bash
# 1. Create a template
POST /api/v1/templates
{
  "name": "test_template",
  "category": "MARKETING",
  "language": "en",
  "components": [
    {
      "type": "BODY",
      "text": "Hello {{1}}"
    }
  ]
}

# 2. Submit template (should now succeed)
POST /api/v1/templates/{id}/submit

# Expected: 200 OK with template submitted message
```

---

## Reference: System User Setup in Business Manager

### Navigate to System Users
```
Business Manager Home
  → Settings (bottom left)
    → Users and Permissions
      → System Users
```

### Create New System User (if needed)
1. Click "Create System User"
2. Name: `whatsapp-bsp-system-user`
3. Role: `Admin`
4. Click "Create"

### Assign WhatsApp Account Access
1. Click the system user
2. Click "Assign Assets"
3. Under "Owned WhatsApp Business Accounts":
   - Select your WhatsApp account
   - Select roles:
     - ✅ Manage WhatsApp business
     - ✅ Manage WhatsApp messaging
4. Click "Assign"

### Generate Token
1. In the system user details page
2. Look for "Access Tokens" section
3. Click "Generate Token"
4. Select the app (usually your WhatsApp integration app)
5. Select token expiration (or no expiration)
6. Select scopes:
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_messaging`
   - ✅ `business_management` (optional but recommended)
7. Click "Generate Token"
8. Copy the token (you won't see it again)

---

## Meta API Documentation

- [System Users](https://developers.facebook.com/docs/business-platform/system-users)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api/reference)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/message-templates)
- [Token Management](https://developers.facebook.com/docs/facebook-login/access-tokens)

---

## Troubleshooting

### "Object with ID does not exist"
- ❌ WABA ID is incorrect
- ❌ WABA has been deleted
- ❌ WABA is in a different Business Account

**Fix:** Verify WABA ID in Business Manager

### "Cannot be loaded due to missing permissions"
- ❌ System user not assigned to WABA
- ❌ System user missing required roles
- ❌ Token expired or revoked

**Fix:** Re-assign system user to WABA with required roles

### "Unsupported post request"
- ❌ Endpoint not available for this token
- ❌ WABA doesn't support this feature (likely an API version issue)

**Fix:** Check WABA is properly set up for WhatsApp Business API

---

## Advanced: Using Correct Token Instead of System User

If you have an app-level access token that works better, you can modify the config to use it:

```javascript
// In bspConfig.js
systemUserToken: process.env.BSP_SYSTEM_USER_TOKEN || process.env.META_ACCESS_TOKEN
```

But **system user tokens are recommended** for production BSP setups because:
- ✅ Long-lived (don't expire like user tokens)
- ✅ Tied to system user role, not personal user
- ✅ Better audit trail
- ✅ Can be rotated without user login
