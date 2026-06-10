# BSP Provider Data Models
## MongoDB Schema Reference and Relationships

**Document Version:** 1.0.0  
**Previous Document:** 02-ARCHITECTURE.md  
**Next Document:** 04-API-REFERENCE.md

---

## Table of Contents

1. [Data Model Overview](#data-model-overview)
2. [Core Entities](#core-entities)
3. [Schema Definitions](#schema-definitions)
4. [Relationships and Dependencies](#relationships-and-dependencies)
5. [Indexes and Performance](#indexes-and-performance)
6. [Data Validation](#data-validation)
7. [Lifecycle Management](#lifecycle-management)
8. [Common Patterns](#common-patterns)

---

## Data Model Overview

### Entity Relationship Diagram

```
┌─────────────────────┐
│   BspProvider       │
│  (Provider Master)  │
└─────────┬───────────┘
          │ 1:many
          │
          ▼
┌─────────────────────────┐
│      BspApp             │
│  (Business App Instance)│  ◄──────┐
└─────────┬───────────────┘          │ 1:many
          │ 1:many                   │
          ├─────────────────────────►┼─ (appId)
          │                          │
          ├──────────────┐           │
          │              │           │
          ▼              ▼           │
    ┌──────────────┐ ┌────────────┐ │
    │BspCredential │ │ BspToken   │ │
    │              │ │(Auth Token)│ │
    └──────────────┘ └────────────┘ │
                                    │
          ┌─────────────────────────┤
          │ 1:many                  │
          │                         │
          ▼                         │
┌──────────────────────┐            │
│BspOnboardingSession  │            │
└──────────────────────┘            │
          │                         │
          ▼ 1:1                     │
┌──────────────────────┐            │
│BspOnboardingState    │            │
└──────────────────────┘            │
                                    │
    ┌───────────────────────────────┘
    │ 1:many
    │
    ├─────────────────────────────────────┐
    │ 1:many                              │ 1:many
    │                                     │
    ▼                          ▼          ▼
┌──────────────────┐  ┌─────────────┐  ┌───────────────┐
│BspMessageDispatch│  │BspTemplate  │  │ BspProfile    │
│ (Message Status) │  │  Mirror     │  │               │
└──────────────────┘  └─────────────┘  └───────────────┘
    │                      │
    │ 1:many              │ 1:many
    │                      │
    ├─► BspWebhookEvent    ├─► BspSubscription
    │   (Event Log)        │   (Template Subs)
    │
    └─► BspHealthSnapshot
        (Health Check Log)
    
    └─► BspMediaAsset
        (Media Library)
```

---

## Core Entities

### 1. **BspProvider**
Master record for each messaging provider platform.

**Purpose:** Configuration and metadata for each supported provider

**Collection:** `bsp_providers`

```typescript
@Schema({ timestamps: true, collection: 'bsp_providers' })
export class BspProvider {
  _id: ObjectId;                          // MongoDB ObjectId
  
  @Prop({ required: true, unique: true })
  code!: string;                          // 'gupshup', 'meta', 'twilio'
  
  @Prop({ required: true })
  name!: string;                          // 'Gupshup', 'Meta', 'Twilio'
  
  @Prop({ default: true })
  active!: boolean;                       // Enable/disable provider
  
  @Prop({ type: Object, default: {} })
  config!: Record<string, unknown>;       // Provider-specific config
  
  @Prop()
  createdAt?: Date;                       // Auto-generated
  
  @Prop()
  updatedAt?: Date;                       // Auto-generated
}
```

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "code": "gupshup",
  "name": "Gupshup",
  "active": true,
  "config": {
    "apiBase": "https://api.gupshup.io",
    "partnerBase": "https://partner.gupshup.io",
    "supportEmail": "support@gupshup.io",
    "maxRetries": 3,
    "timeoutMs": 25000
  },
  "createdAt": ISODate("2026-01-15T10:30:00Z"),
  "updatedAt": ISODate("2026-05-20T15:45:00Z")
}
```

**Key Fields:**
- `code`: Used in API calls to identify provider
- `config`: Provider-specific settings (endpoints, timeouts, etc.)
- `active`: Can disable provider without deleting data

---

### 2. **BspApp**
Represents a WhatsApp Business application within a workspace and provider.

**Purpose:** Store app lifecycle, status, and provider-specific metadata

**Collection:** `bsp_apps`

```typescript
@Schema({ timestamps: true, collection: 'bsp_apps' })
export class BspApp extends WorkspaceScopedModel {
  _id: ObjectId;
  
  @Prop({ required: true, index: true })
  workspaceId!: string;                   // Parent workspace
  
  @Prop({ required: true, index: true })
  appId!: string;                         // Unique app identifier
  
  @Prop()
  provider?: string;                      // Provider code (FK to BspProvider)
  
  @Prop()
  businessId?: string;                    // Business identifier
  
  @Prop()
  appName?: string;                       // User-friendly app name
  
  @Prop({ default: 'not_started', index: true })
  status!: string;                        // Lifecycle: not_started → onboarding → connected → live → disconnected
  
  @Prop()
  displayPhoneNumber?: string;             // Phone number shown to users
  
  @Prop()
  phoneNumberId?: string;                 // Provider's phone number ID
  
  @Prop({ type: Object, default: {} })
  providerData!: Record<string, unknown>; // Dynamic provider-specific data
  
  // ──── WhatsApp/Meta specific ────
  @Prop()
  wabaId?: string;                        // WhatsApp Business Account ID
  
  @Prop()
  childWabaId?: string;                   // Child WABA (multi-account)
  
  @Prop()
  metaBusinessId?: string;                // Meta Business ID
  
  @Prop()
  whatsappConnected?: boolean;            // Is WhatsApp connected?
  
  @Prop({ select: false })
  whatsappAccessToken?: string;           // Encrypted token
  
  @Prop()
  wabaStatus?: string;                    // WABA status from Meta
  
  @Prop()
  verifiedName?: string;                  // Verified business name
  
  @Prop({ default: 'UNKNOWN' })
  qualityRating?: string;                 // Quality rating (GREEN/YELLOW/RED)
  
  @Prop()
  messagingLimitTier?: string;             // Daily message limit tier
  
  // ──── Gupshup specific ────
  @Prop()
  gupshupAppId?: string;                  // Gupshup app ID
  
  @Prop()
  gupshupAppName?: string;                // Gupshup app name
  
  @Prop()
  onboardingStatus?: string;              // Gupshup onboarding status
  
  @Prop({ default: false })
  gupshupAppLive?: boolean;               // Is Gupshup app live?
  
  @Prop({ type: Boolean, default: null })
  gupshupAppHealth?: boolean | null;      // Health status
  
  @Prop()
  gupshupWalletBalance?: number;          // Wallet balance in credits
  
  // ──── Timestamps ────
  @Prop()
  createdAt?: Date;
  
  @Prop()
  updatedAt?: Date;
  
  @Prop()
  connectedAt?: Date;                     // When app was first connected
  
  @Prop()
  disconnectedAt?: Date;                  // When app was disconnected
}
```

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "workspaceId": "ws_abc123",
  "appId": "gupshup_app_xyz",
  "provider": "gupshup",
  "businessId": "biz_def456",
  "appName": "Support Chatbot",
  "status": "live",
  "displayPhoneNumber": "+1 (555) 123-4567",
  "phoneNumberId": "1234567890",
  "wabaId": "waba_xyz123",
  "whatsappConnected": true,
  "verifiedName": "Acme Corp Support",
  "qualityRating": "GREEN",
  "gupshupAppId": "gupshup_abc",
  "gupshupAppLive": true,
  "gupshupAppHealth": true,
  "gupshupWalletBalance": 1500.50,
  "createdAt": ISODate("2026-03-01T08:00:00Z"),
  "updatedAt": ISODate("2026-05-20T14:30:00Z"),
  "connectedAt": ISODate("2026-03-05T10:15:00Z")
}
```

**Lifecycle States:**
```
not_started
    ↓
onboarding (User completing Gupshup setup)
    ↓
connected (Initial connection established)
    ↓
live (Ready for production use)
    ↓
disconnected (App disabled)
```

---

### 3. **BspCredential**
Secure storage for provider authentication credentials.

**Purpose:** Store encrypted credentials for apps

**Collection:** `bsp_credentials`

```typescript
@Schema({ timestamps: true, collection: 'bsp_credentials' })
export class BspCredential extends WorkspaceScopedModel {
  _id: ObjectId;
  
  @Prop({ required: true, index: true })
  workspaceId!: string;
  
  @Prop({ required: true, unique: true })
  appId!: string;                         // FK to BspApp
  
  @Prop({ required: true })
  provider!: string;                      // Provider code
  
  @Prop({ select: false })                // Never returned by default
  credential!: string;                    // Encrypted credential JSON
  
  @Prop({ type: Object, default: {} })
  metadata?: Record<string, unknown>;     // Non-sensitive metadata
  
  @Prop()
  createdAt?: Date;
  
  @Prop()
  updatedAt?: Date;
}
```

**Security:**
- Field-level encryption at database
- `select: false` prevents accidental exposure
- Never logged or sent in responses
- Rotated on app disconnection

---

### 4. **BspToken**
Authentication token lifecycle management.

**Purpose:** Track JWT/OAuth tokens with expiration

**Collection:** `bsp_tokens`

```typescript
@Schema({ timestamps: true, collection: 'bsp_tokens' })
export class BspToken extends WorkspaceScopedModel {
  _id: ObjectId;
  
  @Prop({ required: true, index: true })
  workspaceId!: string;
  
  @Prop({ required: true, index: true })
  appId!: string;                         // FK to BspApp
  
  @Prop({ required: true })
  provider!: string;                      // Provider code
  
  @Prop({ required: true })
  tokenType!: string;                     // 'app_token', 'access_token', etc.
  
  @Prop({ select: false })
  tokenValue!: string;                    // Encrypted token
  
  @Prop({ required: true })
  expiresAt!: Date;                       // Expiration timestamp
  
  @Prop()
  refreshToken?: string;                  // Refresh token if applicable
  
  @Prop()
  refreshExpiresAt?: Date;                // Refresh token expiration
  
  @Prop({ default: 'active' })
  status!: string;                        // 'active' | 'expired' | 'revoked'
  
  @Prop()
  lastRefreshedAt?: Date;                 // When token was last refreshed
  
  @Prop()
  createdAt?: Date;
  
  @Prop()
  updatedAt?: Date;
}
```

**Lifecycle:**
```
Token created → Active (before expiration)
                   ↓
             Refresh triggered → New token created
                   ↓
             Expired (after expiration) → Revoke
```

---

### 5. **BspMessageDispatch**
Message send status tracking and history.

**Purpose:** Track every message sent through provider

**Collection:** `bsp_message_dispatch`

```typescript
@Schema({ timestamps: true, collection: 'bsp_message_dispatch' })
export class BspMessageDispatch extends WorkspaceScopedModel {
  _id: ObjectId;
  
  @Prop({ required: true, index: true })
  workspaceId!: string;
  
  @Prop({ required: true, index: true })
  appId!: string;                         // Which app sent this
  
  @Prop({ required: true, unique: true })
  messageId!: string;                     // Internal message ID
  
  @Prop({ required: true })
  externalMessageId!: string;             // Provider's message ID (wamid, etc.)
  
  @Prop({ required: true, index: true })
  status!: string;                        // Lifecycle: pending → sent → delivered → read
  
  @Prop({ required: true })
  recipient!: string;                     // Phone number or contact
  
  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;      // Message payload sent
  
  @Prop()
  provider?: string;                      // Provider code
  
  @Prop()
  providerResponse?: Record<string, unknown>; // Full provider response
  
  @Prop()
  errorCode?: string;                     // If failed
  
  @Prop()
  errorMessage?: string;                  // Error details
  
  @Prop()
  retryCount?: number;                    // Number of retries
  
  @Prop()
  sentAt?: Date;                          // When sent to provider
  
  @Prop()
  deliveredAt?: Date;                     // When delivered
  
  @Prop()
  readAt?: Date;                          // When read by recipient
  
  @Prop()
  failedAt?: Date;                        // When failed
  
  @Prop()
  createdAt?: Date;
  
  @Prop()
  updatedAt?: Date;
}
```

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439013"),
  "workspaceId": "ws_abc123",
  "appId": "gupshup_app_xyz",
  "messageId": "msg_internal_1234",
  "externalMessageId": "wamid.gupshup.1234567890",
  "status": "delivered",
  "recipient": "+919876543210",
  "payload": {
    "type": "text",
    "text": "Hello! How can we help?",
    "preview_url": false
  },
  "provider": "gupshup",
  "providerResponse": {
    "status": "success",
    "uid": "msg_uuid_123"
  },
  "sentAt": ISODate("2026-05-20T12:00:00Z"),
  "deliveredAt": ISODate("2026-05-20T12:00:05Z"),
  "readAt": ISODate("2026-05-20T12:01:30Z"),
  "createdAt": ISODate("2026-05-20T12:00:00Z"),
  "updatedAt": ISODate("2026-05-20T12:01:30Z")
}
```

---

### 6. **BspOnboardingSession**
Onboarding workflow state and progress.

**Purpose:** Track user's onboarding journey

**Collection:** `bsp_onboarding_sessions`

```typescript
@Schema({ timestamps: true, collection: 'bsp_onboarding_sessions' })
export class BspOnboardingSession extends WorkspaceScopedModel {
  _id: ObjectId;
  
  @Prop({ required: true, index: true })
  workspaceId!: string;
  
  @Prop({ required: true, unique: true })
  sessionId!: string;                     // Session identifier
  
  @Prop({ required: true, index: true })
  appId!: string;                         // FK to BspApp
  
  @Prop({ required: true })
  provider!: string;
  
  @Prop({ required: true })
  status!: string;                        // 'initiated' | 'in_progress' | 'completed' | 'failed'
  
  @Prop({ required: true })
  onboardingUrl!: string;                 // URL user navigates to
  
  @Prop({ required: true })
  callbackUrl!: string;                   // Where to redirect after
  
  @Prop()
  state!: string;                         // CSRF state token
  
  @Prop()
  startedAt?: Date;
  
  @Prop()
  completedAt?: Date;
  
  @Prop()
  failedAt?: Date;
  
  @Prop()
  metadata?: Record<string, unknown>;     // Custom metadata
  
  @Prop()
  createdAt?: Date;
  
  @Prop()
  updatedAt?: Date;
}
```

---

### 7. **BspTemplateMirror**
Mirror of approved message templates from provider.

**Purpose:** Cache template list and approval status

**Collection:** `bsp_template_mirrors`

```typescript
@Schema({ timestamps: true, collection: 'bsp_template_mirrors' })
export class BspTemplateMirror extends WorkspaceScopedModel {
  _id: ObjectId;
  
  @Prop({ required: true, index: true })
  workspaceId!: string;
  
  @Prop({ required: true, index: true })
  appId!: string;                         // Which app this template belongs to
  
  @Prop({ required: true })
  provider!: string;
  
  @Prop({ required: true })
  templateId!: string;                    // Provider's template ID
  
  @Prop({ required: true })
  name!: string;                          // Template name
  
  @Prop({ required: true })
  status!: string;                        // 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED'
  
  @Prop({ type: Object, required: true })
  definition!: {
    category: string;                     // 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
    language: string;                     // 'en' | 'es', etc.
    content: string;                      // Template text
    parameters?: string[];                // {{1}}, {{2}}, etc.
    footer?: string;
    header?: {
      type: string;                       // 'TEXT' | 'IMAGE' | 'VIDEO'
      text?: string;
    };
    buttons?: Array<{
      type: string;                       // 'QUICK_REPLY' | 'CALL_TO_ACTION'
      text: string;
      url?: string;
      phone?: string;
    }>;
  };
  
  @Prop()
  rejectionReason?: string;               // Why template was rejected
  
  @Prop()
  submittedAt?: Date;
  
  @Prop()
  approvedAt?: Date;
  
  @Prop()
  lastSyncedAt?: Date;                    // Last sync with provider
  
  @Prop()
  createdAt?: Date;
  
  @Prop()
  updatedAt?: Date;
}
```

---

### 8. **BspMediaAsset**
Uploaded media files (images, videos, documents).

**Purpose:** Store references to media used in messages/templates

**Collection:** `bsp_media_assets`

```typescript
@Schema({ timestamps: true, collection: 'bsp_media_assets' })
export class BspMediaAsset extends WorkspaceScopedModel {
  _id: ObjectId;
  
  @Prop({ required: true, index: true })
  workspaceId!: string;
  
  @Prop({ required: true, index: true })
  appId!: string;
  
  @Prop({ required: true })
  provider!: string;
  
  @Prop({ required: true })
  mediaId!: string;                       // Provider's media ID
  
  @Prop({ required: true })
  type!: string;                          // 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  
  @Prop({ required: true })
  mimeType!: string;                      // 'image/jpeg', 'application/pdf', etc.
  
  @Prop({ required: true })
  url!: string;                           // CDN or storage URL
  
  @Prop()
  fileName?: string;
  
  @Prop()
  fileSize?: number;                      // In bytes
  
  @Prop()
  uploadedAt?: Date;
  
  @Prop()
  expiresAt?: Date;                       // When media access expires
  
  @Prop()
  createdAt?: Date;
  
  @Prop()
  updatedAt?: Date;
}
```

---

### 9. **BspWebhookEvent**
Raw webhook events received from provider.

**Purpose:** Audit log and event replay

**Collection:** `bsp_webhook_events`

```typescript
@Schema({ timestamps: true, collection: 'bsp_webhook_events' })
export class BspWebhookEvent extends WorkspaceScopedModel {
  _id: ObjectId;
  
  @Prop({ required: true, index: true })
  workspaceId!: string;
  
  @Prop({ required: true, index: true })
  appId!: string;
  
  @Prop({ required: true })
  provider!: string;
  
  @Prop({ required: true })
  eventType!: string;                     // 'message:status', 'message:in', 'health:update'
  
  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;      // Complete webhook payload
  
  @Prop()
  externalEventId?: string;               // Provider's event ID
  
  @Prop()
  processed?: boolean;                    // Whether event was processed
  
  @Prop()
  processedAt?: Date;
  
  @Prop()
  error?: string;                         // Processing error if any
  
  @Prop()
  createdAt?: Date;
  
  @Prop()
  updatedAt?: Date;
}
```

---

### 10. **BspProfile**
Business profile information for an app.

**Purpose:** Store business profile sync with provider

**Collection:** `bsp_profiles`

```typescript
@Schema({ timestamps: true, collection: 'bsp_profiles' })
export class BspProfile extends WorkspaceScopedModel {
  _id: ObjectId;
  
  @Prop({ required: true, index: true })
  workspaceId!: string;
  
  @Prop({ required: true, unique: true })
  appId!: string;                         // FK to BspApp
  
  @Prop({ required: true })
  provider!: string;
  
  @Prop()
  displayName?: string;
  
  @Prop()
  about?: string;                         // Business description
  
  @Prop()
  profilePhoto?: string;                  // URL to profile picture
  
  @Prop()
  email?: string;
  
  @Prop()
  website?: string;
  
  @Prop()
  phoneNumber?: string;
  
  @Prop({ type: Object, default: {} })
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  
  @Prop()
  verificationStatus?: string;            // Verified status
  
  @Prop()
  lastSyncedAt?: Date;
  
  @Prop()
  createdAt?: Date;
  
  @Prop()
  updatedAt?: Date;
}
```

---

### 11. **BspHealthSnapshot**
Periodic health check status snapshots.

**Purpose:** Monitor provider health over time

**Collection:** `bsp_health_snapshots`

```typescript
@Schema({ timestamps: true, collection: 'bsp_health_snapshots' })
export class BspHealthSnapshot extends WorkspaceScopedModel {
  _id: ObjectId;
  
  @Prop({ required: true, index: true })
  workspaceId!: string;
  
  @Prop({ required: true, index: true })
  appId!: string;
  
  @Prop({ required: true })
  provider!: string;
  
  @Prop()
  isHealthy?: boolean;
  
  @Prop()
  qualityRating?: string;                 // GREEN | YELLOW | RED
  
  @Prop()
  walletBalance?: number;
  
  @Prop()
  messagesSent24h?: number;
  
  @Prop()
  failureRate24h?: number;                // Percentage
  
  @Prop()
  avgResponseTime?: number;               // Milliseconds
  
  @Prop({ type: Object, default: {} })
  details?: Record<string, unknown>;
  
  @Prop()
  checkedAt?: Date;
  
  @Prop()
  createdAt?: Date;
}
```

---

## Relationships and Dependencies

### Foreign Key Relationships

```
BspProvider
    ↓ (1 to many)
BspApp
    ├─ (1 to many) → BspCredential
    ├─ (1 to many) → BspToken
    ├─ (1 to many) → BspOnboardingSession
    ├─ (1 to many) → BspTemplateMirror
    ├─ (1 to many) → BspMediaAsset
    ├─ (1 to many) → BspProfile (1 to 1)
    ├─ (1 to many) → BspMessageDispatch
    ├─ (1 to many) → BspWebhookEvent
    └─ (1 to many) → BspHealthSnapshot
```

### Referential Integrity

```typescript
// Enforced through Mongoose schema relationships
BspApp {
  appId: string (indexed)
}

BspCredential {
  appId: string (FK)  // Must exist in BspApp
}

BspToken {
  appId: string (FK)  // Must exist in BspApp
}
```

---

## Indexes and Performance

### Indexes by Entity

**BspApp:**
```typescript
// Composite indexes for common queries
db.bsp_apps.createIndex({ workspaceId: 1, appId: 1 })
db.bsp_apps.createIndex({ workspaceId: 1, status: 1 })
db.bsp_apps.createIndex({ workspaceId: 1, createdAt: -1 })

// Single column indexes
db.bsp_apps.createIndex({ appId: 1 }, { unique: true })
db.bsp_apps.createIndex({ workspaceId: 1 })
db.bsp_apps.createIndex({ status: 1 })
```

**BspMessageDispatch:**
```typescript
db.bsp_message_dispatch.createIndex({ workspaceId: 1, appId: 1 })
db.bsp_message_dispatch.createIndex({ workspaceId: 1, status: 1 })
db.bsp_message_dispatch.createIndex({ externalMessageId: 1 }, { unique: true })
db.bsp_message_dispatch.createIndex({ createdAt: -1 })
db.bsp_message_dispatch.createIndex({ status: 1, createdAt: -1 })
```

**BspToken:**
```typescript
db.bsp_tokens.createIndex({ appId: 1, tokenType: 1 })
db.bsp_tokens.createIndex({ expiresAt: 1 })
db.bsp_tokens.createIndex({ status: 1 })
```

**BspWebhookEvent:**
```typescript
db.bsp_webhook_events.createIndex({ appId: 1, eventType: 1 })
db.bsp_webhook_events.createIndex({ processed: 1, createdAt: -1 })
db.bsp_webhook_events.createIndex({ createdAt: -1 })
```

### Query Performance Characteristics

| Query Type | Index | Estimated Performance |
|-----------|-------|----------------------|
| Find app by appId | Unique index | < 1ms |
| Find all apps in workspace | Composite (workspaceId, status) | < 10ms (1K docs) |
| Find messages by status | Composite (status, createdAt) | < 50ms (10K docs) |
| Find unprocessed webhooks | (processed, createdAt) | < 5ms (100 docs) |
| Find expired tokens | (expiresAt) | < 20ms (10K docs) |

---

## Data Validation

### Field-Level Validation

```typescript
// Required fields
@Prop({ required: true })
appId!: string;

// Unique constraint
@Prop({ required: true, unique: true })
code!: string;

// Enum values
@Prop({ enum: ['pending', 'sent', 'delivered', 'read', 'failed'] })
status!: string;

// Custom validators
@Prop({
  validate: {
    validator: (v: string) => /^\+\d{10,15}$/.test(v),
    message: 'Invalid phone number format'
  }
})
phoneNumber!: string;

// Default values
@Prop({ default: true })
active!: boolean;

@Prop({ default: () => new Date() })
createdAt!: Date;

// Min/Max
@Prop({
  type: Number,
  min: 0,
  max: 1000
})
walletBalance!: number;
```

### Pre-Save Validation

```typescript
// Example: Auto-set timestamps
BspAppSchema.pre('save', function(next) {
  if (this.isNew) {
    this.createdAt = new Date();
  }
  this.updatedAt = new Date();
  next();
});

// Encrypt sensitive fields
BspCredentialSchema.pre('save', async function(next) {
  if (this.isModified('credential')) {
    this.credential = await encrypt(this.credential);
  }
  next();
});
```

---

## Lifecycle Management

### Document Lifecycle States

**BspApp Lifecycle:**
```
Create
  ├─ status: 'not_started'
  ├─ createdAt: now
  └─ updatedAt: now
  
  ↓
Start Onboarding
  ├─ status: 'onboarding'
  └─ updatedAt: now
  
  ↓
Complete Onboarding
  ├─ status: 'connected'
  ├─ gupshupAppId: assigned
  └─ updatedAt: now
  
  ↓
Go Live
  ├─ status: 'live'
  ├─ connectedAt: now
  └─ updatedAt: now
  
  ├─ (optional) Pause/Disconnect
  │  ├─ status: 'disconnected'
  │  ├─ disconnectedAt: now
  │  └─ updatedAt: now
  │
  └─ (optional) Delete
     └─ Remove document
```

**BspToken Lifecycle:**
```
Create
  ├─ status: 'active'
  ├─ expiresAt: future date
  └─ createdAt: now
  
  ├─ (Token expiring soon)
  │  └─ Trigger refresh
  │
  ├─ Refresh
  │  ├─ Create new token
  │  ├─ lastRefreshedAt: now
  │  └─ expiresAt: new date
  │
  └─ Expiration/Revocation
     └─ status: 'expired' or 'revoked'
```

---

## Common Patterns

### Pattern 1: Workspace Isolation

```typescript
// All documents include workspaceId
@Prop({ required: true, index: true })
workspaceId!: string;

// All queries filter by workspaceId
const app = await this.appModel.findOne({
  workspaceId,    // Always filter by workspace
  appId
});
```

### Pattern 2: Soft Delete

```typescript
// Instead of delete, mark as inactive
async deleteApp(appId: string) {
  return this.appModel.updateOne(
    { appId },
    { 
      status: 'disconnected',
      disconnectedAt: new Date(),
      deletedAt: new Date()  // Mark for deletion
    }
  );
}
```

### Pattern 3: Audit Trail

```typescript
// Every important change is logged
BspApp {
  createdAt: Date,    // When created
  updatedAt: Date,    // Last update
  connectedAt?: Date, // When went live
  disconnectedAt?: Date // When removed
}

BspToken {
  lastRefreshedAt?: Date // Token refresh history
}
```

### Pattern 4: Encrypted Fields

```typescript
@Prop({ select: false })  // Never returned by default
credential!: string;      // Encrypted value

// Only retrieve when explicitly needed
const credRecord = await this.credentialModel
  .findOne({ appId })
  .select('+credential')  // Explicitly select encrypted field
  .lean();

// Decrypt after retrieval
const decrypted = await decrypt(credRecord.credential);
```

---

## Data Retention Policies

### Retention Schedule

| Entity | Retention | Reason |
|--------|-----------|--------|
| BspApp (deleted) | 90 days | Audit trail |
| BspMessageDispatch | 1 year | Delivery proof |
| BspWebhookEvent | 30 days | Debugging |
| BspHealthSnapshot | 90 days | Analytics |
| BspToken (expired) | 7 days | Rotation safety |
| BspOnboardingSession | 30 days | Troubleshooting |

### Cleanup Policies

```typescript
// Auto-delete old webhook events
db.bsp_webhook_events.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 }  // 30 days
);

// Archive old message dispatch
db.bsp_message_dispatch.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 31536000 }  // 1 year
);
```

---

## Conclusion

The data model is designed for:
- **Scalability:** Proper indexing and partitioning
- **Security:** Encrypted sensitive fields
- **Auditability:** Complete lifecycle tracking
- **Performance:** Optimized queries
- **Maintainability:** Clear relationships

This structure supports the BSP Provider's core mission of managing multi-provider WhatsApp business applications at scale.

---

**Next Document:** [04-API-REFERENCE.md](04-API-REFERENCE.md) - Explore all available APIs

