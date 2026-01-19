# BSP (Business Solution Provider) Setup & Troubleshooting Guide

## Current Errors Analysis

### Error 1: POST /api/v1/templates/{id}/submit → 503 (Service Unavailable)
**Root Cause:** `bspConfig.isEnabled()` returns `false` because `BSP_SYSTEM_USER_TOKEN` is missing
```javascript
isEnabled() {
  return !!(this.parentWabaId && this.systemUserToken);
}
```

### Error 2: POST /api/v1/messages/template → 400 (Bad Request)
**Root Cause:** `workspace.bspManaged` is not set to `true` on the workspace
```javascript
if (!workspace.bspManaged) {
  return res.status(400).json({ 
    message: 'Workspace is not configured for WhatsApp. Please complete onboarding.',
    code: 'BSP_NOT_CONFIGURED'
  });
}
```

---

## Setup Checklist

### Step 1: ✅ Environment Variables (COMPLETED)
The `.env` file now includes:
```bash
BSP_WABA_ID=955699277123809                          # Your parent WABA ID
BSP_SYSTEM_USER_TOKEN=EAAXBlBX...                    # System user token
BSP_BUSINESS_ID=789846416555877                      # Meta Business ID
BSP_WEBHOOK_VERIFY_TOKEN=your-webhook-verify-token-151
META_API_VERSION=v21.0
```

**Status:** ✅ Configured with test credentials
**Production Note:** Update `BSP_SYSTEM_USER_TOKEN` with your dedicated system user token

---

### Step 2: Database Migration - Update Existing Workspaces
The BSP model requires workspaces to have `bspManaged: true` and `bspPhoneNumberId` assigned.

#### Option A: MongoDB CLI Update (Quick Test)
```javascript
db.workspaces.updateOne(
  { _id: ObjectId("694a7e483cb8ed372b487bdb") },  // Your workspace ID
  {
    $set: {
      bspManaged: true,
      bspWabaId: "955699277123809",
      bspPhoneNumberId: "942705445586408",
      bspDisplayPhoneNumber: "+1 555 162 5409",
      bspVerifiedName: "Your Business Name",
      bspPhoneStatus: "APPROVED",
      bspQualityRating: "GREEN",
      bspMessagingTier: "STANDARD",
      bspOnboardedAt: new Date(),
      "bspRateLimits.messagesPerSecond": 10,
      "bspRateLimits.dailyMessageLimit": 1000,
      "bspRateLimits.monthlyMessageLimit": 25000,
      "bspUsage.messagesThisSecond": 0,
      "bspUsage.messagesThisDay": 0,
      "bspUsage.messagesThisMonth": 0,
      "bspUsage.lastSecondReset": new Date(),
      "bspUsage.lastDayReset": new Date(),
      "bspUsage.lastMonthReset": new Date()
    }
  }
)
```

#### Option B: Create Migration Script
Create `/server/migrations/enable-bsp-workspaces.js`:
```javascript
const mongoose = require('mongoose');
const Workspace = require('../src/models/Workspace');

async function enableBSPForAllWorkspaces() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const workspaces = await Workspace.find({});
    console.log(`Found ${workspaces.length} workspaces to migrate`);
    
    for (const workspace of workspaces) {
      if (!workspace.bspManaged) {
        workspace.bspManaged = true;
        workspace.bspWabaId = process.env.BSP_WABA_ID;
        
        // Assign existing phone numbers to BSP
        if (workspace.whatsappPhoneNumberId) {
          workspace.bspPhoneNumberId = workspace.whatsappPhoneNumberId;
          workspace.bspDisplayPhoneNumber = workspace.displayPhoneNumber || '';
        }
        
        workspace.bspPhoneStatus = 'APPROVED';
        workspace.bspQualityRating = 'GREEN';
        workspace.bspMessagingTier = 'STANDARD';
        workspace.bspOnboardedAt = new Date();
        
        // Set rate limits based on plan
        const plan = workspace.plan || 'basic';
        workspace.bspRateLimits = {
          messagesPerSecond: { free: 1, basic: 10, premium: 50, enterprise: 200 }[plan],
          dailyMessageLimit: { free: 100, basic: 1000, premium: 10000, enterprise: 100000 }[plan],
          monthlyMessageLimit: { free: 1000, basic: 25000, premium: 250000, enterprise: 2500000 }[plan]
        };
        
        workspace.bspUsage = {
          messagesThisSecond: 0,
          messagesThisDay: 0,
          messagesThisMonth: 0,
          lastSecondReset: new Date(),
          lastDayReset: new Date(),
          lastMonthReset: new Date()
        };
        
        await workspace.save();
        console.log(`✅ Migrated workspace: ${workspace.name}`);
      }
    }
    
    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

enableBSPForAllWorkspaces();
```

Run with: `node migrations/enable-bsp-workspaces.js`

---

### Step 3: Admin API - Assign Phone Numbers
After migration, use the BSP admin APIs to manage workspace phones:

