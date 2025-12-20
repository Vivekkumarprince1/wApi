# Complete WhatsApp SaaS Backend API Documentation

**Version:** 1.0.0  
**Base URL:** `http://localhost:5001/api/v1`  
**Authentication:** JWT Bearer Token (except webhook endpoints)  
**Date:** 23 October 2025  

## Table of Contents
1. [Authentication](#authentication)
2. [Contacts](#contacts)
3. [Messages](#messages)
4. [Webhooks](#webhooks)
5. [Campaigns](#campaigns)
6. [Automation](#automation)
7. [Analytics](#analytics)
8. [Payments](#payments)
9. [Settings](#settings)
10. [Templates](#templates)
11. [Conversations](#conversations)
12. [Metrics](#metrics)
13. [Services](#services)

---

## Authentication

### POST `/auth/signup`
**Description:** Register a new user account and create a workspace  
**Authentication:** None required  
**Body Parameters:**
```json
{
  "name": "string (required, min 1 char)",
  "email": "string (required, valid email)",
  "password": "string (required, min 6 chars)"
}
```
**Response:** JWT token and user object with workspace  
**Status Codes:** 201 (success), 400 (validation error)

### POST `/auth/login`
**Description:** Authenticate user and get JWT token  
**Authentication:** None required  
**Body Parameters:**
```json
{
  "email": "string (required, valid email)",
  "password": "string (required)"
}
```
**Response:** JWT token and user object  
**Status Codes:** 200 (success), 401 (invalid credentials)

### GET `/auth/me`
**Description:** Get current authenticated user information  
**Authentication:** JWT Bearer Token required  
**Headers:** `Authorization: Bearer <token>`  
**Response:** User object with populated workspace  
**Status Codes:** 200 (success), 401 (unauthorized), 404 (user not found)

---

## Contacts

### POST `/contacts`
**Description:** Create a new contact in workspace  
**Authentication:** JWT Bearer Token required  
**Body Parameters:**
```json
{
  "phone": "string (required, phone number)",
  "name": "string (optional)",
  "email": "string (optional)"
}
```
**Response:** Created contact object  
**Status Codes:** 201 (success), 400 (validation error)

### GET `/contacts`
**Description:** List all contacts in workspace  
**Authentication:** JWT Bearer Token required  
**Query Parameters:** None  
**Response:** Array of contact objects (limited to 1000)  
**Status Codes:** 200 (success)

### GET `/contacts/:id`
**Description:** Get specific contact by ID  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `id` (contact ID)  
**Response:** Contact object  
**Status Codes:** 200 (success), 404 (not found)

### PUT `/contacts/:id`
**Description:** Update contact information  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `id` (contact ID)  
**Body Parameters:** Any contact fields to update  
**Response:** Updated contact object  
**Status Codes:** 200 (success), 404 (not found)

### DELETE `/contacts/:id`
**Description:** Delete contact from workspace  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `id` (contact ID)  
**Response:** `{ "success": true }`  
**Status Codes:** 200 (success), 404 (not found)

---

## Messages

### POST `/messages/send`
**Description:** Send a message to a contact (queues for background processing)  
**Authentication:** JWT Bearer Token required  
**Body Parameters:**
```json
{
  "contactId": "string (required, contact ID)",
  "body": "string (required, message text)"
}
```
**Response:** `{ "message": "Queued", "id": "message_id" }`  
**Status Codes:** 202 (accepted/queued), 404 (contact not found)

---

## Webhooks

### GET `/webhook/meta`
**Description:** WhatsApp webhook verification endpoint  
**Authentication:** None required  
**Query Parameters:**
- `hub.mode` (required)
- `hub.verify_token` (required)
- `hub.challenge` (required)
**Response:** Challenge string for verification  
**Status Codes:** 200 (verified), 403 (verification failed)

### POST `/webhook/meta`
**Description:** Handle incoming WhatsApp webhook events  
**Authentication:** None required (signature verification optional)  
**Headers:** `X-Hub-Signature-256` (optional for signature verification)  
**Body:** WhatsApp webhook payload  
**Response:** 200 OK (immediate response, processing async)  
**Processes:** Messages, status updates, template status changes

---

## Campaigns

### POST `/campaigns`
**Description:** Create a new messaging campaign  
**Authentication:** JWT Bearer Token required  
**Body Parameters:**
```json
{
  "name": "string (required)",
  "message": "string (required)",
  "contacts": ["array of contact IDs"],
  "status": "string (optional, default: draft)"
}
```
**Response:** Created campaign object  
**Status Codes:** 201 (success)

### POST `/campaigns/:id/enqueue`
**Description:** Queue campaign messages for sending  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `id` (campaign ID)  
**Body Parameters:**
```json
{
  "templateName": "string (optional)",
  "templateParams": "array (optional)"
}
```
**Response:** `{ "success": true, "enqueuedCount": number }`  
**Status Codes:** 200 (success), 404 (campaign not found)

---

## Automation

### POST `/automation`
**Description:** Create an automation rule  
**Authentication:** JWT Bearer Token required  
**Body Parameters:**
```json
{
  "name": "string (required)",
  "trigger": "string (required, enum: message_received, status_updated, campaign_completed)",
  "condition": "object (optional)",
  "actions": "array (optional)",
  "enabled": "boolean (optional, default: true)"
}
```
**Response:** Created automation rule object  
**Status Codes:** 201 (success), 400 (validation error)

---

## Analytics

### GET `/analytics/daily`
**Description:** Get daily message statistics for last 7 days  
**Authentication:** JWT Bearer Token required  
**Query Parameters:** None  
**Response:** Aggregated message statistics by day and status  
**Status Codes:** 200 (success)

---

## Payments

### POST `/payments/subscribe`
**Description:** Create a subscription/payment  
**Authentication:** JWT Bearer Token required  
**Body Parameters:**
```json
{
  "planId": "string (required)"
}
```
**Response:** Subscription result or error if Razorpay not configured  
**Status Codes:** 200 (success), 400 (Razorpay not configured)

---

## Settings

### GET `/settings/waba`
**Description:** Get WhatsApp Business API settings  
**Authentication:** JWT Bearer Token required  
**Response:** WABA settings with masked tokens  
**Status Codes:** 200 (success)

### PUT `/settings/waba`
**Description:** Update WhatsApp Business API settings  
**Authentication:** JWT Bearer Token required  
**Body Parameters:** (all optional)
```json
{
  "whatsappAccessToken": "string",
  "whatsappPhoneNumberId": "string",
  "whatsappVerifyToken": "string",
  "wabaId": "string",
  "businessAccountId": "string"
}
```
**Response:** Updated settings with masked tokens  
**Status Codes:** 200 (success), 403 (not owner), 404 (workspace not found)

### POST `/settings/waba/test`
**Description:** Test WhatsApp Business API connection  
**Authentication:** JWT Bearer Token required  
**Response:** Connection test result or error  
**Status Codes:** 200 (success), 400 (credentials not configured)

---

## Templates

### POST `/templates`
**Description:** Create a new message template  
**Authentication:** JWT Bearer Token required  
**Body Parameters:**
```json
{
  "name": "string (required)",
  "language": "string (optional, default: en)",
  "category": "string (optional, default: MARKETING)",
  "components": "array (optional)",
  "variables": "array (optional)"
}
```
**Response:** Created template object  
**Status Codes:** 201 (success), 400 (duplicate name)

### GET `/templates`
**Description:** List templates with filtering  
**Authentication:** JWT Bearer Token required  
**Query Parameters:**
- `status` (optional)
- `category` (optional)
- `search` (optional, name search)
**Response:** Array of template objects  
**Status Codes:** 200 (success)

### GET `/templates/categories`
**Description:** Get template categories with counts  
**Authentication:** JWT Bearer Token required  
**Response:** Array of categories with counts  
**Status Codes:** 200 (success)

### GET `/templates/sync`
**Description:** Sync templates from Meta WhatsApp  
**Authentication:** JWT Bearer Token required  
**Response:** Sync result with counts  
**Status Codes:** 200 (success), 400 (WABA not configured)

### GET `/templates/:id`
**Description:** Get specific template by ID  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `id` (template ID)  
**Response:** Template object with creator info  
**Status Codes:** 200 (success), 404 (not found)

### PUT `/templates/:id`
**Description:** Update template (only if not approved)  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `id` (template ID)  
**Body Parameters:** Template fields to update  
**Response:** Updated template object  
**Status Codes:** 200 (success), 400 (approved template), 404 (not found)

### DELETE `/templates/:id`
**Description:** Delete template from workspace  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `id` (template ID)  
**Response:** `{ "success": true, "message": "Template deleted" }`  
**Status Codes:** 200 (success), 404 (not found)

### POST `/templates/:id/submit`
**Description:** Submit template to Meta for approval  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `id` (template ID)  
**Response:** Submission result  
**Status Codes:** 200 (success), 400 (WABA not configured), 403 (requires business manager)

---

## Conversations

### GET `/conversations`
**Description:** List conversations with pagination  
**Authentication:** JWT Bearer Token required  
**Query Parameters:**
- `status` (optional)
- `assignedTo` (optional)
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)
**Response:** Conversations array with total count  
**Status Codes:** 200 (success)

### GET `/conversations/:contactId`
**Description:** Get or create conversation for contact  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `contactId` (contact ID)  
**Response:** Conversation object with contact info  
**Status Codes:** 200 (success), 404 (contact not found)

### GET `/conversations/:contactId/messages`
**Description:** Get message thread for contact  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `contactId` (contact ID)  
**Query Parameters:**
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)
**Response:** Messages array with total count  
**Status Codes:** 200 (success), 404 (contact not found)

### PUT `/conversations/:contactId`
**Description:** Update conversation properties  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `contactId` (contact ID)  
**Body Parameters:** (all optional)
```json
{
  "assignedTo": "string",
  "status": "string",
  "notes": "string",
  "tags": "array"
}
```
**Response:** Updated conversation object  
**Status Codes:** 200 (success), 404 (conversation not found)

### POST `/conversations/:contactId/read`
**Description:** Mark conversation as read  
**Authentication:** JWT Bearer Token required  
**Path Parameters:** `contactId` (contact ID)  
**Response:** `{ "success": true }`  
**Status Codes:** 200 (success), 404 (conversation not found)

---

## Metrics

### GET `/metrics/templates`
**Description:** Get template usage and approval metrics  
**Authentication:** JWT Bearer Token required  
**Query Parameters:** `days` (optional, default: 30)  
**Response:** Template statistics and quality scores  
**Status Codes:** 200 (success)

### GET `/metrics/messages`
**Description:** Get message delivery and status metrics  
**Authentication:** JWT Bearer Token required  
**Query Parameters:** `days` (optional, default: 7)  
**Response:** Message statistics by status and direction  
**Status Codes:** 200 (success)

---

## Services

### WhatsApp Service (`whatsappService.js`)
**Description:** Handles WhatsApp message sending and campaign processing  
**Key Functions:**
- `enqueueSend(messageId)` - Queue message for sending
- `processSendJob(job)` - Process queued send jobs
- `processCampaignMessage(job)` - Handle campaign message sending

### Meta Service (`metaService.js`)
**Description:** WhatsApp Cloud API integration  
**Key Functions:**
- `sendTextMessage(accessToken, phoneNumberId, to, text)` - Send text message
- `sendTemplateMessage(accessToken, phoneNumberId, to, templateName, language, components)` - Send template message
- `fetchTemplates(accessToken, wabaId)` - Get templates from Meta
- `submitTemplate(accessToken, wabaId, templateData)` - Submit template for approval
- `deleteTemplate(accessToken, wabaId, templateName)` - Delete template
- `verifyWebhookSignature(requestBody, signature, appSecret)` - Verify webhook signature

### Queue Service (`queue.js`)
**Description:** BullMQ queue management for background jobs  
**Key Functions:**
- `createQueue(name)` - Create BullMQ queue
- `createWorker(name, processor)` - Create queue worker

### Payment Service (`paymentService.js`)
**Description:** Razorpay payment integration  
**Key Functions:**
- `createSubscription(userId, planId)` - Create payment subscription

### Queue Worker (`queueWorker.js`)
**Description:** Background job processor for WhatsApp sends  
**Key Functions:**
- `runWorker()` - Start the queue worker

---

## Error Codes & Status Codes

### HTTP Status Codes
- **200:** Success
- **201:** Resource created
- **202:** Request accepted (queued)
- **400:** Bad request/validation error
- **401:** Unauthorized
- **403:** Forbidden
- **404:** Not found
- **500:** Internal server error

### Custom Error Messages
- `Email already registered` - User signup conflict
- `Invalid credentials` - Login failure
- `Contact not found` - Contact operations
- `WABA credentials not configured` - WhatsApp API operations
- `Razorpay not configured` - Payment operations
- `Template with this name already exists` - Template creation
- `Cannot update approved template` - Template modification
- `Only workspace owner can update WABA settings` - Settings access

---

## Authentication Headers
All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

## Rate Limiting
- Applied to `/api/` routes: 200 requests per 15 minutes per IP

## Data Models

### User
```javascript
{
  name: String,
  email: String,
  passwordHash: String,
  role: String (enum: 'owner', 'member'),
  workspace: ObjectId (ref: Workspace),
  createdAt: Date
}
```

### Workspace
```javascript
{
  name: String,
  owner: ObjectId (ref: User),
  plan: String (enum: 'free', 'premium'),
  usage: {
    messagesSent: Number,
    messagesReceived: Number,
    templatesCreated: Number,
    lastResetAt: Date
  },
  // WhatsApp settings
  whatsappAccessToken: String,
  whatsappPhoneNumberId: String,
  whatsappVerifyToken: String,
  wabaId: String,
  connectedAt: Date
}
```

### Contact
```javascript
{
  workspace: ObjectId (ref: Workspace),
  phone: String,
  name: String,
  email: String,
  tags: [String],
  createdAt: Date
}
```

### Message
```javascript
{
  workspace: ObjectId (ref: Workspace),
  contact: ObjectId (ref: Contact),
  direction: String (enum: 'inbound', 'outbound'),
  type: String (enum: 'text', 'image', 'video', etc.),
  body: String,
  status: String (enum: 'queued', 'sent', 'delivered', 'read', 'failed'),
  meta: {
    whatsappId: String,
    whatsappResponses: [Object],
    errors: [String]
  },
  createdAt: Date
}
```

### Template
```javascript
{
  workspace: ObjectId (ref: Workspace),
  name: String,
  language: String,
  category: String,
  components: [Object],
  variables: [Object],
  status: String (enum: 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED'),
  providerId: String,
  qualityScore: String,
  rejectionReason: String,
  createdBy: ObjectId (ref: User),
  createdAt: Date
}
```

### Campaign
```javascript
{
  workspace: ObjectId (ref: Workspace),
  name: String,
  message: String,
  contacts: [ObjectId],
  status: String (enum: 'draft', 'running', 'completed'),
  totalContacts: Number,
  sentCount: Number,
  deliveredCount: Number,
  failedCount: Number,
  createdAt: Date
}
```

### Conversation
```javascript
{
  workspace: ObjectId (ref: Workspace),
  contact: ObjectId (ref: Contact),
  assignedTo: ObjectId (ref: User),
  status: String (enum: 'open', 'closed', 'pending'),
  channel: String (default: 'whatsapp'),
  unreadCount: Number,
  tags: [String],
  notes: String,
  lastActivityAt: Date,
  createdAt: Date
}
```

---

## Environment Variables Required

```bash
# Server
NODE_ENV=development
PORT=5001
JWT_SECRET=your-secret-key

# Database
MONGODB_URI=mongodb://localhost:27017/wa_saas

# Redis
REDIS_URL=redis://127.0.0.1:6379

# WhatsApp/Meta (optional for basic functionality)
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_ACCESS_TOKEN=your-permanent-access-token
META_PHONE_NUMBER_ID=your-phone-number-id
META_WABA_ID=your-whatsapp-business-account-id
META_VERIFY_TOKEN=your-webhook-verify-token

# Payments (optional)
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Features
START_WORKER=false
START_ANALYTICS_CRON=false
```

---

*This documentation is auto-generated from the codebase analysis. Last updated: 23 October 2025*</content>
<parameter name="filePath">/Users/vivek/Documents/waApi-new/COMPLETE_API_DOCUMENTATION.md