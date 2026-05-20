# BSP Provider Architecture
## Detailed System Design and Implementation Patterns

**Document Version:** 1.0.0  
**Previous Document:** 01-BSP-PROVIDER-OVERVIEW.md  
**Next Document:** 03-DATA-MODELS.md

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Components](#system-components)
3. [Data Flow](#data-flow)
4. [Module Organization](#module-organization)
5. [Design Patterns](#design-patterns)
6. [Request Lifecycle](#request-lifecycle)
7. [Error Handling](#error-handling)
8. [Scalability Strategy](#scalability-strategy)
9. [Integration Flows](#integration-flows)
10. [Performance Optimization](#performance-optimization)

---

## Architecture Overview

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  API Layer (Presentation)               │
│  Controllers: Apps, Messages, Templates, Webhooks, etc. │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│           Business Logic Layer (Application)            │
│  Services: AppsService, MessagesService, etc.           │
│  Provider Adapters: GupshupClientService                │
│  Guards: InternalAuthGuard, WorkspaceAuthGuard          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│             Data Access Layer (Persistence)             │
│  Mongoose Models: BspApp, BspProvider, BspToken, etc.   │
│  Repository Pattern Implementation                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│           Infrastructure Layer (External)               │
│  MongoDB, Redis, External Provider APIs                 │
└─────────────────────────────────────────────────────────┘
```

### Horizontal Module Structure

```
BSP Service Root
│
├── admin/                    → Provider management
│   ├── admin.controller.ts
│   └── admin.service.ts
│
├── apps/                     → Application CRUD
│   ├── apps.controller.ts
│   └── apps.service.ts
│
├── onboarding/              → Onboarding flows
│   ├── onboarding.controller.ts
│   └── onboarding.service.ts
│
├── messages/                → Message dispatch
│   ├── messages.controller.ts
│   └── messages.service.ts
│
├── templates/               → Template management
│   └── templates.controller.ts
│
├── media/                   → Media asset management
│   └── media.controller.ts
│
├── profiles/                → Profile management
│   └── profiles.controller.ts
│
├── webhooks/                → Webhook ingestion
│   ├── webhooks.controller.ts
│   └── webhooks.service.ts
│
├── subscriptions/           → Subscription management
│   └── subscriptions.controller.ts
│
├── tokens/                  → Token lifecycle
│   ├── tokens.controller.ts
│   └── tokens.service.ts
│
├── phones/                  → Phone number management
│   └── phones.controller.ts
│
├── health/                  → Health monitoring
│   └── health.controller.ts
│
├── esb-flow/                → ESB integration flows
│   ├── esb-flow.controller.ts
│   └── esb-flow.service.ts
│
├── provider-actions/        → Provider-specific actions
│   └── provider-actions.controller.ts
│
├── workspace/               → Workspace operations
│   ├── workspace.controller.ts
│   └── workspace.service.ts
│
├── gupshup/                 → Provider implementation
│   └── gupshup-client.service.ts
│
├── common/                  → Shared utilities
│   ├── api-response.ts
│   ├── internal-auth.guard.ts
│   ├── workspace-auth.guard.ts
│   └── workspace-scoped.model.ts
│
├── models/                  → MongoDB schemas
│   ├── bsp-app.schema.ts
│   ├── bsp-provider.schema.ts
│   ├── bsp-credential.schema.ts
│   ├── bsp-token.schema.ts
│   ├── bsp-message-dispatch.schema.ts
│   ├── bsp-template-mirror.schema.ts
│   ├── bsp-media-asset.schema.ts
│   ├── bsp-webhook-event.schema.ts
│   ├── bsp-health-snapshot.schema.ts
│   ├── bsp-onboarding-session.schema.ts
│   ├── bsp-onboarding-state.schema.ts
│   ├── bsp-esb-flow.schema.ts
│   └── common.ts
│
├── config.ts                → Environment configuration
├── app.module.ts            → Root module definition
└── main.ts                  → Application entry point
```

---

## System Components

### 1. **Controller Layer**

Controllers handle HTTP requests and delegate to services.

```typescript
// Example: AppsController
@Controller('/internal/v1/bsp/apps')
@UseGuards(InternalAuthGuard)
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Post()
  async create(@Body() input: CreateAppDto) {
    return ok(await this.appsService.create(input));
  }

  @Get(':appId')
  async get(@Param('appId') appId: string) {
    return ok(await this.appsService.get(appId));
  }

  @Delete(':appId')
  async delete(@Param('appId') appId: string) {
    return ok(await this.appsService.remove(appId));
  }
}
```

**Responsibilities:**
- Request validation
- Parameter extraction
- Response formatting
- Error propagation

### 2. **Service Layer**

Services contain business logic and orchestrate data operations.

```typescript
// Example: AppsService
@Injectable()
export class AppsService {
  constructor(
    @InjectModel(BspApp.name) private appModel: Model<BspApp>,
    private gupshup: GupshupClientService
  ) {}

  async create(input: CreateAppDto): Promise<BspApp> {
    // Validate input
    // Create app record
    // Initialize with provider
    // Return created app
  }

  async get(appId: string): Promise<BspApp> {
    // Fetch from DB
    // Handle not found
    // Return app
  }
}
```

**Responsibilities:**
- Business logic execution
- Data validation
- Service coordination
- Error handling

### 3. **Provider Adapter Pattern**

```typescript
// GupshupClientService implements provider-agnostic interface
@Injectable()
export class GupshupClientService implements IBspProvider {
  async createEmbeddedOnboardingLink(input: OnboardingInput): Promise<OnboardingResult> {
    // Gupshup-specific implementation
  }

  async sendMessage(input: MessageInput): Promise<MessageResult> {
    // Gupshup message API call
  }

  async refreshAppToken(appId: string): Promise<TokenResult> {
    // Gupshup token refresh
  }
}
```

**Advantages:**
- Easy to add new providers
- Testable with mocks
- No tight coupling to provider

### 4. **Guard Layer**

Guards enforce security and access control.

```typescript
// InternalAuthGuard - authenticates internal service calls
@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    // Validate INTERNAL_SERVICE_SECRET
    return isValid;
  }
}

// WorkspaceAuthGuard - isolates data by workspace
@Injectable()
export class WorkspaceAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Verify workspace access
    // Inject workspaceId into request
  }
}
```

---

## Data Flow

### Message Send Flow

```
┌──────────────────────────────────────────────────────┐
│  Main Service                                         │
│  POST /internal/v1/bsp/messages/send                  │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  BSP Service Messages Controller                      │
│  • Validates request format                           │
│  • Extracts appId, payload                            │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  MessagesService                                      │
│  • Retrieves BspApp record                            │
│  • Validates app status (must be live)                │
│  • Formats payload for provider                       │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  GupshupClientService                                 │
│  • Calls Gupshup REST API                             │
│  • Handles provider errors                            │
│  • Returns messageId                                  │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  BspMessageDispatch (MongoDB)                         │
│  Records:                                             │
│  • messageId from provider                            │
│  • Status: pending → sent → delivered → read          │
│  • Timestamps and metadata                            │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  Response to Main Service                             │
│  {                                                    │
│    "success": true,                                   │
│    "messageId": "wamid.xxx",                          │
│    "status": "sent"                                   │
│  }                                                    │
└──────────────────────────────────────────────────────┘
```

### Webhook Ingestion Flow

```
┌──────────────────────────────────────────────────────┐
│  Gupshup Provider                                     │
│  Sends webhook event (delivery status, incoming msg)  │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  WebhooksController                                   │
│  POST /webhooks/gupshup                               │
│  • Validates webhook signature                        │
│  • Extracts event data                                │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  WebhooksService                                      │
│  • Parses event type (status_update, message_in, etc) │
│  • Finds related BspMessageDispatch                   │
│  • Updates status in database                         │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  Event Queue (BullMQ)                                 │
│  • Enqueues notification job                          │
│  • Ensures reliable processing                        │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  Main Service (via internal event)                    │
│  Updates Message Status                               │
└──────────────────────────────────────────────────────┘
```

### App Onboarding Flow

```
┌──────────────────────────────────────────────────────┐
│  1. Start Onboarding                                  │
│  POST /internal/v1/bsp/onboarding/start               │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  OnboardingService                                    │
│  • Creates BspOnboardingSession record                │
│  • Generates embedded link via GupshupClientService   │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  Returns                                              │
│  {                                                    │
│    "onboardingUrl": "https://partner.gupshup.io...", │
│    "sessionId": "session_123"                         │
│  }                                                    │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  2. User completes onboarding in Gupshup UI           │
│  Browser redirects to callbackUrl                     │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  3. Complete Onboarding                               │
│  POST /internal/v1/bsp/onboarding/complete            │
│  • Validates callback state                           │
│  • Stores provider credentials                        │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│  Updates BspApp                                       │
│  • Status: onboarding → connected → live              │
│  • Stores credentials in BspCredential                │
│  • Initializes BspToken                               │
└──────────────────────────────────────────────────────┘
```

---

## Module Organization

### Module Dependency Graph

```
app.module
│
├── Admin Module
│   └── AdminService
│
├── Apps Module
│   ├── AppsController
│   ├── AppsService
│   └── BspApp Model
│
├── Onboarding Module
│   ├── OnboardingController
│   ├── OnboardingService
│   └── BspOnboardingSession Model
│
├── Messages Module
│   ├── MessagesController
│   ├── MessagesService
│   └── BspMessageDispatch Model
│
├── Templates Module
│   ├── TemplatesController
│   └── BspTemplateMirror Model
│
├── Webhooks Module
│   ├── WebhooksController
│   ├── WebhooksService
│   └── BspWebhookEvent Model
│
├── Tokens Module
│   ├── TokensController
│   ├── TokensService
│   └── BspToken Model
│
├── Provider Adapter
│   └── GupshupClientService
│
├── Guards (Shared)
│   ├── InternalAuthGuard
│   └── WorkspaceAuthGuard
│
└── Models (Shared)
    └── All MongoDB Schemas
```

---

## Design Patterns

### 1. **Provider Adapter Pattern**

Abstracts provider-specific logic behind a common interface.

```typescript
interface IBspProvider {
  createEmbeddedOnboardingLink(input: any): Promise<any>;
  sendMessage(input: any): Promise<any>;
  refreshAppToken(appId: string): Promise<any>;
  getApp(appId: string): Promise<any>;
  providerAction(input: any): Promise<any>;
}

class GupshupClientService implements IBspProvider {
  // Gupshup-specific implementation
}

// Future: Easy to add new providers
class MetaClientService implements IBspProvider {
  // Meta-specific implementation
}
```

**Benefits:**
- Loose coupling from specific providers
- Easy testing with mocks
- Simple provider switching

### 2. **Repository Pattern**

Access data through abstraction instead of direct queries.

```typescript
// Instead of this (anti-pattern):
const app = await db.collection('bsp_apps').findOne({ appId });

// Do this (repository pattern):
const app = await this.appModel.findOne({ appId });
// Model acts as repository
```

### 3. **Service Locator Pattern**

Dependency injection of services.

```typescript
@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(BspMessageDispatch.name) 
    private messageModel: Model<BspMessageDispatch>,
    private gupshup: GupshupClientService
  ) {}
}
```

### 4. **Guard Pattern**

Authentication and authorization as cross-cutting concerns.

```typescript
@Controller('/internal/v1/bsp/messages')
@UseGuards(InternalAuthGuard, WorkspaceAuthGuard)
export class MessagesController {
  // Guard validates authentication before reaching controller
}
```

### 5. **Async Job Queue Pattern**

Offload long-running tasks to queue.

```typescript
// Webhook processing
async onWebhookReceived(event: WebhookEvent) {
  // Store event
  const saved = await this.webhookModel.create(event);
  
  // Queue processing job
  await this.queue.add('process-webhook', { eventId: saved._id });
}

// Separate worker
@Process('process-webhook')
async processWebhook(job: Job<{ eventId: string }>) {
  // Long-running processing
  // Update message status
  // Notify downstream services
}
```

---

## Request Lifecycle

### Complete Request Processing Flow

```
1. HTTP Request Arrives
   ↓
2. Express Middleware
   ├─ Parse JSON body
   ├─ Extract headers
   └─ Log request
   ↓
3. Route Matching
   └─ NestJS router finds handler
   ↓
4. Middleware Execution
   └─ Global/route-specific middleware
   ↓
5. Guard Execution
   ├─ InternalAuthGuard
   │  └─ Validates INTERNAL_SERVICE_SECRET
   ├─ WorkspaceAuthGuard
   │  └─ Validates workspace access
   └─ Other guards
   ↓
6. Interceptor (Before Handler)
   ├─ Logging
   ├─ Performance tracking
   └─ Request context setup
   ↓
7. Controller Handler
   ├─ Validate input DTOs
   ├─ Extract parameters
   └─ Call service
   ↓
8. Service Layer
   ├─ Business logic
   ├─ Data validation
   ├─ Database operations
   ├─ External API calls (if needed)
   └─ Return result
   ↓
9. Exception Handling
   ├─ If error occurs
   ├─ Global exception filter catches
   └─ Formats error response
   ↓
10. Interceptor (After Handler)
    ├─ Format response
    ├─ Add metadata
    └─ Track metrics
    ↓
11. Response Serialization
    └─ Convert to JSON
    ↓
12. HTTP Response Sent
    ├─ Status code
    ├─ Headers
    └─ Body
```

---

## Error Handling

### Global Error Handling

```typescript
// Global exception filter
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    let status = 500;
    let message = 'Internal Server Error';
    let details = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    } else if (exception instanceof ValidationError) {
      status = 400;
      message = 'Validation Error';
      details = exception.messages;
    } else if (exception instanceof NotFoundException) {
      status = 404;
      message = 'Not Found';
    }

    response.status(status).json({
      success: false,
      error: message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      details
    });
  }
}
```

### Provider Error Handling

```typescript
async sendMessage(input: any) {
  try {
    const response = await this.gupshup.send(input);
    return response;
  } catch (error) {
    if (error.status === 401) {
      // Token expired, trigger refresh
      await this.refreshToken(input.appId);
      // Retry send
      return this.sendMessage(input);
    } else if (error.status === 429) {
      // Rate limited, queue for retry
      throw new RateLimitedException();
    } else {
      // Other error
      throw new ProviderException(error.message);
    }
  }
}
```

---

## Scalability Strategy

### Horizontal Scaling

```
Load Balancer
      │
      ├── Pod 1 (BSP Service)
      ├── Pod 2 (BSP Service)
      ├── Pod 3 (BSP Service)
      └── Pod N (BSP Service)
      