#### Assign Phone Number to Workspace
```bash
curl -X POST http://localhost:5001/api/v1/admin/bsp/assign-phone \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "694a7e483cb8ed372b487bdb",
    "phoneNumberId": "942705445586408",
    "displayPhoneNumber": "+1 555 162 5409",
    "verifiedName": "Your Business"
  }'
```

#### Get Workspace BSP Details
```bash
curl -X GET http://localhost:5001/api/v1/admin/bsp/tenants/694a7e483cb8ed372b487bdb \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### List All BSP Tenants
```bash
curl -X GET http://localhost:5001/api/v1/admin/bsp/tenants \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Verification Checklist

### ✅ Check 1: BSP Config is Enabled
```bash
# In server logs, you should see:
# ✅ BSP Configuration loaded successfully
# Parent WABA ID: 955699277123809
# API Version: v21.0
```

### ✅ Check 2: Workspace is BSP Managed
```javascript
// In MongoDB Compass or mongosh:
db.workspaces.findOne({ 
  _id: ObjectId("694a7e483cb8ed372b487bdb") 
}).bspManaged
// Should return: true
```

### ✅ Check 3: Template Submission Works
1. Create a template
2. POST `/api/v1/templates/{templateId}/submit`
3. Expected response:
```json
{
  "success": true,
  "message": "Template submitted to Meta for approval via BSP",
  "template": { ... },
  "metaTemplateName": "workspace_prefix_template_name"
}
```

### ✅ Check 4: Send Template Message
1. Ensure template is APPROVED
2. POST `/api/v1/messages/template` with:
```json
{
  "contactId": "...",
  "templateId": "...",
  "variables": [],
  "language": "en"
}
```
3. Expected response: 200 OK with message sent

---

## Environment Variables Reference

| Variable | Description | Example | Status |
|----------|-------------|---------|--------|
| `BSP_WABA_ID` | Parent WABA ID | `955699277123809` | ✅ Set |
| `BSP_SYSTEM_USER_TOKEN` | System user token | `EAAXBlBX...` | ✅ Set (Test) |
| `BSP_BUSINESS_ID` | Meta Business ID | `789846416555877` | ✅ Set |
| `BSP_WEBHOOK_VERIFY_TOKEN` | Webhook verification | `your-webhook-verify-token-151` | ✅ Set |
| `META_API_VERSION` | API version | `v21.0` | ✅ Set |

---

## Troubleshooting

### Issue: Template submission returns 503
```
POST /api/v1/templates/{id}/submit → 503
Error: "WhatsApp service is not configured"
Code: BSP_SERVICE_UNAVAILABLE
```

**Solution:**
```bash
# Check if BSP_SYSTEM_USER_TOKEN is set in .env
grep BSP_SYSTEM_USER_TOKEN /Users/vivek/Desktop/wApi/server/.env

# Verify bspConfig is recognizing the token
npm start  # Look for BSP init logs
```

---

### Issue: Send template message returns 400
```
POST /api/v1/messages/template → 400
Error: "Workspace is not configured for WhatsApp"
Code: BSP_NOT_CONFIGURED
```

**Solution:**
```bash
# Update workspace to enable BSP
# Use MongoDB CLI or migration script above
db.workspaces.updateOne(
  { _id: ObjectId("YOUR_WORKSPACE_ID") },
  { $set: { bspManaged: true } }
)
```

---

### Issue: Webhook routing by phone_number_id failing
Make sure:
1. ✅ Workspace has `bspPhoneNumberId` set
2. ✅ Webhook includes `phone_number_id` in payload
3. ✅ `bspTenantRouter` middleware is active

---

## Production Deployment Checklist

- [ ] Update `BSP_SYSTEM_USER_TOKEN` with production system user token
- [ ] Update `BSP_WABA_ID` with production WABA ID
- [ ] Generate new `BSP_WEBHOOK_VERIFY_TOKEN` for production
- [ ] Enable webhook delivery in Meta App Dashboard
- [ ] Test end-to-end: template submission → approval → message send → webhook receipt
- [ ] Monitor rate limiting per workspace
- [ ] Set up alerts for `BSP_TOKEN_EXPIRED` errors
- [ ] Test multi-tenant isolation (templates don't leak between workspaces)

---

## Architecture Overview

```
Your Server
    ↓
BSP Admin Routes (/api/v1/admin/bsp/*)
    ↓
BSP Admin Controller (assign phones, manage tenants)
    ↓
MongoDB (Workspace records with BSP fields)
    ↑
Tenant API Routes (/api/v1/messages, /api/v1/templates)
    ↓
Template & Message Controllers
    ↓
BSP Messaging Service (uses systemUserToken)
    ↓
Meta WhatsApp Cloud API (v21.0)
    ↓
Parent WABA (your single BSP account)
    ↓
Multiple Phone Numbers (one per tenant)
```

Each workspace has:
- `bspPhoneNumberId` → routes webhooks
- `bspUsage` → tracks per-workspace consumption
- `bspRateLimits` → enforces plan limits
- Templates submitted via parent WABA with namespace prefix
