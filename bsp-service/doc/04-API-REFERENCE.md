# BSP Provider API Reference
## Complete Endpoint Documentation and Examples

**Document Version:** 1.0.0  
**Previous Document:** 03-DATA-MODELS.md  
**Next Document:** 05-IMPLEMENTATION-GUIDE.md

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Apps Management](#apps-management)
4. [Onboarding](#onboarding)
5. [Messages](#messages)
6. [Templates](#templates)
7. [Media](#media)
8. [Profiles](#profiles)
9. [Tokens](#tokens)
10. [Phones](#phones)
11. [Subscriptions](#subscriptions)
12. [Webhooks](#webhooks)
13. [Health & Status](#health--status)
14. [Error Handling](#error-handling)
15. [Rate Limiting](#rate-limiting)

---

## API Overview

### Base URL

**Development:**
```
http://localhost:3004
```

**Production:**
```
https://bsp-service.your-domain.com
```

### API Versions

All endpoints use the `/internal/v1` prefix, indicating:
- **internal** - For inter-service communication only (not public)
- **v1** - Current API version

### Request/Response Format

**Content-Type:** `application/json`

**Standard Response Envelope:**
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "statusCode": 200,
  "timestamp": "2026-05-20T15:30:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "details": { /* error details */ },
  "timestamp": "2026-05-20T15:30:00.000Z"
}
```

---

## Authentication

### Internal Service Authentication

All endpoints require the `INTERNAL_SERVICE_SECRET` header.

**Header:** `Authorization: Bearer {INTERNAL_SERVICE_SECRET}`

**Example:**
```bash
curl -X POST http://localhost:3004/internal/v1/bsp/apps \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_123",
    "provider": "gupshup"
  }'
```

### Workspace Isolation

Requests are automatically scoped to the workspace making the request. Credentials must validate the workspace has permission to access that resource.

---

## Apps Management

### Create App

Create a new WhatsApp Business app within a provider.

```http
POST /internal/v1/bsp/apps
Content-Type: application/json
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Request Body:**
```json
{
  "workspaceId": "ws_abc123",
  "businessId": "biz_xyz789",
  "appName": "Support Bot",
  "provider": "gupshup"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "workspaceId": "ws_abc123",
    "appId": "gupshup_app_xyz",
    "businessId": "biz_xyz789",
    "appName": "Support Bot",
    "provider": "gupshup",
    "status": "onboarding",
    "createdAt": "2026-05-20T15:30:00Z",
    "updatedAt": "2026-05-20T15:30:00Z"
  },
  "statusCode": 201
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `409 Conflict` - App already exists
- `500 Internal Server Error` - Provider error

---

### Get App Details

Retrieve information about a specific app.

```http
GET /internal/v1/bsp/apps/:appId
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| appId | string | The application ID (e.g., "gupshup_app_xyz") |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "appId": "gupshup_app_xyz",
    "appName": "Support Bot",
    "status": "live",
    "displayPhoneNumber": "+1 (555) 123-4567",
    "phoneNumberId": "1234567890",
    "wabaId": "waba_xyz123",
    "whatsappConnected": true,
    "verifiedName": "Acme Corp Support",
    "qualityRating": "GREEN",
    "gupshupAppLive": true,
    "gupshupWalletBalance": 1500.50,
    "connectedAt": "2026-03-05T10:15:00Z"
  },
  "statusCode": 200
}
```

---

### List Apps

List all apps in a workspace.

```http
GET /internal/v1/bsp/apps?workspaceId=ws_abc123&status=live&limit=10&offset=0
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| workspaceId | string | required | Workspace identifier |
| status | string | (none) | Filter by status (onboarding, connected, live, disconnected) |
| provider | string | (none) | Filter by provider (gupshup, meta, etc.) |
| limit | number | 20 | Results per page |
| offset | number | 0 | Pagination offset |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "apps": [
      { /* app 1 */ },
      { /* app 2 */ }
    ],
    "total": 45,
    "limit": 10,
    "offset": 0
  },
  "statusCode": 200
}
```

---

### Delete App

Disconnect and disable an app.

```http
DELETE /internal/v1/bsp/apps/:appId
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "gupshup_app_xyz",
    "status": "disconnected",
    "disconnectedAt": "2026-05-20T15:30:00Z"
  },
  "statusCode": 200
}
```

---

### Sync Provider State

Force synchronization of app state with provider.

```http
POST /internal/v1/bsp/apps/:appId/sync
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "gupshup_app_xyz",
    "syncedAt": "2026-05-20T15:30:00Z",
    "providerData": {
      "health": true,
      "walletBalance": 2000,
      "rating": "GREEN"
    }
  },
  "statusCode": 200
}
```

---

## Onboarding

### Start Onboarding

Initiate onboarding flow for a new app.

```http
POST /internal/v1/bsp/onboarding/start
Content-Type: application/json
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Request Body:**
```json
{
  "appId": "gupshup_app_xyz",
  "callbackUrl": "https://your-app.com/callback",
  "metadata": {
    "userId": "user_123",
    "source": "dashboard"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_abc123def456",
    "appId": "gupshup_app_xyz",
    "onboardingUrl": "https://partner.gupshup.io/embedded-onboarding?token=...",
    "expiresIn": 3600,
    "callbackUrl": "https://your-app.com/callback"
  },
  "statusCode": 200
}
```

**Notes:**
- User navigates to `onboardingUrl`
- After completion, redirects to `callbackUrl?state=...`
- Session expires in 1 hour by default

---

### Complete Onboarding

Finalize onboarding when user returns from provider.

```http
POST /internal/v1/bsp/onboarding/complete
Content-Type: application/json
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Request Body:**
```json
{
  "appId": "gupshup_app_xyz",
  "sessionId": "session_abc123def456",
  "state": "state_token_from_callback",
  "code": "authorization_code_from_provider",
  "credentials": {
    "gupshupAppId": "gupshup_app_id",
    "token": "app_token_from_provider"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "gupshup_app_xyz",
    "status": "connected",
    "gupshupAppId": "gupshup_app_id",
    "connectedAt": "2026-05-20T15:35:00Z",
    "nextStep": "Verify WhatsApp connection"
  },
  "statusCode": 200
}
```

**Error Responses:**
- `400 Bad Request` - Invalid state or code
- `401 Unauthorized` - Session expired
- `409 Conflict` - Callback already processed

---

## Messages

### Send Message

Send a message through an app.

```http
POST /internal/v1/bsp/messages/send
Content-Type: application/json
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Request Body (Text Message):**
```json
{
  "appId": "gupshup_app_xyz",
  "to": "+919876543210",
  "type": "text",
  "text": "Hello! How can we help you today?",
  "preview_url": false
}
```

**Request Body (Image Message):**
```json
{
  "appId": "gupshup_app_xyz",
  "to": "+919876543210",
  "type": "image",
  "image": {
    "link": "https://example.com/image.jpg"
  }
}
```

**Request Body (Template Message):**
```json
{
  "appId": "gupshup_app_xyz",
  "to": "+919876543210",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": {
      "code": "en"
    },
    "parameters": {
      "body": {
        "parameters": [
          { "type": "text", "text": "John" }
        ]
      }
    }
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "messageId": "msg_internal_xyz123",
    "externalMessageId": "wamid.gupshup.1234567890",
    "to": "+919876543210",
    "status": "sent",
    "sentAt": "2026-05-20T15:35:00Z",
    "provider": "gupshup"
  },
  "statusCode": 200
}
```

**Status Values:**
- `pending` - Queued for send
- `sent` - Sent to provider
- `delivered` - Delivered to device
- `read` - Read by recipient
- `failed` - Failed to send

**Error Responses:**
- `400 Bad Request` - Invalid message format
- `404 Not Found` - App not found
- `409 Conflict` - App not in live status
- `429 Too Many Requests` - Rate limited
- `503 Service Unavailable` - Provider error

---

### Get Message Status

Get current status of a message.

```http
GET /internal/v1/bsp/messages/:messageId
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "messageId": "msg_internal_xyz123",
    "externalMessageId": "wamid.gupshup.1234567890",
    "status": "delivered",
    "to": "+919876543210",
    "appId": "gupshup_app_xyz",
    "sentAt": "2026-05-20T15:35:00Z",
    "deliveredAt": "2026-05-20T15:35:05Z",
    "readAt": "2026-05-20T15:36:00Z"
  },
  "statusCode": 200
}
```

---

## Templates

### Sync Templates

Synchronize templates from provider.

```http
POST /internal/v1/bsp/templates/sync
Content-Type: application/json
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Request Body:**
```json
{
  "appId": "gupshup_app_xyz"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "gupshup_app_xyz",
    "syncedAt": "2026-05-20T15:35:00Z",
    "templates": [
      {
        "templateId": "template_123",
        "name": "hello_world",
        "status": "APPROVED",
        "category": "MARKETING",
        "language": "en",
        "content": "Hello {{1}}, this is a template message"
      }
    ],
    "totalCount": 5,
    "approvedCount": 4,
    "pendingCount": 1,
    "rejectedCount": 0
  },
  "statusCode": 200
}
```

---

### Submit Template

Submit a new template for approval.

```http
POST /internal/v1/bsp/templates/:templateId/submit
Content-Type: application/json
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Request Body:**
```json
{
  "appId": "gupshup_app_xyz",
  "name": "order_confirmation",
  "category": "UTILITY",
  "language": "en",
  "content": "Your order {{1}} is confirmed. Track it at {{2}}",
  "footer": "Thank you for shopping with us",
  "buttons": [
    {
      "type": "QUICK_REPLY",
      "text": "View Order"
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "templateId": "template_456",
    "appId": "gupshup_app_xyz",
    "name": "order_confirmation",
    "status": "PENDING",
    "submittedAt": "2026-05-20T15:35:00Z"
  },
  "statusCode": 201
}
```

---

## Media

### Upload Media

Upload a media file for use in messages/templates.

```http
POST /internal/v1/bsp/media
Content-Type: multipart/form-data
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Form Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| appId | string | App identifier |
| file | file | Binary media file |
| type | string | Type: IMAGE, VIDEO, AUDIO, DOCUMENT |

**Example (curl):**
```bash
curl -X POST http://localhost:3004/internal/v1/bsp/media \
  -H "Authorization: Bearer your-secret-key" \
  -F "appId=gupshup_app_xyz" \
  -F "type=IMAGE" \
  -F "file=@/path/to/image.jpg"
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "mediaId": "media_abc123",
    "appId": "gupshup_app_xyz",
    "type": "IMAGE",
    "mimeType": "image/jpeg",
    "url": "https://cdn.example.com/media/abc123.jpg",
    "fileName": "image.jpg",
    "fileSize": 102400,
    "uploadedAt": "2026-05-20T15:35:00Z",
    "expiresAt": "2026-08-20T15:35:00Z"
  },
  "statusCode": 201
}
```

---

## Profiles

### Get Profile

Retrieve business profile for an app.

```http
GET /internal/v1/bsp/profile/:appId
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "gupshup_app_xyz",
    "displayName": "Acme Corp Support",
    "about": "We're here to help! Chat with us 24/7",
    "profilePhoto": "https://cdn.example.com/profile.jpg",
    "email": "support@acme.com",
    "website": "https://acme.com",
    "phoneNumber": "+1 (555) 123-4567",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94105",
      "country": "USA"
    },
    "verificationStatus": "VERIFIED",
    "lastSyncedAt": "2026-05-20T14:00:00Z"
  },
  "statusCode": 200
}
```

---

### Update Profile

Update business profile information.

```http
PATCH /internal/v1/bsp/profile/:appId
Content-Type: application/json
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Request Body:**
```json
{
  "displayName": "Acme Corp Support",
  "about": "24/7 customer support available",
  "profilePhoto": "https://example.com/new-photo.jpg",
  "website": "https://acme.com/support"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "gupshup_app_xyz",
    "displayName": "Acme Corp Support",
    "about": "24/7 customer support available",
    "updatedAt": "2026-05-20T15:35:00Z"
  },
  "statusCode": 200
}
```