All pods share:
- Kubernetes ConfigMap (config)
- MongoDB (single cluster)
- Redis (single cluster)
- BullMQ Queue (single cluster)
```

### Database Scalability

**MongoDB:**
- Sharding by `workspaceId` for multi-tenant isolation
- Indexes on frequently queried fields
- Connection pooling via mongoose

**Redis:**
- Single primary with replicas for high availability
- Persistent storage enabled
- Key expiration policies

### Queue Scalability

**BullMQ:**
- Multiple worker processes
- Job prioritization
- Retry logic with exponential backoff
- Dead letter queues for failed jobs

---

## Integration Flows

### Flow 1: Message Send (Main Service → BSP Service → Gupshup)

```
Main Service
  │
  └─POST /internal/v1/bsp/messages/send
      {
        "appId": "gupshup_app_123",
        "to": "+919876543210",
        "type": "text",
        "text": "Hello!"
      }
      │
      └──► BSP Service
           MessagesController
             │
             └──► MessagesService
                  ├─ Fetch BspApp record
                  ├─ Validate status
                  └─ Format for provider
                      │
                      └──► GupshupClientService
                           └─ POST /message/send
                               └── Gupshup API
                      │
                      └─ Store in BspMessageDispatch
             │
             └──► Response (messageId, status)
