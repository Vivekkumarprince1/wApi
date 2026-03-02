# 📱 GUPSHUP PARTNER API — COMPLETE REFERENCE
### Build a WhatsApp SaaS Platform · Full Documentation + API Reference

**Base URL:** `https://partner.gupshup.io`  
**Compiled:** March 2026 · Official Gupshup Partner Documentation

---

## TABLE OF CONTENTS

### PART A — GUIDES
1. [Partner Ecosystem & Meta TPP Registration](#section-1--partner-ecosystem--meta-tpp)
2. [Wallet, Billing & Pricing](#section-2--wallet-billing--pricing)
3. [Portal Walkthrough — Create App & Go Live](#section-3--portal-walkthrough)
4. [Webhooks, Subscriptions & Inbound Events](#section-4--webhooks--subscriptions)
5. [WhatsApp Message Types](#section-5--whatsapp-message-types)
6. [V3 Passthrough APIs Overview](#section-6--v3-passthrough-apis-overview)
7. [WhatsApp Flows (Dynamic)](#section-7--whatsapp-flows)
8. [Onboarding APIs Guide](#section-8--onboarding-apis-guide)
9. [Incoming Events — V2 Full Reference](#section-9--incoming-events-v2)
10. [Incoming Events — V3 Full Reference](#section-10--incoming-events-v3)
11. [MM Lite (Marketing Messages Lite)](#section-11--mm-lite)
12. [Rate Limits](#section-12--rate-limits)
13. [Mark as Read / Typing Indicator](#section-13--mark-as-read--typing-indicator)

### PART B — API REFERENCE
14. [Authentication (Partner Token + App Token)](#section-14--authentication)
15. [App Management](#section-15--app-management)
16. [Phone Number Registration](#section-16--phone-number-registration)
17. [Subscription Management](#section-17--subscription-management)
18. [Block User Management](#section-18--block-user-management)
19. [Analytics & Usage](#section-19--analytics--usage)
20. [Business Profile](#section-20--business-profile)
21. [Template Management](#section-21--template-management)
22. [Media Management](#section-22--media-management)
23. [V2 Send Message APIs](#section-23--v2-send-message-apis)
24. [V3 Send Session Messages](#section-24--v3-send-session-messages)
25. [V3 Send Template Messages](#section-25--v3-send-template-messages)
26. [Flow Management APIs](#section-26--flow-management-apis)
27. [Onboarding APIs (Partner Portal)](#section-27--onboarding-apis)
28. [WABA Management](#section-28--waba-management)
29. [Conversational Components](#section-29--conversational-components)
30. [Template Analytics](#section-30--template-analytics)
31. [WhatsApp Voice & MM Lite APIs](#section-31--voice--mm-lite-apis)

### PART C — SAAS BUILDER GUIDE
32. [Complete SaaS Build Checklist](#section-32--saas-build-checklist)
33. [Common Errors & Fixes](#section-33--common-errors--fixes)
34. [Webhook Payload Reference](#section-34--webhook-payload-reference)

---

# ⚠️ CRITICAL DEPRECATION NOTICES (2025)
> Read this before building anything!

| What | Deprecated Date | Replace With |
|------|----------------|--------------|
| Callback URL API | April 30, 2025 | Subscription API |
| `/sm/*` endpoints | June 30, 2025 | V2/V3 Partner APIs |
| Template Matching (body-based) | June 2025 | Template ID API |
| Opt-in/Opt-out APIs | June 30, 2025 | Meta-level Block User API |
| Synchronous Responses | May 2025 | Async Send Message APIs |
| Non-MM Lite marketing messages | Jan 1, 2026 | 6% markup applied — enable MM Lite |

> **New from 2025:** PMP (Per Message Pricing) replaces CBP from July 2025. TPP registration mandatory since Nov 2024. New apps from Aug 2025 get MM Lite auto-enabled at go-live.

---

# PART A — GUIDES

---

## SECTION 1 — Partner Ecosystem & Meta TPP

### 1.1 Gupshup Partner Eco-System

Gupshup is a **Meta Solution Partner**. Partners (ISVs, Tech Providers, system integrators) can white-label WhatsApp Business API capabilities under their own brand using the Partner Portal.

Partners gain access to:
- Unified partner dashboard to monitor customer sign-ups, usage, billing
- Prepaid wallet management with commission/discount structures
- Partner APIs to build fully branded customer-facing interfaces
- White-labeled Partner Customer Portal (optional)

> 📌 **Partner Portal only supports WhatsApp channel.** Bot studio, journey builder etc. are console-track features — not available in partner portal.

### 1.2 Solution Partners (SP) vs Tech Providers (TP)

| Type | Who Is It | Key Capabilities |
|------|-----------|-----------------|
| **Solution Partner (SP)** | BSPs like Gupshup itself | Provide WhatsApp Business Platform services. Handle credit lines. Direct Meta support. |
| **Tech Provider (TP)** | ISVs / SaaS developers building on Gupshup | Manage end-business accounts. Use Embedded Signup. Access Meta Partner Directory. |

### 1.3 Why TPP is Mandatory

> ⚠️ **BLOCKED:** New WABA onboarding, app linking, and app creation are NOW BLOCKED without approved Solution ID. From July 2025, ISVs without TPP will not earn commissions.

**Benefits of Tech Provider Program:**
- Permission to manage end-business WhatsApp accounts (templates, webhooks, messaging)
- Onboard businesses via Embedded Signup within your own platform
- Eligible for Meta Partner Directory listing
- Continue using Gupshup's (Solution Partner's) credit line

### 1.4 How to Get Solution ID from Meta (Full Walkthrough)

#### Step 1: Create a Meta Business Account
- Create or use existing Meta Business Account
- Fill all details: address, website, email
- Max 2 Meta Business Accounts per business

#### Step 2: Create a Meta App
1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Create a new **Business** app
3. Connect to your Meta Business Account
4. Go to App Settings > Basic:
   - Add privacy policy URL
   - Add terms of service URL
   - Select **Messaging** category
5. Start business verification process

#### Step 3: Add the WhatsApp Product
1. From App Dashboard → Add WhatsApp product
2. Agree to Meta Hosting Terms
3. In Quickstart > Onboarding → agree to **Tech Provider Terms of Service**
4. Click **Start Onboarding**
5. Choose **"Working with a Solution Partner"**

#### Step 4: Create the Partner Solution (CRITICAL STEP)
1. In Quickstart > App Review > "Create a partner solution":
   - **Solution Name:** `YourCompanyName Gupshup OD` (e.g., `ABCSolutions Gupshup OD`)
   - **NO SPECIAL CHARACTERS** in solution name
   - **Partner App ID:** `340384197887925` (Gupshup/OneDirect's Meta App ID)
   - **For "Send messages" permissions → Select "ONLY MY PARTNER"**

> ⚠️ **CRITICAL:** If you select "ONLY ME" instead of "ONLY MY PARTNER" — permissions are non-editable. You'll need to create a completely new Solution ID with correct settings.

The solution shows as **Pending** until Gupshup accepts it.

#### Step 5: Complete Business Verification, App Review, Access Verification
- For `whatsapp_business_messaging`: attach video of message being sent via Gupshup
- For `whatsapp_business_management`: attach video of creating template in Gupshup UI
- Submit app for review
- Complete access verification
- Wait for all 3 approvals (panel shows green checkmarks)

#### Step 6: Set App to LIVE Mode
After all approvals → switch Meta App from DEV to **LIVE mode** to avoid disruption.

#### Step 7: Register Solution ID on Gupshup Partner Portal

**If you're a NEW Gupshup Partner:**
1. Go to `https://partner.gupshup.io/web/login`
2. Sign up, verify email, set password
3. Fill required business details
4. Accept Gupshup terms and conditions
5. Enter the Meta Solution ID and Name
6. Wait for support team approval (1–3 business days)

**If you're an EXISTING Partner (never had Solution ID with Gupshup):**
1. Login to `https://partner.gupshup.io/web/login`
2. Go to Settings (dropdown top-right)
3. Click **"Add new solution"**
4. Enter Solution ID and Name
5. Support team verifies and approves

> 📌 **Phone number onboarding with Solution ID:** Create App → **Link App to Partner ID** (KEY STEP) → Only then Go Live. Solution ID only attaches at go-live if the app is already linked to your Partner ID.

---

## SECTION 2 — Wallet, Billing & Pricing

### 2.1 Wallet Overview

Partners use a **Prepaid Wallet** model:
- Recharge wallet before usage
- Customer message usage deducts from your wallet
- Commissions credited back based on usage volume
- **Single wallet per partner** — all WABAs must be under one Gupshup wallet

| Feature | Details |
|---------|---------|
| Billing Type | Prepaid (recharge before use) |
| Commissions | Volume-based credits back to wallet |
| Wallet Statement | Excel/PDF format. Monthly summary on 1st of each month. |
| Multiple Wallets | NOT SUPPORTED. One wallet for all WABAs. |

### 2.2 Overdraft Limit

- Gupshup dynamically calculates overdraft based on 90-day usage history
- Factors: Current/Assigned Overdraft, Recharge History, Opening Balance, Consumption History
- Partners can self-assign overdraft between 0 and Gupshup-calculated max
- Changes apply immediately

### 2.3 Pricing (2026)

> ⚠️ New pricing page from Jan 1, 2026: `https://www.gupshup.ai/isv-partners/whatsapp-api/pricing`

| Message Category | Pricing Notes |
|-----------------|---------------|
| Marketing (MM Lite) | Standard Meta rate — no markup |
| Marketing (Cloud API, non-MM Lite) | **+6% markup** over WhatsApp marketing fee from Jan 1, 2026 |
| Utility | Standard Meta rate (PMP model from July 2025) |
| Authentication | Standard rate. International auth charged after 750K conv/month |
| Service (Free Entry Point) | Free — FTC (Free Tier Conversation) |

> 📌 **PMP (Per Message Pricing)** rolled out July 1, 2025. Billing now per delivered/read event, not per conversation opened.

### 2.4 Unused Commission Policy
Commission credits that aren't used within validity period are marked **EXPIRED**. Check the portal for exact validity windows.

---

## SECTION 3 — Portal Walkthrough

### 3.1 Create Your First App

| Step | Action |
|------|--------|
| 1 | Login to `partner.gupshup.io` with partner credentials |
| 2 | Click "Create New App" on the Apps Dashboard |
| 3 | Enter App Name (your customer's WABA app) |
| 4 | App is created in Sandbox mode. TPP Solution ID pre-linked. |
| 5 | Click "Go Live" → customer completes Embedded Signup via generated link |
| 6 | App receives WhatsApp number and is production-ready |

### 3.2 Generate App Token
After app creation:
- Via Portal: App → Token section
- Via API: `GET /partner/app/{appId}/token`

> 📌 **PARTNER_TOKEN** (from login) = for partner-level actions (list apps, manage partner settings)  
> **APP_TOKEN** = for app-specific actions (send messages, templates, subscriptions). Always use the right token!

### 3.3 Rate Limits

> Effective September 28, 2023. Cooldown: 1 second (per-second limits), 1 minute (per-minute limits).

| API Endpoint | Rate Limit |
|-------------|-----------|
| `/partner/account/login` | 10 / 1 minute |
| `/partner/app/{appId}/token` | 10 / 1 minute / appId |
| `/partner/app/{appId}/health` | 10 / 1 minute / appId |
| `/partner/app/{appId}/templates` | 10 / 1 minute / appId |
| `/partner/app/{appId}/template/analytics` | 10 / 60 seconds / appId |
| `/partner/app/{appId}/subscription` | 5 / 60 seconds / appId |
| `/partner/app/{appId}/mmlite/msg/enable` | 2 / 1 hour / appId |
| `/partner/app/{appId}/media/` | 10 / 1 second / appId |
| **All other APIs** | **10 / 1 second** |

---

## SECTION 4 — Webhooks & Subscriptions

### 4.1 Webhook Key Points

| Key Point | Details |
|-----------|---------|
| HTTPS Only | Webhook URL must be HTTPS — HTTP will NOT work |
| Response SLA | Your endpoint must return HTTP 200 within **100ms**. Slow responses cause retries. |
| Max Subscriptions | Maximum **5 subscriptions per app** (V2 and V3 combined) |
| Old Callback URL API | **DEPRECATED April 30, 2025** — use Subscription API |
| Deduplication | Subscribed to V2 + V3? Events come on BOTH. Handle dedup in your code. |

### 4.2 Subscription Modes

| Mode | Version | Events Received |
|------|---------|----------------|
| `MESSAGE` | V2 & V3 | All inbound messages from users + delivery statuses |
| `FLOW_MESSAGE` | V3 only | WhatsApp Flow messages/events (**must subscribe separately**) |
| `PAYMENTS` | V3 only | WhatsApp payment events (Brazil PIX etc.) |
| `BILLING` | V2 & V3 | Billing deduction events |
| `FAILED` | V2 & V3 | Failed message events only |
| `VOICE` | V3 | WhatsApp Voice call events |

### 4.3 V3 Incoming Status Event Payload

```json
{
  "entry": [{
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "918375031069",
          "phone_number_id": "207437372456043"
        },
        "statuses": [{
          "gs_id": "3de985af-d06e-41e1-acaf-c379b429668a",
          "id": "fc46fadf-5075-4bb6-9cff-f3ff8c6f6478",
          "recipient_id": "919970754444",
          "status": "read",
          "timestamp": "1705574869"
        }]
      }
    }],
    "id": "216141188246170"
  }],
  "gs_app_id": "bf9ee64c-3d4d-4ac4-8668-732e577007c4",
  "object": "whatsapp_business_account"
}
```

### 4.4 V3 Inbound User Message Payload

```json
{
  "entry": [{
    "changes": [{
      "field": "messages",
      "value": {
        "contacts": [{"profile": {"name": "Sneha"}, "wa_id": "91997075****"}],
        "messages": [{
          "from": "91997075***",
          "id": "wamid.HBgMOTE5OTcw...",
          "text": {"body": "Hi"},
          "timestamp": "1705574871",
          "type": "text"
        }],
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "918375031069",
          "phone_number_id": "207437372456043"
        }
      }
    }]
  }],
  "gs_app_id": "bf9ee64c-3d4d-4ac4-8668-732e577007c4",
  "object": "whatsapp_business_account"
}
```

---

## SECTION 5 — WhatsApp Message Types

### 5.1 All Supported Message Types

| Type | Description | Use Case |
|------|-------------|----------|
| `text` | Plain text with optional link preview | Replies, notifications |
| `image` | Image with optional caption (JPEG, PNG) | Product photos, banners |
| `video` | Video file (MP4) | Product demos, instructions |
| `audio` | Audio file (OGG, MP3) | Voice notes |
| `document` | PDF, DOC, XLS etc. with filename | Invoices, reports |
| `sticker` | Animated or static sticker | Brand engagement |
| `location` | Lat/long with address name | Share store location |
| `contacts` | Rich contact card | Send contact information |
| `interactive/button` | Up to 3 quick reply or CTA buttons | Yes/No, menus |
| `interactive/list` | List with up to 10 rows in sections | Product menus, FAQs |
| `interactive/flow` | Trigger a WhatsApp Flow | Forms, surveys |
| `interactive/location_request` | Ask user to share location | Delivery address capture |
| `reaction` | React to a message with emoji | User engagement |
| `template` | Pre-approved template message | Campaigns, notifications |

### 5.2 Conversation Categories & Pricing

| Type | Opened By | Description |
|------|-----------|-------------|
| **Service** | User message | User sends message to business. First 1000/month free (FTC). |
| **Marketing** | Business template | Promotional messages. Marketing category templates. |
| **Utility** | Business template | Transactional: orders, alerts, confirmations. |
| **Authentication** | Business template | OTP codes, account verification. |
| **Referral Conversion** | User via Click-to-WhatsApp Ad | Referral object included in message payload. |

---

## SECTION 6 — V3 Passthrough APIs Overview

### 6.1 Why Use V3?

V3 Passthrough APIs use Meta's **native message format** — same JSON structure Meta uses in their Cloud API.

| Advantage | Details |
|-----------|---------|
| Faster feature parity | New Meta features roll out via V3 first |
| Easy migration | Partners migrating from other BSPs face minimal changes |
| Dual operation | V2 and V3 can run in parallel with independent subscriptions |

> ⚠️ V3 requires a **separate V3 subscription**. Template management (create/edit/delete) still uses Gupshup's API format — not Meta format.

### 6.2 V3 Prerequisites

| Requirement | Details |
|-------------|---------|
| Partner Token | `POST /partner/account/login` |
| App Token | `GET /partner/app/{appId}/token` |
| V3 Subscription | `POST /partner/app/{appId}/subscription` with `type=v3, mode=MESSAGE` |
| Meta Cloud App | WABA must be on Meta Cloud API (not On-Premises) |
| Content-Type | `application/json` (not form-encoded like V2) |

---

## SECTION 7 — WhatsApp Flows

### 7.1 Flow Categories

| Category | Use Case |
|----------|----------|
| `SIGN_UP` | Customer registration |
| `SIGN_IN` | Authentication, login |
| `APPOINTMENT_BOOKING` | Book appointments, schedule calls |
| `LEAD_GENERATION` | Capture lead info |
| `CONTACT_US` | Support contact forms |
| `CUSTOMER_SUPPORT` | FAQ chatbots, support workflows |
| `SURVEY` | Feedback, NPS, satisfaction |
| `OTHER` | Any custom use case |

### 7.2 Flow Lifecycle

| State | Description | Actions Allowed |
|-------|-------------|----------------|
| `DRAFT` | Created, not published | Edit JSON, update, preview, delete |
| `PUBLISHED` | Live, can be sent | Send in messages, deprecate |
| `DEPRECATED` | Retired | View only — cannot resend |
| `BLOCKED` | Has errors | Fix JSON, re-validate |

> 📌 **Publishing is IRREVERSIBLE.** Test thoroughly in DRAFT using Meta Playground first. Only DRAFT flows can be deleted.

### 7.3 Dynamic Flows — Encryption Setup

Dynamic flows allow real-time data injection from your server. Requires RSA key pair setup.

```bash
# Step 1: Generate RSA Key Pair
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

```bash
# Step 2: Upload Public Key to Meta via Gupshup
curl --location 'https://partner.gupshup.io/partner/app/{{APP_ID}}/flows/publicKey' \
  --header 'Authorization: {{PARTNER_APP_TOKEN}}' \
  --header 'Content-Type: application/json' \
  --data '{"public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIj...\n-----END PUBLIC KEY-----"}'
```

> 📌 Replace newlines with `\n` in JSON. Private key stays on YOUR server for decrypting flow responses.

### 7.4 Subscribe to Flow Events

> ⚠️ You MUST explicitly subscribe to `FLOW_MESSAGE` mode. Regular `MESSAGE` subscription does NOT include flow events.

```bash
curl --request POST \
  'https://partner.gupshup.io/partner/app/{{APP_ID}}/subscription' \
  --header 'Authorization: {{PARTNER_APP_TOKEN}}' \
  --data-urlencode 'callbackUrl=https://yourapp.com/webhook/flows' \
  --data-urlencode 'name=flow-webhook' \
  --data-urlencode 'type=v3' \
  --data-urlencode 'mode=FLOW_MESSAGE'
```

---

## SECTION 8 — Onboarding APIs Guide

### 8.1 Overview

Onboarding APIs allow Tech Providers to onboard WABA customers **entirely within your own platform** — no Gupshup UI needed by your customers.

**Prerequisites:**
- Gupshup Partner Portal account with **approved Solution ID**
- Single Gupshup wallet

### 8.2 Onboarding API Call Sequence

| Step | API | Purpose |
|------|-----|---------|
| 1 | `POST /partner/app` | Create Gupshup App (auto-linked to your Partner ID) |
| 2 | `POST /partner/app/{appId}/subscription` | Set webhook callback |
| 3 | `GET /partner/app/{appId}/onboarding/embed/link` | Generate Embedded Signup link (valid 5 days) |
| 4 | [Customer action] | Customer visits link, completes Facebook WABA setup |
| 5 | [Webhook: `partner-app-live`] | App goes live — webhook fires on your callback |
| 6 | `PUT /partner/app/{appId}/onboarding/contact` | Set customer contact details |
| 7 | `GET /partner/app/{appId}/token` | Get App Token for this customer |
| 8 | Ready | Use App Token to send messages, manage templates |

> 📌 **Migration:** Add `POST /partner/app/{appId}/onboarding/phonemigration` before step 3. This syncs templates and enables migration mode. Disable 2FA at source BSP first!

### 8.3 Go-Live System Event

```json
{
  "app": "APP_NAME",
  "timestamp": 1700000000000,
  "version": 2,
  "type": "system-event",
  "payload": {
    "type": "partner-app-live",
    "message": "App is now live",
    "phone": "919876543210"
  }
}
```

---

## SECTION 9 — Incoming Events V2

### 9.1 User Message Event

```json
{
  "app": "DemoAPI",
  "timestamp": 1580546677791,
  "version": 2,
  "type": "user-event",
  "payload": {
    "id": "ABEGkYiA9GBglQiAf9p",
    "source": "919876543210",
    "type": "text",
    "payload": {
      "text": "Hello, how are you?"
    },
    "sender": {
      "phone": "919876543210",
      "name": "John Doe",
      "country_code": "91",
      "dial_code": "+91"
    }
  }
}
```

### 9.2 Message Events — Delivery Status Types

| Event Type | When | Key Fields |
|-----------|------|-----------|
| `enqueued` | Message accepted by API client | `id` (Gupshup MsgID), `whatsappMessageId` |
| `sent` | Sent to end-user device | `id` (WA MsgID), `gsId` (Gupshup MsgID), `conversation`, `pricing` |
| `delivered` | Delivered to device | `id`, `gsId`, `ts` |
| `read` | User read the message | `id`, `gsId`, `ts` |
| `failed` (sync) | Immediate failure | `id` (Gupshup MsgID), `code`, `reason` |
| `failed` (async) | WhatsApp-side failure | `gsId` (Gupshup MsgID), `code`, `reason` |
| `deleted` | User deleted for everyone (no longer supported by Meta) | `id`, `ts` |

#### Sent Event with Pricing

```json
{
  "app": "MyApp",
  "phone": "917065917373",
  "timestamp": 1747136693404,
  "version": 2,
  "type": "message-event",
  "payload": {
    "id": "WHATSAPP_MSG_ID",
    "gsId": "GUPSHUP_MSG_ID",
    "type": "sent",
    "destination": "919876543210",
    "payload": {"ts": 1747136691},
    "conversation": {
      "id": "CONVERSATION_ID",
      "expiresAt": 1747223091,
      "type": "marketing"
    },
    "pricing": {
      "policy": "CBP",
      "category": "marketing"
    }
  }
}
```

#### Async Failed Event

```json
{
  "app": "DemoAPI",
  "timestamp": 1663138637856,
  "version": 2,
  "type": "message-event",
  "payload": {
    "id": "WHATSAPP_MSG_ID",
    "gsId": "GUPSHUP_MSG_ID",
    "type": "failed",
    "destination": "918x98xx21x4",
    "payload": {
      "code": 470,
      "reason": "Message failed to send because more than 24 hours have passed since the customer last replied"
    }
  }
}
```

### 9.3 Billing Event (V2)

```json
{
  "app": "xxxxxxx23d31f949e98869bc9a1xxxxxx",
  "timestamp": 1739354482884,
  "version": 2,
  "type": "billing-event",
  "payload": {
    "deductions": {
      "type": "regular",
      "model": "PMP",
      "source": "whatsapp",
      "billable": true,
      "category": "marketing"
    },
    "references": {
      "id": "WA_MESSAGE_ID",
      "gsId": "GUPSHUP_MSG_ID",
      "destination": "79507xxxxxxxx"
    }
  }
}
```

> 📌 `model: "PMP"` from July 2025 (was `"CBP"` before). PMP = billing triggered on DELIVERED/READ events, not per conversation.

### 9.4 System Events (V2)

| Event Type | When Triggered |
|-----------|---------------|
| `partner-app-live` | WABA goes live after Embedded Signup |
| `template_category_update` (alert) | Meta identified miscategorized template |
| `template_category_update` (update) | 1st of next month — actual category change applied |
| `tos_signed` | Customer accepted MM Lite Terms of Service |
| `mm_lite_onboarded` | MM Lite onboarding completed |

### 9.5 Referral (Click-to-WhatsApp Ad) Event

```json
"referral": {
  "source_url": "https://fb.me/3tkSI06bP",
  "source_id": "6570618339781",
  "source_type": "ad",
  "headline": "Chat with us",
  "body": "Get 20% off today!",
  "media_type": "image",
  "image_url": "https://scontent.xx.fbcdn.net/...",
  "ctwa_clid": "ARAHuTtGzmFlOO_WcXezfYBRzrxoH2Emo4kj..."
}
```

---

## SECTION 10 — Incoming Events V3

### 10.1 V3 Sent Status Event

```json
{
  "gs_app_id": "GUPSHUP_APP_ID",
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "BUSINESS_PHONE",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "statuses": [{
          "id": "WHATSAPP_MSG_ID",
          "gs_id": "GUPSHUP_MSG_ID",
          "status": "sent",
          "timestamp": "TIMESTAMP",
          "recipient_id": "CUSTOMER_PHONE",
          "conversation": {
            "id": "CONVERSATION_ID",
            "expiration_timestamp": "EXPIRY_TS",
            "origin": {"type": "user_initiated"}
          },
          "pricing": {
            "billable": true,
            "pricing_model": "CBP",
            "category": "service"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### 10.2 V3 Enqueued & Failed

```json
// Enqueued
"statuses": [{"id":"WA_MSG_ID","gs_id":"GS_MSG_ID","status":"enqueued","timestamp":"TS","recipient_id":"PHONE"}]

// Failed
"statuses": [{"id":"WA_MSG_ID","gs_id":"GS_MSG_ID","status":"failed","timestamp":"TS","recipient_id":"PHONE","code":"","reason":""}]
```

### 10.3 V3 Billing Event

```json
{
  "entry": [{
    "changes": [{
      "field": "billing-event",
      "value": {
        "billing": {
          "deductions": {
            "billable": false,
            "conversation_type": "service",
            "model": "CBP",
            "source": "whatsapp",
            "type": "FTC"
          },
          "references": {
            "conversation_id": "CONVERSATION_ID",
            "destination": "9191638XXXXX",
            "gs_id": "GUPSHUP_MSG_ID",
            "id": "WHATSAPP_MSG_ID"
          }
        }
      }
    }]
  }],
  "gs_app_id": "GUPSHUP_APP_ID",
  "object": "whatsapp_business_account"
}
```

### 10.4 PMP Changes (from July 2025)

| Change | Before (CBP) | After (PMP) |
|--------|-------------|-------------|
| `pricing_model` value | `CBP` | `PMP` |
| New key in pricing | — | `type: "regular" / "free_entry_point"` |
| Billing trigger | Per conversation opened | Per message delivered/read |
| `conversation_id` in billing | Present | Removed in PMP events |

---

## SECTION 11 — MM Lite

### 11.1 What is MM Lite?

Marketing Messages Lite (MM Lite) is Meta's optimized marketing delivery channel.

| Key Benefit | Details |
|------------|---------|
| Higher delivery | In India, up to 9% higher delivery vs Cloud API |
| Dynamic limits | Higher-engagement messages get higher delivery limits |
| Same billing model | No extra complexity |
| Exclusive features | Benchmarks, recommendations, TTL, conversion reporting |
| No migration needed | Use existing WABAs, phone numbers, and templates |

### 11.2 MM Lite 6-Step Setup

| Step | Action | Details |
|------|--------|---------|
| 1 | Initiate Onboarding | Gupshup sent MM Lite intent to all WABAs. Customer must accept via ES Flow. New apps from Aug 2025 auto-enabled at go-live. |
| 2 | Confirm Onboarding | Wait for `tos_signed` webhook from Meta. V3 users: check via WABA Health API. |
| 3 | Template Creation | No new templates needed. Existing marketing templates work. Can set TTL. |
| 4A (V2) | Enable V2 MM Lite | `POST /partner/app/{appId}/mmlite/msg/enable` (rate limit: 2/hour/app) |
| 4B (V3) | Use V3 MM Lite endpoint | Dedicated MM Lite V3 endpoint — same payload as regular V3 |
| 5 | Webhooks | Same DLR payloads. sent/delivered/read/billing show category as `marketing_lite` |
| 6 | View Insights | MM Lite Insights API + Meta Ads Manager "Marketing Messages" tab |

### 11.3 MM Lite Routing Logic

| Scenario | V2 Endpoint | V3 Regular | V3 MM Lite Endpoint |
|----------|------------|------------|---------------------|
| `tos_signed` received | Via MM Lite (free) | Via Cloud API (+6% markup) | Via MM Lite (free) |
| `tos_signed` NOT received | Via Cloud API (+6%) | Via Cloud API (+6%) | Via Cloud API (+6%) |

> ⚠️ Non-MM Lite marketing = 6% markup from Jan 1, 2026. Always enable MM Lite!

### 11.4 MM Lite Insights Metrics

```
marketing_messages_sent, marketing_messages_delivered, marketing_messages_read
marketing_messages_delivery_rate, marketing_messages_read_rate
marketing_messages_link_btn_click_rate, marketing_messages_cost_per_delivered
marketing_messages_cost_per_link_btn_click, marketing_messages_spend
marketing_messages_website_add_to_cart, marketing_messages_website_purchase
marketing_messages_app_add_to_cart, marketing_messages_app_purchase
```

---

## SECTION 12 — Rate Limits

> Effective Sep 28, 2023. Cooldown: 1 second (per-second), 1 minute (per-minute).

| API Endpoint | Rate Limit |
|-------------|-----------|
| `/partner/account/login` | 10 / 1 minute |
| `/partner/app/{appId}/token` | 10 / 1 minute / appId |
| `/partner/app/{appId}/health` | 10 / 1 minute / appId |
| `/partner/app/{appId}/templates` | 10 / 1 minute / appId |
| `/partner/app/{appId}/template/analytics` | 10 / 60s / appId |
| `/partner/app/{appId}/subscription` | 5 / 60s / appId |
| `/partner/app/{appId}/mmlite/msg/enable` | 2 / 1 hour / appId |
| `/partner/app/{appId}/media/` | 10 / 1 second / appId |
| **All other APIs** | **10 / 1 second** |

---

## SECTION 13 — Mark as Read / Typing Indicator

```bash
# Mark as Read
curl --request POST \
  'https://partner.gupshup.io/partner/app/{{APP_ID}}/message/read' \
  --header 'Authorization: {{PARTNER_APP_TOKEN}}' \
  --header 'Content-Type: application/json' \
  --data '{"messaging_product": "whatsapp", "status": "read", "message_id": "wamid.XXX"}'
```

```bash
# Typing Indicator
curl --request POST \
  'https://partner.gupshup.io/partner/app/{{APP_ID}}/typing' \
  --header 'Authorization: {{PARTNER_APP_TOKEN}}' \
  --header 'Content-Type: application/json' \
  --data '{"messaging_product": "whatsapp", "status": "typing", "message_id": "wamid.XXX"}'
```

> 📌 Best practice: Send typing indicator, then send actual message 1–3 seconds later. Don't spam typing indicators.

---

# PART B — API REFERENCE

---

## SECTION 14 — Authentication

### 14.1 Get Partner Token

```
POST https://partner.gupshup.io/partner/account/login
```

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `email` | Body | Partner portal email | Required |
| `password` | Body | Partner portal password | Required |
| `Content-Type` | Header | `application/x-www-form-urlencoded` | Required |

```bash
curl --location --request POST 'https://partner.gupshup.io/partner/account/login' \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'email=YOUR_EMAIL' \
  --data-urlencode 'password=YOUR_PASSWORD'
```

```json
{
  "token": "{{PARTNER_TOKEN}}",
  "id": 1003,
  "name": "mycompany",
  "email": "me@company.com",
  "billingType": "PREPAID",
  "enableWallet": true,
  "enableAppOnboarding": true,
  "isTpp": true
}
```

> 📌 PARTNER_TOKEN expires in **24 hours**. Auto-refresh every 23h via cron job.

---

### 14.2 Get App Token

```
GET https://partner.gupshup.io/partner/app/{appId}/token
```

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `{appId}` | Path | App UUID from Get Partner Apps | Required |
| `Authorization` | Header | `{{PARTNER_TOKEN}}` | Required |

```bash
curl --request GET \
  'https://partner.gupshup.io/partner/app/{{APP_ID}}/token' \
  --header 'Authorization: {{PARTNER_TOKEN}}'
```

```json
{
  "status": "success",
  "token": {
    "token": "sk_20c901e*****2a592484*****1",
    "authoriserId": "aac...e8-d...c-...",
    "active": true,
    "expiresOn": 0
  }
}
```

> 📌 `expiresOn: 0` = no expiry. APP_TOKEN does not expire unless explicitly regenerated.

---

## SECTION 15 — App Management

### 15.1 Get Partner Apps

```
GET https://partner.gupshup.io/partner/account/api/partnerApps
Authorization: {{PARTNER_TOKEN}}
```

```json
{
  "status": "success",
  "partnerAppsList": [{
    "id": "00065097-93ff-4c22-bfa4-845f01b7de3b",
    "name": "MyApp",
    "customerId": "4000001311",
    "live": false,
    "partnerId": 6,
    "stopped": false,
    "healthy": true,
    "cap": 0.0
  }]
}
```

---

### 15.2 Create App

```
POST https://partner.gupshup.io/partner/app
```

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `token` | Header | `{{PARTNER_TOKEN}}` | Required |
| `appName` | Body | Name for the new app | Required |
| `email` | Body | Customer email | Required |
| `templateMessaging` | Body | `true/false` | Optional |
| `storageRegion` | Body | `US`, `EU`, etc. | Optional |

---

### 15.3 Update App

```
PUT https://partner.gupshup.io/partner/app/{appId}
```

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `{appId}` | Path | UUID of the app | Required |
| `token` | Header | `{{PARTNER_TOKEN}}` | Required |
| `templateMessaging` | Body | Enable/disable | Optional |
| `storageRegion` | Body | Storage region | Optional |

---

### 15.4 Get App Details

```
GET https://partner.gupshup.io/partner/app/{appId}/details
token: {{PARTNER_TOKEN}}
```

---

### 15.5 Get App List (Filtered + Paginated)

```
GET https://partner.gupshup.io/partner/app/list
```

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `token` | Header | `{{PARTNER_TOKEN}}` | Required |
| `page` | Query | Page number (default: 0) | Optional |
| `size` | Query | Page size (default: 10) | Optional |
| `live` | Query | Filter by `true/false` | Optional |

---

### 15.6 Link App with Partner

```
POST https://partner.gupshup.io/partner/account/api/appLink
```

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `Authorization` | Header | `{{PARTNER_TOKEN}}` | Required |
| `apiKey` | Body | API Key from customer's Gupshup dashboard | Required |
| `appName` | Body | App name to link | Required |

---

## SECTION 16 — Phone Number Registration

### 16.1 Register Phone

```
POST https://partner.gupshup.io/partner/app/{appId}/phone/register
```

> ⚠️ Phone must NOT have active WhatsApp account. For migrations: disable 2FA at source BSP first.

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `{appId}` | Path | UUID of the app | Required |
| `Authorization` | Header | `{{PARTNER_APP_TOKEN}}` | Required |
| `phoneNumber` | Body | Phone with country code (e.g., `919876543210`) | Required |
| `pin` | Body | OTP received via SMS/Voice | Required |
| `method` | Body | `SMS` or `VOICE` | Required |
| `cert` | Body | Certificate from Meta (migration only) | Conditional |

---

### 16.2 Deregister Phone

```
POST https://partner.gupshup.io/partner/app/{appId}/phone/deregister
Authorization: {{PARTNER_APP_TOKEN}}
```

> ⚠️ IMMEDIATE EFFECT — all messaging stops instantly. Use only for migration or number removal.

---

## SECTION 17 — Subscription Management

### 17.1 Set Subscription

```
POST https://partner.gupshup.io/partner/app/{appId}/subscription
```

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `Authorization` | Header | `{{PARTNER_APP_TOKEN}}` | Required |
| `callbackUrl` | Body | HTTPS URL for events | Required |
| `name` | Body | Label for this subscription | Required |
| `type` | Body | `v2` or `v3` | Required |
| `mode` | Body | `MESSAGE` \| `FLOW_MESSAGE` \| `PAYMENTS` \| `BILLING` \| `FAILED` \| `VOICE` | Required |

```bash
curl --request POST \
  'https://partner.gupshup.io/partner/app/{{APP_ID}}/subscription' \
  --header 'Authorization: {{PARTNER_APP_TOKEN}}' \
  --data-urlencode 'callbackUrl=https://yourapp.com/webhook' \
  --data-urlencode 'name=main-webhook' \
  --data-urlencode 'type=v3' \
  --data-urlencode 'mode=MESSAGE'
```

---

### 17.2 Get All Subscriptions
```
GET https://partner.gupshup.io/partner/app/{appId}/subscription
Authorization: {{PARTNER_APP_TOKEN}}
```

### 17.3 Get Specific Subscription
```
GET https://partner.gupshup.io/partner/app/{appId}/subscription/{subscriptionId}
Authorization: {{PARTNER_APP_TOKEN}}
```

### 17.4 Update Subscription
```
PUT https://partner.gupshup.io/partner/app/{appId}/subscription/{subscriptionId}
```

| Parameter | Type | Required |
|-----------|------|----------|
| `callbackUrl` | Body | Optional |
| `mode` | Body | Optional |

### 17.5 Delete Specific Subscription
```
DELETE https://partner.gupshup.io/partner/app/{appId}/subscription/{subscriptionId}
Authorization: {{PARTNER_APP_TOKEN}}
```

### 17.6 Delete ALL Subscriptions
```
DELETE https://partner.gupshup.io/partner/app/{appId}/subscription
Authorization: {{PARTNER_APP_TOKEN}}
```

> ⚠️ IRREVERSIBLE. All subscriptions deleted, all event delivery stops immediately.

---

## SECTION 18 — Block User Management

> 📌 Replaces deprecated Gupshup Opt-in/Opt-out APIs (June 2025). Limit: 64k blocked users. Can only block users who messaged in last 24h.

### 18.1 Block Users

```
POST https://partner.gupshup.io/partner/app/{appId}/user/block
```

```bash
curl --request POST \
  'https://partner.gupshup.io/partner/app/{{APP_ID}}/user/block' \
  --header 'Authorization: {{PARTNER_APP_TOKEN}}' \
  --data-urlencode 'phoneNumbers=["919876543210","918765432109"]'
```

### 18.2 Get Blocked Users List
```
GET https://partner.gupshup.io/partner/app/{appId}/user/blocklist
Authorization: {{PARTNER_APP_TOKEN}}
```

### 18.3 Unblock Users
```
POST https://partner.gupshup.io/partner/app/{appId}/user/unblock
```

| Parameter | Type | Required |
|-----------|------|----------|
| `Authorization` | Header | Required |
| `phoneNumbers` | Body | Required |

---

## SECTION 19 — Analytics & Usage

### 19.1 Get App Daily Usage
```
GET https://partner.gupshup.io/partner/app/{appId}/usage?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Authorization: {{PARTNER_APP_TOKEN}}
```

### 19.2 Get App Daily Discount
```
GET https://partner.gupshup.io/partner/app/{appId}/discount?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Authorization: {{PARTNER_APP_TOKEN}}
```

### 19.3 Get Quality Rating
```
GET https://partner.gupshup.io/partner/app/{appId}/ratings
Authorization: {{PARTNER_APP_TOKEN}}
```

> 📌 Rate limited to once per 24 hours per app.

```json
{
  "status": "success",
  "health": {
    "qualityRating": "GREEN",
    "messagingLimits": "TIER_10K",
    "displayPhoneNumber": "+91 98765 43210"
  }
}
```

### 19.4 Check App Health
```
GET https://partner.gupshup.io/partner/app/{appId}/health
Authorization: {{PARTNER_APP_TOKEN}}
```

### 19.5 Get Wallet Balance
```
GET https://partner.gupshup.io/partner/app/{appId}/wallet/balance
Authorization: {{PARTNER_APP_TOKEN}}
```

---

## SECTION 20 — Business Profile

### 20.1 Get Profile Details
```
GET https://partner.gupshup.io/partner/app/{appId}/business/profile
Authorization: {{PARTNER_APP_TOKEN}}
```

### 20.2 Update Profile Details
```
PUT https://partner.gupshup.io/partner/app/{appId}/business/profile
```

| Parameter | Description | Max |
|-----------|-------------|-----|
| `address` | Business physical address | — |
| `description` | Business description | 512 chars |
| `email` | Business email | — |
| `websites` | Array of website URLs | 2 URLs |
| `vertical` | Business category (`RETAIL`, `EDUCATION`, `FINANCE`, etc.) | — |

### 20.3 Get/Update Profile About
```
GET  https://partner.gupshup.io/partner/app/{appId}/business/profile/about
PUT  https://partner.gupshup.io/partner/app/{appId}/business/profile/about
```
`about` — max 139 characters

### 20.4 Get/Update Profile Picture
```
GET  https://partner.gupshup.io/partner/app/{appId}/business/profile/photo
PUT  https://partner.gupshup.io/partner/app/{appId}/business/profile/photo
```
Upload via `file` (multipart/form-data, JPG/PNG)

### 20.5 Get/Update Display Name
```
GET   https://partner.gupshup.io/partner/app/{appId}/profile/name
POST  https://partner.gupshup.io/partner/app/{appId}/profile/name
```
`name` — New WhatsApp Business display name. May require Meta approval (2–7 business days).

---

## SECTION 21 — Template Management

### 21.1 Create Template

```
POST https://partner.gupshup.io/partner/app/{appId}/templates
Authorization: {{PARTNER_APP_TOKEN}}
Content-Type: application/x-www-form-urlencoded
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `elementName` | Unique template name (lowercase, underscores only) | Required |
| `languageCode` | Language (`en`, `en_US`, `hi`, `es`, etc.) | Required |
| `content` | Body text with `{{1}}`, `{{2}}` variables | Required |
| `category` | `MARKETING` \| `UTILITY` \| `AUTHENTICATION` | Required |
| `templateType` | `TEXT` \| `IMAGE` \| `VIDEO` \| `DOCUMENT` \| `LOCATION` \| `PRODUCT` \| `CATALOG` \| `CAROUSEL` \| `LTO` \| `FLOW` | Required |
| `vertical` | Business vertical (e.g., `ORDER_MANAGEMENT`) | Required |
| `example` | Sample message with real values (for Meta approval) | Required |
| `footer` | Footer text | Optional |
| `header` | Header text | Optional |
| `buttons` | JSON array of button objects | Optional |
| `enableSample` | `true/false` | Optional |
| `allowTemplateCategoryChange` | `true/false` — let Meta recategorize | Optional |
| `exampleMedia` | `handleId` from Upload Template Media API | For media templates |
| `ttl` | Time-to-live in seconds (MM Lite marketing templates) | Optional |

```bash
curl --request POST \
  'https://partner.gupshup.io/partner/app/{{APP_ID}}/templates' \
  --header 'Authorization: {{PARTNER_APP_TOKEN}}' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'elementName=order_confirmation' \
  --data-urlencode 'languageCode=en' \
  --data-urlencode 'category=UTILITY' \
  --data-urlencode 'templateType=TEXT' \
  --data-urlencode 'content=Hi {{1}}, your order {{2}} is confirmed!' \
  --data-urlencode 'vertical=ORDER_MANAGEMENT' \
  --data-urlencode 'example=Hi [John], your order [ORD-123] is confirmed!'
```

---

### 21.2 Get Templates

```
GET https://partner.gupshup.io/partner/app/{appId}/templates
```

| Query Param | Options |
|-------------|---------|
| `meta` | `true` — include meta/example data |
| `category` | `MARKETING` \| `UTILITY` \| `AUTHENTICATION` |
| `status` | `APPROVED` \| `PENDING` \| `REJECTED` |

```json
{
  "status": "success",
  "templates": [{
    "id": "00b298d7-5c63-4788-9b66-b821i3ae5ccd",
    "elementName": "order_confirmation",
    "category": "UTILITY",
    "status": "APPROVED",
    "templateType": "TEXT",
    "languageCode": "en",
    "data": "Hi {{1}}, your order {{2}} is confirmed!",
    "wabaId": "157780008...",
    "quality": "UNKNOWN",
    "new_category": "UTILITY",
    "correct_category": "UTILITY"
  }]
}
```

---

### 21.3 Edit Template
```
PUT https://partner.gupshup.io/partner/app/{appId}/templates/{templateId}
```
Fields: `content`, `example`, `footer` (all optional)

### 21.4 Delete Template
```
DELETE https://partner.gupshup.io/partner/app/{appId}/template/{elementName}
Authorization: {{PARTNER_APP_TOKEN}}
```
> ⚠️ IRREVERSIBLE. Cannot be restored.

### 21.5 Delete by ID + Name
```
DELETE https://partner.gupshup.io/partner/app/{appId}/template/{elementName}/{templateId}
```

### 21.6 Sync Templates from Meta
```
GET https://partner.gupshup.io/partner/app/{appId}/templates/sync
```
Use after migration from another BSP to pull all existing templates.

### 21.7 Upload Template Media
```
POST https://partner.gupshup.io/partner/app/{appId}/upload/media
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `file` | Media file (multipart/form-data) | Required |
| `fileType` | MIME type (`image/jpeg`, `video/mp4`, etc.) | Required |
| `name` | File name | Required |

Returns `handleId` to use in `exampleMedia` field when creating templates.

---

## SECTION 22 — Media Management

### 22.1 Generate Media ID (File Upload)
```
POST https://partner.gupshup.io/partner/app/{appId}/media
```
`file` (multipart) + `fileType` — Returns Media ID. Use ID instead of URL in message APIs.

### 22.2 Generate Media ID (URL)
```
POST https://partner.gupshup.io/partner/app/{appId}/media/url
```
`url` (public URL) + `fileType` — Returns Media ID.

### 22.3 Download Media
```
GET https://partner.gupshup.io/partner/app/{appId}/media/{mediaId}
Authorization: {{PARTNER_APP_TOKEN}}
```
Downloads media file from incoming webhook message using its Media ID.

### 22.4 Delete Media
```
DELETE https://partner.gupshup.io/partner/app/{appId}/media/{mediaId}
Authorization: {{PARTNER_APP_TOKEN}}
```

---

## SECTION 23 — V2 Send Message APIs

### 23.1 Send Message with Template ID

```
POST https://partner.gupshup.io/partner/app/{appId}/template/msg
Content-Type: application/x-www-form-urlencoded
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `Authorization` | `{{PARTNER_APP_TOKEN}}` | Required |
| `channel` | `whatsapp` | Required |
| `source` | Sender phone (with country code) | Required |
| `destination` | Recipient phone | Required |
| `src.name` | App name — **prevents "Mapped Bot Not Found" error** | **Required** |
| `template` | `{"id":"TEMPLATE_UUID","params":["val1","val2"]}` | Required |
| `message` | Media object JSON (for media templates) | Conditional |
| `sandbox` | `true/false` | Optional |
| `postbackTexts` | Button postback values | Optional |

```bash
curl --location 'https://partner.gupshup.io/partner/app/{{APP_ID}}/template/msg' \
  --header 'Authorization: {{PARTNER_APP_TOKEN}}' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'channel=whatsapp' \
  --data-urlencode 'source=919876543210' \
  --data-urlencode 'destination=919123456789' \
  --data-urlencode 'template={"id":"TEMPLATE_UUID","params":["John","ORD-001"]}' \
  --data-urlencode 'src.name=MyApp'
```

```json
{ "status": "submitted", "messageId": "gs.abc123xyz" }
```

### 23.2 V2 Message Body Formats

```bash
# IMAGE
message={"type":"image","image":{"link":"https://example.com/img.jpg"}}
# OR with Media ID:
message={"type":"image","image":{"id":"MEDIA_ID"}}

# VIDEO
message={"type":"video","video":{"link":"https://example.com/video.mp4"}}

# DOCUMENT
message={"type":"document","document":{"link":"https://example.com/file.pdf","filename":"Invoice.pdf"}}

# LOCATION
message={"type":"location","location":{"latitude":28.6139,"longitude":77.2090,"name":"Our Office","address":"New Delhi"}}

# CAROUSEL
message={"type":"carousel","cards":[{"imageUrl":"https://...","title":"Card 1","body":"Description","buttons":[...]}]}

# LTO (Limited Time Offer)
message={"type":"limited_time_offer","offer":{"couponCode":"SAVE20","expirationTimeMs":1704881963523}}
```

---

## SECTION 24 — V3 Send Session Messages

### 24.1 V3 Message Endpoint

```
POST https://partner.gupshup.io/partner/app/{appId}/v3/message
Authorization: {{PARTNER_APP_TOKEN}}
Content-Type: application/json
```

**Base body:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "..."
}
```

### Text Message
```json
"type": "text",
"text": {"body": "Hello! How can I help?", "preview_url": false}
```

### Image Message
```json
"type": "image",
"image": {"link": "https://example.com/image.jpg", "caption": "Check this!"}
// OR with Media ID:
"image": {"id": "MEDIA_ID", "caption": "Check this!"}
```

### Audio Message
```json
"type": "audio",
"audio": {"link": "https://example.com/audio.ogg"}
```

### Video Message
```json
"type": "video",
"video": {"link": "https://example.com/video.mp4", "caption": "Watch this"}
```

### Document Message
```json
"type": "document",
"document": {"link": "https://example.com/invoice.pdf", "filename": "Invoice.pdf", "caption": "Your invoice"}
```

### Interactive Buttons (Quick Reply)
```json
"type": "interactive",
"interactive": {
  "type": "button",
  "body": {"text": "Choose an option:"},
  "action": {
    "buttons": [
      {"type": "reply", "reply": {"id": "btn1", "title": "Option 1"}},
      {"type": "reply", "reply": {"id": "btn2", "title": "Option 2"}},
      {"type": "reply", "reply": {"id": "btn3", "title": "Option 3"}}
    ]
  }
}
```

### Interactive List Message
```json
"type": "interactive",
"interactive": {
  "type": "list",
  "body": {"text": "Our menu:"},
  "footer": {"text": "Select an item"},
  "action": {
    "button": "View Menu",
    "sections": [{
      "title": "Products",
      "rows": [
        {"id": "item1", "title": "Product A", "description": "Best seller"},
        {"id": "item2", "title": "Product B", "description": "New arrival"}
      ]
    }]
  }
}
```

### Reaction Message
```json
"type": "reaction",
"reaction": {"message_id": "WHATSAPP_MSG_ID", "emoji": "❤️"}
```

### Location Request
```json
"type": "interactive",
"interactive": {
  "type": "location_request_message",
  "body": {"text": "Share your delivery address please"},
  "action": {"name": "send_location"}
}
```

### Flow Session Message
```json
"type": "interactive",
"interactive": {
  "type": "flow",
  "body": {"text": "Complete this form to get started"},
  "action": {
    "name": "flow",
    "parameters": {
      "flow_id": "FLOW_ID",
      "flow_cta": "Open Form",
      "flow_action": "navigate",
      "flow_action_payload": {"screen": "WELCOME_SCREEN"}
    }
  }
}
```

---

## SECTION 25 — V3 Send Template Messages

All template messages use `"type": "template"`.

### 25.1 Text Template
```bash
curl --location 'https://partner.gupshup.io/partner/app/{{APP_ID}}/v3/message' \
  --header 'Authorization: {{PARTNER_APP_TOKEN}}' \
  --header 'Content-Type: application/json' \
  --data '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "919876543210",
    "type": "template",
    "template": {
      "name": "order_confirmation",
      "language": {"code": "en"},
      "components": [{
        "type": "body",
        "parameters": [
          {"type": "text", "text": "John"},
          {"type": "text", "text": "ORD-001"}
        ]
      }]
    }
  }'
```

### 25.2 Media Template (Image/Video/Document Header)
```json
"components": [
  {"type": "header", "parameters": [
    {"type": "image", "image": {"link": "https://example.com/banner.jpg"}}
    // OR with Media ID: {"type": "image", "image": {"id": "MEDIA_ID"}}
  ]},
  {"type": "body", "parameters": [
    {"type": "text", "text": "Summer Sale!"}
  ]}
]
```

### 25.3 Interactive Template (Buttons)
```json
"components": [
  {"type": "body", "parameters": [{"type": "text", "text": "John"}]},
  {"type": "button", "sub_type": "quick_reply", "index": "0",
    "parameters": [{"type": "payload", "payload": "YES_CONFIRM"}]},
  {"type": "button", "sub_type": "quick_reply", "index": "1",
    "parameters": [{"type": "payload", "payload": "NO_CANCEL"}]}
]
```

### 25.4 Authentication Template (OTP)
```json
"template": {
  "name": "otp_template",
  "language": {"code": "en"},
  "components": [
    {"type": "body", "parameters": [{"type": "text", "text": "123456"}]},
    {"type": "button", "sub_type": "url", "index": "0",
      "parameters": [{"type": "text", "text": "123456"}]}
  ]
}
```

### 25.5 Location Header Template
```json
"components": [
  {"type": "header", "parameters": [{
    "type": "location",
    "location": {
      "latitude": "28.6139",
      "longitude": "77.2090",
      "name": "Our Office",
      "address": "123 Business Park, New Delhi"
    }
  }]},
  {"type": "body", "parameters": [{"type": "text", "text": "10 AM"}]}
]
```

### 25.6 LTO (Limited Time Offer) Template
```json
"components": [
  {"type": "body", "parameters": [{"type": "text", "text": "User"}]},
  {"type": "limited_time_offer", "parameters": [{
    "type": "limited_time_offer",
    "limited_time_offer": {"expiration_time_ms": 1704881963523}
  }]},
  {"type": "button", "sub_type": "copy_code", "index": "0",
    "parameters": [{"type": "coupon_code", "coupon_code": "SAVE20"}]}
]
```

### 25.7 Currency & DateTime Parameters
```json
{"type": "currency", "currency": {"fallback_value": "$100", "code": "USD", "amount_1000": 100000}},
{"type": "date_time", "date_time": {"fallback_value": "January 10, 2025"}}
```

**Success Response:**
```json
{
  "messages": [{"id": "8b149927-8f3c-40da-b62c-58eeff60903e"}],
  "messaging_product": "whatsapp",
  "contacts": [{"input": "919876543210", "wa_id": "919876543210"}]
}
```

---

## SECTION 26 — Flow Management APIs

### 26.1 Create Flow
```
POST https://partner.gupshup.io/partner/app/{appId}/flows
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `Authorization` | `{{PARTNER_APP_TOKEN}}` | Required |
| `name` | Flow name | Required |
| `categories` | Array: `SIGN_UP` \| `SIGN_IN` \| `APPOINTMENT_BOOKING` \| `LEAD_GENERATION` \| `CONTACT_US` \| `CUSTOMER_SUPPORT` \| `SURVEY` \| `OTHER` | Required |
| `endpoint_uri` | Your server endpoint (Dynamic Flows only) | Optional |

### 26.2–26.4 Get / Update Flows
```
GET    https://partner.gupshup.io/partner/app/{appId}/flows/{flowId}
GET    https://partner.gupshup.io/partner/app/{appId}/flows
PUT    https://partner.gupshup.io/partner/app/{appId}/flows/{flowId}
```

### 26.5–26.6 Get / Update Flow JSON
```
GET  https://partner.gupshup.io/partner/app/{appId}/flows/{flowId}/json
PUT  https://partner.gupshup.io/partner/app/{appId}/flows/{flowId}/json
```
Flow JSON defines all screens, fields, and UI components.

### 26.7 Get Preview URL
```
GET https://partner.gupshup.io/partner/app/{appId}/flows/{flowId}/preview
```

### 26.8 Publish Flow
```
POST https://partner.gupshup.io/partner/app/{appId}/flows/{flowId}/publish
```
> ⚠️ IRREVERSIBLE. Test thoroughly in DRAFT first.

### 26.9 Deprecate Flow
```
POST https://partner.gupshup.io/partner/app/{appId}/flows/{flowId}/deprecate
```
> ⚠️ Cannot be re-published or used in new messages.

### 26.10 Delete Flow
```
DELETE https://partner.gupshup.io/partner/app/{appId}/flows/{flowId}
```
> 📌 Only DRAFT flows can be deleted.

### 26.11 Set/Get Public Key (Dynamic Flows)
```
POST  https://partner.gupshup.io/partner/app/{appId}/flows/publicKey
GET   https://partner.gupshup.io/partner/app/{appId}/flows/publicKey
```

```bash
curl --location 'https://partner.gupshup.io/partner/app/{{APP_ID}}/flows/publicKey' \
  --header 'Authorization: {{PARTNER_APP_TOKEN}}' \
  --header 'Content-Type: application/json' \
  --data '{"public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIj...\n-----END PUBLIC KEY-----"}'
```

---

## SECTION 27 — Onboarding APIs

### 27.1 Generate Embed Signed Link

```
GET https://partner.gupshup.io/partner/app/{appId}/onboarding/embed/link
token: {{PARTNER_TOKEN}}
```

| Parameter | Description | Required |
|-----------|-------------|----------|
| `regenerate` | `true/false` — force regenerate | Optional |
| `user` | Username to pre-fill | Optional |
| `lang` | Language code (e.g., `en_US`) | Optional |

```json
{"status": "success", "link": "https://business.facebook.com/embed/...?..."}
```

Link is valid for **5 days**. If expired, regenerate with `regenerate=true`.

### 27.2 Set Contact Details
```
PUT https://partner.gupshup.io/partner/app/{appId}/onboarding/contact
token: {{PARTNER_TOKEN}}
```
Fields: `contactEmail`, `contactName`, `contactNumber` (all required)

### 27.3 Resend Verification Link
```
POST https://partner.gupshup.io/partner/app/{appId}/onboarding/contact/email/resend
```

### 27.4 Mark App for Migration
```
POST https://partner.gupshup.io/partner/app/{appId}/onboarding/phonemigration
```
> ⚠️ Disable 2FA at the source BSP before calling this.

### 27.5 OBO to Embed — Whitelist WABA
```
POST https://partner.gupshup.io/partner/app/{appId}/obotoembed/whitelist
```

### 27.6 OBO to Embed — Verify & Attach Credit Line
```
GET https://partner.gupshup.io/partner/app/{appId}/obotoembed/verify
```

---

## SECTION 28 — WABA Management

### 28.1 Get WABA Info
```
GET https://partner.gupshup.io/partner/app/{appId}/waba/info
Authorization: {{PARTNER_APP_TOKEN}}
```

```json
{
  "status": "success",
  "waba": {
    "id": "157780008...",
    "displayName": "My Business",
    "phoneNumber": "+91 98765 43210",
    "messagingLimitTier": "TIER_10K",
    "qualityRating": "GREEN",
    "mmLiteStatus": "ONBOARDED"
  }
}
```

`mmLiteStatus` values: `INELIGIBLE` | `ELIGIBLE` | `ONBOARDED`

### 28.2 Check Health
```
GET https://partner.gupshup.io/partner/app/{appId}/health
```

### 28.3 Get Wallet Balance
```
GET https://partner.gupshup.io/partner/app/{appId}/wallet/balance
```

### 28.4 Get Quality Rating
```
GET https://partner.gupshup.io/partner/app/{appId}/ratings
```
> Rate limited to once per 24 hours per app.

---

## SECTION 29 — Conversational Components

### 29.1 Get Component
```
GET https://partner.gupshup.io/partner/app/{appId}/conversational/component
Authorization: {{PARTNER_APP_TOKEN}}
```

### 29.2 Set Component
```
POST https://partner.gupshup.io/partner/app/{appId}/conversational/component
Authorization: {{PARTNER_APP_TOKEN}}
Content-Type: application/json
```

```json
{
  "iceBreakers": [
    "View Products",
    "Track Order",
    "Contact Support",
    "FAQs"
  ],
  "welcomeMessage": "Hi! Welcome to our store. How can we help?"
}
```

> 📌 Max 4 ice breakers. Each max 80 characters.

---

## SECTION 30 — Template Analytics

### 30.1 Get Template Analytics
```
GET https://partner.gupshup.io/partner/app/{appId}/template/analytics?templateId=UUID&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Authorization: {{PARTNER_APP_TOKEN}}
```

### 30.2 Enable Template Analytics
```
POST https://partner.gupshup.io/partner/app/{appId}/template/analytics
```

### 30.3 Disable Button Click Analytics
```
POST https://partner.gupshup.io/partner/app/{appId}/template/analytics/buttonclick
```

### 30.4 Template Comparison
```
GET https://partner.gupshup.io/partner/app/{appId}/template/analytics/{templateId}/compare
```
Compare 2 templates: send ratio, block-to-send ratio, top block reasons. Both templates must be in same WABA.

---

## SECTION 31 — Voice & MM Lite APIs

### 31.1 Enable/Disable WhatsApp Voice
```
POST https://partner.gupshup.io/partner/app/{appId}/voice
```
`action`: `enable` | `disable`

### 31.2 Enable V2 MM Lite Messaging
```
POST https://partner.gupshup.io/partner/app/{appId}/mmlite/msg/enable
Authorization: {{PARTNER_APP_TOKEN}}
```
> Rate limit: 2 calls per hour per app.

### 31.3 Get MM Lite Onboarding Link
```
GET https://partner.gupshup.io/partner/app/{appId}/mmlite/link
Authorization: {{PARTNER_APP_TOKEN}}
```
Link valid 5 days. App must be live.

### 31.4 MM Lite Send Message (V3)
```
POST https://partner.gupshup.io/partner/app/{appId}/v3/mmlite/message
Authorization: {{PARTNER_APP_TOKEN}}
Content-Type: application/json
```
Same payload as V3 template message. **Only MARKETING category** supported. Other categories return error.

---

# PART C — SAAS BUILDER GUIDE

---

## SECTION 32 — SaaS Build Checklist

### 32.1 Pre-Development Checklist

| # | Task | Notes |
|---|------|-------|
| 1 | Complete Meta TPP registration — get Solution ID | **Required BEFORE creating apps** |
| 2 | Register Solution ID in Gupshup Partner Portal Settings | **Required BEFORE creating apps** |
| 3 | Create Gupshup Wallet and add balance | Required before billing |
| 4 | Get PARTNER_TOKEN via `POST /partner/account/login` | Required for all API calls |
| 5 | Set up token refresh cron (every 23 hours) | Recommended |
| 6 | Set up HTTPS webhook endpoint on your server | Required for events |

### 32.2 Customer Onboarding Flow

| # | API | What Happens | Expected |
|---|-----|-------------|---------|
| 1 | `POST /partner/app` | Create WABA app for customer | Returns `appId` UUID |
| 2 | `PUT /partner/app/{appId}/onboarding/contact` | Set customer details | `success` |
| 3 | `POST /partner/app/{appId}/subscription` | Set webhook (type=v3, mode=MESSAGE) | Returns `subscriptionId` |
| 4 | `GET /partner/app/{appId}/onboarding/embed/link` | Get signup link | Returns embed URL |
| 5 | [Share link with customer] | Customer completes Facebook ES Flow | — |
| 6 | [Webhook: `partner-app-live`] | App is now live, phone attached | Phone number |
| 7 | `GET /partner/app/{appId}/token` | Get App Token | Returns `APP_TOKEN` |
| 8 | Ready! | Integration complete | — |

### 32.3 Messaging Scenarios

| Scenario | API | Notes |
|----------|-----|-------|
| Broadcast campaign (any time) | V3 `/v3/message` with `type=template` | Requires APPROVED template + App Token |
| Live chat reply (within 24h) | V3 `/v3/message` with `type=text/image/etc.` | No template needed — free form |
| Send buttons/menu | V3 `interactive` type `button` or `list` | Within 24h window only |
| Trigger WhatsApp Flow | V3 `interactive` type `flow` | Flow must be PUBLISHED |
| Send OTP | V3 AUTHENTICATION category template | Dedicated auth template required |
| MM Lite marketing | V3 `/v3/mmlite/message` OR V2 after enabling | Only MARKETING category |

### 32.4 Production Architecture Recommendations

| Component | Recommendation |
|-----------|---------------|
| PARTNER_TOKEN storage | Redis with 23h TTL. Auto-refresh via cron job. |
| APP_TOKEN storage | Database per customer app. No expiry but monitor health. |
| Webhook endpoint | Process async via queue (SQS, RabbitMQ). Return HTTP 200 in `<100ms`. |
| Message sending | Rate limit to 10 requests/second per app. Queue for bulk sends. |
| Error handling | Log all API responses. Retry with exponential backoff on 5xx errors. |
| Template sync | GET /templates on startup, cache with 1-hour TTL. |
| Media upload | Pre-upload recurring assets (logos, banners), cache Media IDs. |

---

## SECTION 33 — Common Errors & Fixes

| Error / Problem | Root Cause | Solution |
|-----------------|-----------|----------|
| **"Mapped Bot Not Found"** | Missing `src.name` in V2 API | Add `--data-urlencode 'src.name=YourAppName'` to ALL V2 send calls |
| **Template REJECTED** | Meta policy violation | Check rejection reason in Get Templates. Rewrite content/example. Resubmit. |
| **Webhook not receiving** | Wrong subscription or slow endpoint | Verify subscription exists. Endpoint must return HTTP 200 in <100ms. HTTPS only. |
| **App not going live** | TPP not completed | Complete Meta TPP, get Solution ID, register in partner portal settings. |
| **PARTNER_TOKEN expired** | 24h expiry | Auto-refresh every 23h. Check for 401 responses. |
| **Can't create new apps** | TPP registration missing | Must have approved Solution ID before creating apps. |
| **Template matching fails** | Deprecated June 2025 | Use Template ID in send API, not template body matching. |
| **`/sm/*` 404 errors** | Deprecated June 2025 | Migrate to V2/V3 partner send APIs. |
| **Callbacks not received** | Using old Callback URL API | Deprecated April 2025. Use Subscription API. |
| **6% markup on marketing** | MM Lite not enabled | Enable MM Lite via `POST /mmlite/msg/enable` (V2) or MM Lite V3 endpoint. |
| **Flow events missing** | Using `MESSAGE` mode | Create separate subscription with `mode=FLOW_MESSAGE`. |
| **Template category changed** | Meta auto-reclassification | Handle `template_category_update` webhook. Two events: alert then actual update on 1st of month. |
| **OTP fails for registration** | 2FA still active at source | Disable 2FA at source BSP before calling register phone API. |
| **Embed link expired** | 5-day validity | Call generate link API again with `regenerate=true`. |

---

## SECTION 34 — Webhook Payload Reference

### V2 User Message Types

```json
// TEXT
{"type": "text", "payload": {"text": "Hello"}}

// IMAGE/VIDEO/AUDIO/DOCUMENT
{"type": "image", "payload": {"url": "https://media.gupshup.io/...", "caption": "My photo", "mediaId": "MEDIA_ID", "mimeType": "image/jpeg"}}

// LOCATION
{"type": "location", "payload": {"latitude": 28.6139, "longitude": 77.2090, "address": "New Delhi", "name": "My Location"}}

// BUTTON REPLY (interactive)
{"type": "button_reply", "payload": {"id": "btn1", "title": "Option 1", "type": "button"}}

// LIST REPLY (interactive)
{"type": "list_reply", "payload": {"id": "item1", "title": "Product A", "description": "Best seller"}}
```

### V3 User Message Types (Meta Format)

```json
// TEXT
{"type": "text", "text": {"body": "Hello"}}

// IMAGE (received — contains Media ID)
{"type": "image", "image": {"id": "MEDIA_ID", "mime_type": "image/jpeg", "sha256": "..."}}

// LOCATION
{"type": "location", "location": {"latitude": 28.6139, "longitude": 77.2090, "name": "My Home"}}

// BUTTON REPLY
{"type": "interactive", "interactive": {"type": "button_reply", "button_reply": {"id": "btn1", "title": "Option 1"}}}

// LIST REPLY
{"type": "interactive", "interactive": {"type": "list_reply", "list_reply": {"id": "item1", "title": "Product A"}}}

// FLOW RESPONSE
{"type": "interactive", "interactive": {"type": "nfm_reply",
  "nfm_reply": {"response_json": "{...form data...}", "body": "Sent"}}}

// STICKER
{"type": "sticker", "sticker": {"id": "MEDIA_ID", "mime_type": "image/webp", "animated": false}}

// REACTION
{"type": "reaction", "reaction": {"message_id": "wamid.XXX", "emoji": "❤️"}}

// CONTACTS SHARED
{"type": "contacts", "contacts": [{"name": {"formatted_name": "John"}, "phones": [{"phone": "919876543210"}]}]}
```

### Delivery Status Summary

```json
// SENT
{"status": "sent", "id": "WA_MSG_ID", "gs_id": "GS_MSG_ID", "conversation": {...}, "pricing": {...}}

// DELIVERED  
{"status": "delivered", "id": "WA_MSG_ID", "gs_id": "GS_MSG_ID", "timestamp": "TS"}

// READ
{"status": "read", "id": "WA_MSG_ID", "gs_id": "GS_MSG_ID", "timestamp": "TS"}

// FAILED
{"status": "failed", "id": "WA_MSG_ID", "gs_id": "GS_MSG_ID", "code": "470", "reason": "..."}
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│  AUTHENTICATION                                          │
│  PARTNER_TOKEN  →  POST /partner/account/login           │
│  APP_TOKEN      →  GET  /partner/app/{appId}/token       │
├─────────────────────────────────────────────────────────┤
│  ONBOARDING FLOW                                         │
│  1. POST /partner/app              (create)              │
│  2. POST .../subscription          (webhook)             │
│  3. GET  .../onboarding/embed/link (get link)            │
│  4. [Customer completes ES]                              │
│  5. webhook: partner-app-live                            │
│  6. GET  .../token                 (get APP_TOKEN)        │
├─────────────────────────────────────────────────────────┤
│  SEND MESSAGE                                            │
│  V2: POST /partner/app/{appId}/template/msg              │
│  V3: POST /partner/app/{appId}/v3/message                │
│  MM Lite V3: POST .../v3/mmlite/message                  │
├─────────────────────────────────────────────────────────┤
│  CRITICAL RULES                                          │
│  • src.name REQUIRED in V2 sends                         │
│  • HTTPS only for webhooks (< 100ms response)            │
│  • Max 5 subscriptions per app                           │
│  • FLOW_MESSAGE subscription needed for flows            │
│  • TPP registration required before creating apps        │
│  • MM Lite = no 6% markup on marketing messages          │
└─────────────────────────────────────────────────────────┘
```

---

*Source: partner-docs.gupshup.io/docs + partner-docs.gupshup.io/reference — Compiled March 2026*

---

# PART D — MISSING / ADDITIONAL DEVELOPER REFERENCE

> These sections were identified as gaps in the original documentation and added from the API index, changelog, and error code pages.

---

## SECTION 35 — Error Codes (Complete)

### 35.1 Gupshup-Specific Error Codes

These are returned in the `code` field of failed message events (both sync and async), and as HTTP error responses from send APIs.

| Error Code | Error Message | Explanation |
|------------|--------------|-------------|
| `500` | Internal Server Error | Contact Gupshup support |
| `1001` | Last Mapped Bot Failed | Sender details don't match the last mapped bot — add `src.name` to V2 calls |
| `1002` | Number Not Exist on WhatsApp | Destination number is not registered on WhatsApp |
| `1003` | Wallet Balance Low | Partner wallet is below required threshold — recharge wallet |
| `1004` | Template Disabled Failure | User is outside 24h window and template messaging is disabled for this app |
| `1005` | Template Match Failed | User inactive, template body did not match any approved template |
| `1006` | Template Opt-in Failure | User inactive and has not opted in for template messages |
| `1007` | Template Opt-in Match Failure | User inactive, not opted in, AND template did not match |
| `1008` | Neither Proxied Nor Opted-in | User is not opted in and is inactive. Cannot send any message. |
| `1010` | Invalid Media URL | The media URL provided is unreachable or returns a non-200 response |
| `1011` | Invalid Media Size | Media file exceeds WhatsApp's allowed size limit |
| `1012` | Number Opted Out | Phone number has been opted out — cannot receive messages |
| `4001` | API Rate Limited | You've exceeded rate limits — stop sending and wait for cooldown |
| `4002` | Invalid Response from WhatsApp | WhatsApp returned an unexpected response |
| `4003` | No Template Match | Template body did not match any approved template |
| `4004` | Only CAPI Feature | This message type is only supported on Meta Cloud API, not on-premises |
| `4005` | Paused Template | Template has been paused by Meta — check template status |

### 35.2 Meta Cloud API Error Codes (Common)

These come from Meta and appear in the `code` and `reason` fields of async failed events.

| Code | Meaning | Fix |
|------|---------|-----|
| `131047` | Message failed: 24-hour window expired | User hasn't messaged in 24h — send a template instead |
| `131026` | Message undeliverable — user may have WhatsApp restrictions | Verify number is active |
| `131000` | Something went wrong | Generic Meta error — retry after delay |
| `131021` | Recipient phone number not in allowed list (sandbox) | Add number to sandbox test list |
| `130429` | Rate limit hit | Meta-side rate limit — slow down sending |
| `132001` | Template does not exist | Template name/language wrong, or not approved yet |
| `132007` | Template content policy violation | Template rejected for content — review and resubmit |
| `133010` | Phone number not registered | Phone number not yet registered on WhatsApp Business |

> For the full Meta error code list: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/

### 35.3 HTTP Status Codes from Gupshup APIs

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `400` | Bad request — check payload format, missing fields, or invalid values |
| `401` | Authentication failed — token expired or invalid |
| `403` | Forbidden — insufficient permissions (e.g., TPP not approved) |
| `404` | Resource not found — wrong appId, templateId, or endpoint path |
| `429` | Rate limited — wait for cooldown |
| `500` | Internal server error — contact Gupshup support |

---

## SECTION 36 — V3 Additional Session Message Types

### 36.1 Address Message

> Lets users share a shipping address directly in WhatsApp via a built-in form. No external link needed.

```
POST https://partner.gupshup.io/partner/app/{appId}/v3/message
Authorization: {{PARTNER_APP_TOKEN}}
Content-Type: application/json
```

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "interactive",
  "interactive": {
    "type": "address_message",
    "body": {
      "text": "Please share your delivery address to proceed with your order."
    },
    "action": {
      "name": "address_message",
      "parameters": {
        "country": "IN"
      }
    }
  }
}
```

The user's response comes back as an **NFM (native flow message) reply** in your webhook:

```json
{
  "type": "interactive",
  "interactive": {
    "type": "nfm_reply",
    "nfm_reply": {
      "response_json": "{\"name\":\"John Doe\",\"phone_number\":\"919876543210\",\"in_pin_code\":\"400001\",\"floor_number\":\"3\",\"building_name\":\"ABC Tower\",\"address\":\"MG Road\",\"landmark_area\":\"Near Metro\",\"city\":\"Mumbai\",\"state\":\"Maharashtra\"}",
      "body": "Sent",
      "name": "address_message"
    }
  }
}
```

> 📌 Country code must match the user's registered WhatsApp country. Currently supported: `IN` (India), `BR` (Brazil), others being added by Meta.

---

### 36.2 Contact Message

> Send a rich contact card with name, phone numbers, email, and physical address.

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "contacts",
  "contacts": [{
    "name": {
      "formatted_name": "Jane Smith",
      "first_name": "Jane",
      "last_name": "Smith"
    },
    "phones": [
      {"phone": "+919876543210", "type": "CELL", "wa_id": "919876543210"}
    ],
    "emails": [
      {"email": "jane@example.com", "type": "WORK"}
    ],
    "addresses": [
      {"street": "123 Main St", "city": "Mumbai", "state": "MH", "zip": "400001", "country": "India", "country_code": "IN", "type": "WORK"}
    ],
    "org": {
      "company": "Example Corp",
      "department": "Sales",
      "title": "Manager"
    },
    "urls": [
      {"url": "https://example.com", "type": "WORK"}
    ]
  }]
}
```

---

### 36.3 Voice Notes Message

> Send audio as a **voice note** (plays inline with WhatsApp's voice note UI) rather than as a file attachment.

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "audio",
  "audio": {
    "link": "https://example.com/voicenote.ogg",
    "voice": true
  }
}
```

> 📌 Supported formats: OGG/OPUS. Set `"voice": true` to render as voice note. Without this flag, OGG files render as a standard audio file attachment.

---

### 36.4 Interactive Call Permission Request

> Request permission to place a WhatsApp Voice call to the user. User can accept or decline.

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "interactive",
  "interactive": {
    "type": "call_permission_request",
    "body": {
      "text": "We'd like to call you to resolve your query. May we call you now?"
    },
    "action": {
      "name": "call_permission_request"
    }
  }
}
```

> 📌 WhatsApp Voice must be enabled for your app first. Use `POST /partner/app/{appId}/voice` with `action=enable`.

---

### 36.5 Multi-Product Template Message (Catalog)

> Send a scrollable product list from your WhatsApp Catalog directly in a template message.

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "multi_product_template",
    "language": {"code": "en"},
    "components": [
      {
        "type": "body",
        "parameters": [
          {"type": "text", "text": "Summer"}
        ]
      },
      {
        "type": "button",
        "sub_type": "mpm",
        "index": "0",
        "parameters": [
          {
            "type": "action",
            "action": {
              "thumbnail_product_retailer_id": "PRODUCT_SKU_ID",
              "sections": [
                {
                  "title": "Featured Products",
                  "product_items": [
                    {"product_retailer_id": "SKU_001"},
                    {"product_retailer_id": "SKU_002"},
                    {"product_retailer_id": "SKU_003"}
                  ]
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

---

### 36.6 Product Card Carousel Template

> A template with a horizontal carousel of product cards, each with image, title, price, and a button.

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "product_carousel_template",
    "language": {"code": "en"},
    "components": [
      {
        "type": "body",
        "parameters": [
          {"type": "text", "text": "John"}
        ]
      },
      {
        "type": "carousel",
        "cards": [
          {
            "card_index": 0,
            "components": [
              {
                "type": "header",
                "parameters": [{"type": "image", "image": {"link": "https://example.com/product1.jpg"}}]
              },
              {
                "type": "body",
                "parameters": [
                  {"type": "text", "text": "Product A"},
                  {"type": "text", "text": "₹999"}
                ]
              },
              {
                "type": "button",
                "sub_type": "quick_reply",
                "index": 0,
                "parameters": [{"type": "payload", "payload": "BUY_PRODUCT_A"}]
              }
            ]
          },
          {
            "card_index": 1,
            "components": [
              {
                "type": "header",
                "parameters": [{"type": "image", "image": {"link": "https://example.com/product2.jpg"}}]
              },
              {
                "type": "body",
                "parameters": [
                  {"type": "text", "text": "Product B"},
                  {"type": "text", "text": "₹1499"}
                ]
              },
              {
                "type": "button",
                "sub_type": "quick_reply",
                "index": 0,
                "parameters": [{"type": "payload", "payload": "BUY_PRODUCT_B"}]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## SECTION 37 — Meta Utility Template Library

> Meta provides a library of pre-approved utility templates for common use cases. These can be created **without Meta review** — no waiting period — as long as you don't modify the template body text (only variables).

### 37.1 Available Library Categories

| Category | Examples |
|----------|---------|
| Delivery updates | "Your order {{1}} has been shipped" |
| Account updates | "Your account password was changed on {{1}}" |
| Payment reminders | "Payment of {{1}} is due on {{2}}" |
| Appointment reminders | "Your appointment is confirmed for {{1}} at {{2}}" |
| OTP / verification | "Your verification code is {{1}}" |

### 37.2 Browse Template Library

```
GET https://partner.gupshup.io/partner/app/{appId}/waba/library/templates
Authorization: {{PARTNER_APP_TOKEN}}
```

Optional query params: `category` (e.g., `UTILITY`), `language` (e.g., `en`)

```json
{
  "status": "success",
  "library_templates": [
    {
      "name": "order_shipped",
      "category": "UTILITY",
      "language": "en",
      "components": [
        {"type": "BODY", "text": "Your order {{1}} has been shipped. Track it here: {{2}}"}
      ],
      "library_template_id": "lib_template_id_123"
    }
  ]
}
```

### 37.3 Create Template from Library

```
POST https://partner.gupshup.io/partner/app/{appId}/waba/library/templates
Authorization: {{PARTNER_APP_TOKEN}}
Content-Type: application/json
```

```json
{
  "library_template_id": "lib_template_id_123",
  "name": "my_order_shipped",
  "language": "en"
}
```

> ⚠️ Do NOT modify the template body text. Only the `name` and `language` fields are customizable. Any changes to the body will trigger the full Meta review process. Variables ({{1}}, {{2}}) are kept as-is and filled at send time.

**Response:**
```json
{
  "status": "success",
  "template": {
    "id": "NEW_TEMPLATE_UUID",
    "status": "APPROVED",
    "name": "my_order_shipped",
    "category": "UTILITY"
  }
}
```

> 📌 Templates created from the library are immediately `APPROVED` — no review delay.

---

## SECTION 38 — App API Key Management

> Since v14.5 (January 2025), partners can manage up to **2 separate App API keys** per app. This enables zero-downtime key rotation in production.

### 38.1 Key Management Rules

| Rule | Details |
|------|---------|
| Max keys per app | **2** |
| Key validity | **Unlimited** — does not expire unless deleted |
| Who can manage | Partner portal admin users only |
| When to use 2 keys | Key rotation: create new key → update your app → delete old key |

### 38.2 Key Rotation Workflow (Zero Downtime)

```
1. Currently using Key A in production
2. Create Key B via partner portal (Settings → App API Keys → Create)
3. Update your production environment to use Key B
4. Verify Key B works end-to-end
5. Delete Key A via portal (Settings → App API Keys → Delete)
6. Rotation complete — no downtime
```

### 38.3 Managing Keys via Partner Portal UI

1. Login to `partner.gupshup.io`
2. Select the app → Settings → **App API Keys**
3. Click **Create** to generate a new key
4. Copy the key immediately (shown only once)
5. To delete: click the delete icon next to the key → confirm

> 📌 Keys generated here are the same `APP_TOKEN` used in `Authorization` headers. The `GET /partner/app/{appId}/token` API still works but returns the same key — the portal UI is the only way to create a second key or explicitly delete one.

---

## SECTION 39 — Contextual Replies (Threaded Messages)

> Since v13.5 (December 2024), webhook payloads include the message being replied to when a user replies to a specific message.

### 39.1 When This Triggers

This data is included when:
- User replies to a **business message** (long-presses → Reply)
- User replies to their **own previous message**

Applies to all V3 inbound message types: text, quick reply, button reply, list reply, flow/NFM reply, all media types (image, video, file, sticker, audio, contact, location, catalog).

### 39.2 Contextual Reply Payload

The inbound webhook gains a `context` field inside the message object:

```json
{
  "entry": [{
    "changes": [{
      "field": "messages",
      "value": {
        "messages": [{
          "from": "919876543210",
          "id": "wamid.NEW_MESSAGE_ID",
          "timestamp": "1705574871",
          "type": "text",
          "text": {"body": "Yes, that works for me!"},
          "context": {
            "from": "918375031069",
            "id": "wamid.ORIGINAL_BUSINESS_MESSAGE_ID",
            "gs_id": "gupshup-msg-id-of-original"
          }
        }]
      }
    }]
  }]
}
```

| Field | Description |
|-------|-------------|
| `context.from` | Phone number of the sender of the original message |
| `context.id` | WhatsApp message ID of the message being replied to |
| `context.gs_id` | Gupshup message ID of the original message |

### 39.3 How to Use This

```javascript
// In your webhook handler
const message = event.entry[0].changes[0].value.messages[0];

if (message.context) {
  // User is replying to a specific message
  const originalGsId = message.context.gs_id;
  const originalWaId = message.context.id;
  
  // Look up your DB for the original message context
  const originalMessage = await db.messages.findOne({ gsId: originalGsId });
  
  // Route reply to the right conversation thread
  handleThreadedReply(message, originalMessage);
} else {
  // New standalone message
  handleNewMessage(message);
}
```

> 📌 Store your sent message `gs_id` values in a database so you can look them up when contextual replies arrive. This is essential for building threaded chat UIs or multi-step conversational flows.

---

## SECTION 40 — MM Lite Ad Details & Insights APIs

### 40.1 Get Template Ad Details

> Retrieve ad-level details for a marketing template used in Click-to-WhatsApp campaigns.

```
GET https://partner.gupshup.io/partner/app/{appId}/mmlite/template/{templateId}/addetails
Authorization: {{PARTNER_APP_TOKEN}}
```

Returns which ads drove traffic to this template, impression counts, click counts, and associated campaign IDs.

### 40.2 Get Template Insights (MM Lite)

```
GET https://partner.gupshup.io/partner/app/{appId}/mmlite/template/{templateId}/insights
Authorization: {{PARTNER_APP_TOKEN}}
```

Optional params: `startDate`, `endDate` (YYYY-MM-DD)

```json
{
  "status": "success",
  "insights": {
    "template_id": "TEMPLATE_UUID",
    "template_name": "summer_sale",
    "period": {"start": "2025-06-01", "end": "2025-06-30"},
    "metrics": {
      "marketing_messages_sent": 50000,
      "marketing_messages_delivered": 47500,
      "marketing_messages_read": 31000,
      "delivery_rate": 0.95,
      "read_rate": 0.652,
      "link_btn_click_rate": 0.12,
      "cost_per_delivered": 0.0021,
      "cost_per_link_btn_click": 0.0175,
      "spend": 99.75
    },
    "conversion_metrics": {
      "website_add_to_cart": 1200,
      "website_initiate_checkout": 800,
      "website_purchase": 320,
      "website_purchase_value": 48000
    }
  }
}
```

> 📌 Conversion metrics only appear if Meta Pixel + Conversions API are integrated for the business. See MM Lite guide (Section 11) for setup.

---

## SECTION 41 — Partner App Solution Provider Update

> API to update the Solution Provider (joint Solution ID) linked to an existing app. Useful when migrating an app between solution IDs, or if an app was created before TPP approval and needs the solution ID applied retroactively.

```
PUT https://partner.gupshup.io/partner/app/{appId}/solution
Authorization: {{PARTNER_TOKEN}}
Content-Type: application/json
```

```json
{
  "solutionId": "YOUR_NEW_SOLUTION_ID"
}
```

> ⚠️ This can only be applied to **live apps** that don't already have a solution ID mapped. Once a solution ID is mapped to a live app, it cannot be changed. Contact Gupshup support if you need to remap.

---

## SECTION 42 — Sandbox App Deletion

```
DELETE https://partner.gupshup.io/partner/app/{appId}
Authorization: {{PARTNER_TOKEN}}
```

> 📌 Only works on **sandbox (non-live) apps**. Live apps cannot be deleted via API. Use during development to clean up test apps.

```json
{"status": "success", "message": "App deleted successfully"}
```

---

## SECTION 43 — Operational & Portal Notes

### 43.1 Portal Session Timeout

Partner portal sessions expire after **12 hours** for security. If you're building any browser automation or portal-level scripting, account for re-authentication at 12h intervals.

### 43.2 Monthly Summary Email

On the **1st of every month**, Gupshup auto-sends a summary report to the partner covering:
- Commission generated that month
- Discounts applied by Gupshup
- Total usage (WhatsApp fee + Gupshup fee)
- App-level capping details

This is emailed to the partner account's registered email address. No API equivalent — portal only.

### 43.3 Partner Communication Preferences

Partners can configure which emails they receive via portal **Settings → Communications**:

| Category | What It Covers |
|----------|---------------|
| Marketing & Newsletter | Partner program updates, new features |
| Product & Technical | API change notices, deprecation warnings, outage alerts |
| Financial | Wallet, commission, billing communications |

> 📌 All categories are enabled by default. For SaaS teams, ensure the **Product & Technical** category is enabled so you receive deprecation notices (like the April 2025 Callback URL deprecation) with advance warning.

### 43.4 Data Storage Region

When taking an app live, the data storage region for FBC (Facebook Business Cloud) hosting can be selected:

| Region | Default | Notes |
|--------|---------|-------|
| USA | ✅ Yes | Default for all apps |
| Europe (EU) | No | Select during go-live for GDPR compliance |

> ⚠️ Region **cannot be changed** after go-live. For EU-based customers (especially regulated industries), select EU region at go-live time. This is a one-time irreversible choice.

```
// Go-live via API — include storageRegion in POST /partner/app
{
  "appName": "customer-app-name",
  "email": "customer@example.com",
  "storageRegion": "EU"   // or "US" (default)
}
```

### 43.5 Demo / Own-Use Apps (No Solution ID Required)

Partners can toggle an app as **"for own use"** (demo app) to go live without a solution ID being mapped. Useful when building your own internal WhatsApp integration or demo environments.

- Toggleable **only before go-live** (sandbox state)
- Once toggled, the app goes live without any joint solution attached
- Cannot be changed after the app is live

Via portal: Apps page → pencil icon on app → toggle "For Own Use" ON.

---

## UPDATED QUICK REFERENCE CARD

```
┌─────────────────────────────────────────────────────────────────┐
│  AUTHENTICATION                                                  │
│  PARTNER_TOKEN  →  POST /partner/account/login  (24h)           │
│  APP_TOKEN      →  GET  /partner/app/{id}/token (no expiry)     │
│  Max 2 App API keys per app — manage in portal Settings         │
├─────────────────────────────────────────────────────────────────┤
│  ONBOARDING FLOW                                                 │
│  1. POST /partner/app           (create, include storageRegion) │
│  2. POST .../subscription       (webhook, type=v3, mode=MESSAGE)│
│  3. GET  .../embed/link         (valid 5 days)                  │
│  4. [Customer completes ES]                                     │
│  5. Webhook: partner-app-live                                   │
│  6. GET  .../token              (APP_TOKEN)                     │
├─────────────────────────────────────────────────────────────────┤
│  SEND MESSAGE                                                    │
│  V2 template:   POST .../template/msg                           │
│  V3 session:    POST .../v3/message                             │
│  V3 template:   POST .../v3/message  (type=template)            │
│  MM Lite V3:    POST .../v3/mmlite/message  (MARKETING only)    │
├─────────────────────────────────────────────────────────────────┤
│  V3 SESSION MESSAGE TYPES                                        │
│  text, image, audio, video, document, sticker, reaction         │
│  contacts, interactive/button, interactive/list                 │
│  interactive/flow, interactive/address_message                  │
│  interactive/call_permission_request, audio (voice=true)        │
├─────────────────────────────────────────────────────────────────┤
│  KEY ERROR CODES                                                 │
│  1001 → add src.name to V2 calls                                │
│  1002 → number not on WhatsApp                                  │
│  1003 → wallet balance low — recharge                          │
│  1008 → user not opted in AND inactive                         │
│  1012 → number opted out                                        │
│  4005 → template paused by Meta                                │
│  131047 → 24h window expired — use template                    │
│  132001 → template not found / not approved yet                │
├─────────────────────────────────────────────────────────────────┤
│  CRITICAL RULES                                                  │
│  • src.name REQUIRED in all V2 send calls                       │
│  • HTTPS only for webhooks — respond in <100ms                  │
│  • Max 5 subscriptions per app (V2+V3 combined)                 │
│  • FLOW_MESSAGE subscription needed for flow events             │
│  • TPP + approved Solution ID required before creating apps     │
│  • MM Lite = no 6% markup on marketing messages                 │
│  • storageRegion (US/EU) is set at go-live — IRREVERSIBLE       │
│  • Context.gs_id in V3 webhooks = replied-to message ID        │
│  • Portal sessions expire after 12 hours                        │
│  • Template Library templates are instantly APPROVED            │
└─────────────────────────────────────────────────────────────────┘
```

---

*Updated March 2026 — Added: Error Codes, Address/Contact/Voice/Call messages, Template Library APIs, API Key Management, Contextual Replies, MM Lite Ad Insights, Solution Provider Update, Sandbox Deletion, Portal Operations*