---

## Tokens

### Refresh Token

Manually trigger token refresh for an app.

```http
POST /internal/v1/bsp/apps/:appId/token/refresh
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "gupshup_app_xyz",
    "tokenType": "app_token",
    "expiresAt": "2026-05-27T15:35:00Z",
    "refreshedAt": "2026-05-20T15:35:00Z",
    "status": "active"
  },
  "statusCode": 200
}
```

---

### Get Token Status

Check token expiration and status.

```http
GET /internal/v1/bsp/tokens/:appId
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "gupshup_app_xyz",
    "tokenType": "app_token",
    "status": "active",
    "expiresAt": "2026-05-27T15:35:00Z",
    "expiresIn": 604800,
    "lastRefreshedAt": "2026-05-20T15:35:00Z"
  },
  "statusCode": 200
}
```

---

## Phones

### Register Phone Number

Register and verify a phone number.

```http
POST /internal/v1/bsp/phones/register
Content-Type: application/json
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Request Body:**
```json
{
  "appId": "gupshup_app_xyz",
  "phoneNumber": "+919876543210",
  "countryCode": "IN",
  "verificationMethod": "SMS"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "phoneNumberId": "phone_123",
    "appId": "gupshup_app_xyz",
    "phoneNumber": "+919876543210",
    "status": "pending_verification",
    "verificationMethod": "SMS",
    "expiresAt": "2026-05-21T15:35:00Z"
  },
  "statusCode": 201
}
```

---

## Subscriptions

### Create Subscription

Subscribe to a template or service.

```http
POST /internal/v1/bsp/subscriptions
Content-Type: application/json
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Request Body:**
```json
{
  "appId": "gupshup_app_xyz",
  "templateId": "template_123",
  "type": "TEMPLATE_SUBSCRIPTION"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_xyz789",
    "appId": "gupshup_app_xyz",
    "templateId": "template_123",
    "status": "active",
    "createdAt": "2026-05-20T15:35:00Z"
  },
  "statusCode": 201
}
```