```

### Flow 2: Webhook Ingestion (Gupshup → BSP Service → Main Service)

```
Gupshup Provider
  │
  └─POST /webhooks/gupshup
      { "event": "message:status", "wamid": "xyz", "status": "delivered" }
      │
      └──► BSP Service
           WebhooksController
             │
             ├─ Verify signature
             └─ Extract event
                 │
                 └──► WebhooksService
                      ├─ Find BspMessageDispatch by wamid
                      ├─ Update status
                      └─ Queue event for downstream
                          │
                          └──► Main Service
                               (via internal event bus)
```

---

## Performance Optimization

### 1. **Database Indexing**

```typescript
// Indexes on frequently queried fields
@Schema()
export class BspApp {
  @Prop({ index: true })
  workspaceId: string;
  
  @Prop({ index: true })
  appId: string;
  
  @Prop({ index: true })
  status: string;
  
  @Prop({ index: true })
  createdAt: Date;
}

// Composite index for common queries
BspAppSchema.index({ workspaceId: 1, appId: 1 });
```

### 2. **Caching Strategy**

```typescript
// Cache provider responses
async getApp(appId: string) {
  const cached = await this.redis.get(`app:${appId}`);
  if (cached) return JSON.parse(cached);
  
  const app = await this.appModel.findOne({ appId });
  await this.redis.setex(`app:${appId}`, 3600, JSON.stringify(app));
  
  return app;
}
```

### 3. **Query Optimization**

```typescript
// Select only needed fields
const app = await this.appModel.findOne(
  { appId },
  { whatsappAccessToken: 0, accessToken: 0 } // Exclude sensitive
);

// Use lean() for read-only queries
const apps = await this.appModel.find({ workspaceId }).lean();
```

### 4. **Connection Pooling**

```typescript
// Mongoose automatically handles connection pooling
// Configure via URI parameter
mongodb://localhost/db?maxPoolSize=100&minPoolSize=10
```

### 5. **Async Processing**

```typescript
// Don't wait for slow operations
async sendMessage(input) {
  const result = await provider.send(input);
  
  // Queue webhook processing async
  this.queue.add('webhook-process', { ... });
  
  // Return immediately
  return { messageId: result.id };
}
```

---

## Conclusion

The BSP Provider architecture follows enterprise-grade design patterns with:
- **Clear separation of concerns** (Controller → Service → Data)
- **Provider abstraction** for multi-provider support
- **Asynchronous processing** for scalability
- **Security-first approach** (Guards, Auth)
- **Error resilience** (Global error handling, retries)
- **Observability** (Logging, Metrics)

This foundation enables the system to scale from thousands to millions of messages while maintaining reliability and performance.

---

**Next Document:** [03-DATA-MODELS.md](03-DATA-MODELS.md) - Learn about the complete data model structure