---

### Delete Subscription

Unsubscribe from a template or service.

```http
DELETE /internal/v1/bsp/subscriptions/:subscriptionId
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_xyz789",
    "status": "inactive",
    "deletedAt": "2026-05-20T15:35:00Z"
  },
  "statusCode": 200
}
```

---

## Webhooks

### Register Webhook

Register a webhook endpoint for events.

```http
POST /internal/v1/bsp/webhooks
Content-Type: application/json
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Request Body:**
```json
{
  "appId": "gupshup_app_xyz",
  "url": "https://your-service.com/webhooks/bsp",
  "events": ["message:status", "message:in", "template:update"],
  "secret": "your-webhook-secret"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "webhookId": "webhook_123",
    "appId": "gupshup_app_xyz",
    "url": "https://your-service.com/webhooks/bsp",
    "status": "active",
    "events": ["message:status", "message:in", "template:update"],
    "createdAt": "2026-05-20T15:35:00Z"
  },
  "statusCode": 201
}
```

---

### Webhook Events

Events pushed to your webhook endpoint:

**Message Status Update:**
```json
{
  "event": "message:status",
  "timestamp": "2026-05-20T15:35:00Z",
  "data": {
    "messageId": "wamid.gupshup.1234567890",
    "status": "delivered",
    "timestamp": "2026-05-20T15:35:05Z",
    "appId": "gupshup_app_xyz"
  }
}
```

**Incoming Message:**
```json
{
  "event": "message:in",
  "timestamp": "2026-05-20T15:36:00Z",
  "data": {
    "from": "+919876543210",
    "type": "text",
    "text": "Hello, I need help",
    "messageId": "msg_in_123",
    "appId": "gupshup_app_xyz",
    "timestamp": "2026-05-20T15:36:00Z"
  }
}
```

---

### Webhook from Provider

Receive and acknowledge webhooks from provider.

```http
POST /webhooks/gupshup
Content-Type: application/json
X-Gupshup-Signature: <signature>
```

**Note:** Provider webhooks are automatically handled by the BSP Service. Internal systems should register webhooks to receive processed events.

---

## Health & Status

### Health Check

Check BSP Service health.

```http
GET /health
```

**Response (200):**
```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "providers": {
      "gupshup": "ok"
    }
  },
  "timestamp": "2026-05-20T15:35:00Z"
}
```

---

### Provider Health

Check health of a specific app.

```http
GET /internal/v1/bsp/health/:appId
Authorization: Bearer {INTERNAL_SERVICE_SECRET}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appId": "gupshup_app_xyz",
    "isHealthy": true,
    "qualityRating": "GREEN",
    "walletBalance": 1500.50,
    "messagesSent24h": 2345,
    "failureRate24h": 0.12,
    "avgResponseTime": 245,
    "lastCheckedAt": "2026-05-20T15:35:00Z",
    "checks": {
      "api_connectivity": "ok",
      "wallet_balance": "ok",
      "quality_rating": "ok",
      "rate_limits": "ok"
    }
  },
  "statusCode": 200
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "details": {
    "field": "appId",
    "reason": "App not found"
  },
  "timestamp": "2026-05-20T15:35:00Z"
}
```

### Common Error Codes

| Code | Message | Cause |
|------|---------|-------|
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | No permission for resource |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists or state conflict |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Dependency error (provider, DB, etc.) |

### Retry Policy

**Retryable Errors:** 408, 429, 500, 502, 503

**Retry Strategy:**
```
Attempt 1: Immediate
Attempt 2: After 1 second
Attempt 3: After 2 seconds
Attempt 4: After 4 seconds
Max: 3 attempts
```

---

## Rate Limiting

### Limits

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Message Send | 1000 | Per minute |
| Template Operations | 100 | Per minute |
| App Management | 50 | Per minute |
| Other Operations | 200 | Per minute |

### Rate Limit Headers

**Response Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1684942500
```

### Handling Rate Limits

When rate limited (HTTP 429):
```json
{
  "success": false,
  "error": "Too Many Requests",
  "statusCode": 429,
  "retryAfter": 60,
  "timestamp": "2026-05-20T15:35:00Z"
}
```

Wait `retryAfter` seconds before retrying.

---

## Pagination

### Query Parameters

```
?limit=20&offset=0
```

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| limit | number | 20 | 100 | Results per page |
| offset | number | 0 | N/A | Pagination offset |

### Response Format

```json
{
  "success": true,
  "data": {
    "items": [ /* results */ ],
    "total": 1250,
    "limit": 20,
    "offset": 0,
    "pages": 63
  },
  "statusCode": 200
}
```

---

## SDK Examples

### cURL

```bash
# Create app
curl -X POST http://localhost:3004/internal/v1/bsp/apps \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_123",
    "appName": "My App",
    "provider": "gupshup"
  }'

# Send message
curl -X POST http://localhost:3004/internal/v1/bsp/messages/send \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app_123",
    "to": "+919876543210",
    "type": "text",
    "text": "Hello!"
  }'
```

### Node.js/JavaScript

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:3004',
  headers: {
    'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_SECRET}`,
    'Content-Type': 'application/json'
  }
});

// Create app
async function createApp(workspaceId, appName) {
  const { data } = await client.post('/internal/v1/bsp/apps', {
    workspaceId,
    appName,
    provider: 'gupshup'
  });
  return data.data;
}

// Send message
async function sendMessage(appId, to, text) {
  const { data } = await client.post('/internal/v1/bsp/messages/send', {
    appId,
    to,
    type: 'text',
    text
  });
  return data.data;
}
```

### Python

```python
import requests

class BSPClient:
    def __init__(self, base_url, secret):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {secret}',
            'Content-Type': 'application/json'
        }
    
    def create_app(self, workspace_id, app_name):
        response = requests.post(
            f'{self.base_url}/internal/v1/bsp/apps',
            headers=self.headers,
            json={
                'workspaceId': workspace_id,
                'appName': app_name,
                'provider': 'gupshup'
            }
        )
        return response.json()['data']
    
    def send_message(self, app_id, to, text):
        response = requests.post(
            f'{self.base_url}/internal/v1/bsp/messages/send',
            headers=self.headers,
            json={
                'appId': app_id,
                'to': to,
                'type': 'text',
                'text': text
            }
        )
        return response.json()['data']
```

---

**Next Document:** [05-IMPLEMENTATION-GUIDE.md](05-IMPLEMENTATION-GUIDE.md) - Learn how to extend the system

