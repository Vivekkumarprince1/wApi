# BSP Provider Implementation Guide
## Developer Guide for Extending and Customizing the System

**Document Version:** 1.0.0  
**Previous Document:** 04-API-REFERENCE.md  
**Next Document:** 06-OPERATIONS.md

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Adding a New Provider](#adding-a-new-provider)
3. [Adding New Functionality](#adding-new-functionality)
4. [Testing Strategy](#testing-strategy)
5. [Code Organization](#code-organization)
6. [Common Patterns](#common-patterns)
7. [Debugging](#debugging)
8. [Performance Tuning](#performance-tuning)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Development Setup

### Prerequisites

```bash
# Required
- Node.js 18+ (latest LTS recommended)
- MongoDB 6.0+
- Redis 7.0+
- npm 9+

# Optional
- Docker & Docker Compose (recommended)
- VSCode with Nest.js extension
- Postman or Insomnia for API testing
```

### Environment Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd wApi/bsp-service

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env

# 4. Update .env with local values
INTERNAL_SERVICE_SECRET=dev-secret-key
MONGODB_URI_BSP=mongodb://localhost:27017/wapi_bsp
REDIS_URL=redis://127.0.0.1:6379
GUPSHUP_PARTNER_TOKEN=your-dev-token

# 5. Start dependencies with Docker
docker-compose up -d

# 6. Run in development mode
npm run dev

# Service runs on http://localhost:3004
```

### Project Structure

```
src/
├── admin/                      # Provider management
├── apps/                       # App CRUD operations
├── onboarding/                # Onboarding flows
├── messages/                  # Message handling
├── templates/                 # Template management
├── media/                     # Media operations
├── profiles/                  # Profile management
├── webhooks/                  # Webhook ingestion
├── subscriptions/             # Subscription management
├── tokens/                    # Token lifecycle
├── phones/                    # Phone registration
├── health/                    # Health checks
├── esb-flow/                  # ESB integration
├── provider-actions/          # Provider-specific actions
├── workspace/                 # Workspace operations
├── gupshup/                   # Gupshup provider implementation
│   └── gupshup-client.service.ts
├── common/                    # Shared utilities
│   ├── api-response.ts
│   ├── internal-auth.guard.ts
│   ├── workspace-auth.guard.ts
│   └── workspace-scoped.model.ts
├── models/                    # MongoDB schemas
│   ├── bsp-app.schema.ts
│   ├── bsp-provider.schema.ts
│   └── ... (other schemas)
├── config.ts                  # Configuration
├── app.module.ts              # Root module
└── main.ts                    # Entry point
```

---

## Adding a New Provider

### Step 1: Create Provider Schema

Add a new provider definition to `models/bsp-provider.schema.ts`:

```typescript
// Create provider record in database
db.bsp_providers.insertOne({
  code: "meta",
  name: "Meta (Official)",
  active: true,
  config: {
    apiBase: "https://graph.instagram.com",
    apiVersion: "v18.0",
    supportEmail: "support@meta.com",
    maxRetries: 3,
    timeoutMs: 30000
  }
});
```

### Step 2: Create Provider Client Service

Create `src/meta/meta-client.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

@Injectable()
export class MetaClientService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.meta.apiBase,
      timeout: 30000,
    });
  }

  async createEmbeddedOnboardingLink(input: {
    workspaceId: string;
    businessId: string;
    callbackUrl: string;
    state: string;
  }) {
    try {
      const response = await this.client.post('/oauth/authorize', {
        client_id: config.meta.clientId,
        redirect_uri: input.callbackUrl,
        state: input.state,
        response_type: 'code',
        scope: 'whatsapp_business_messaging,whatsapp_business_management'
      });
      
      return {
        appId: `meta_app_${input.businessId}`,
        url: response.data.authorization_url,
        providerResponse: response.data,
      };
    } catch (error) {
      throw new Error(`Meta onboarding failed: ${error.message}`);
    }
  }

  async sendMessage(input: {
    appId: string;
    payload: Record<string, unknown>;
  }) {
    // Meta message sending implementation
    const response = await this.client.post(
      `/${config.meta.apiVersion}/messages`,
      input.payload,
      {
        headers: {
          'Authorization': `Bearer ${await this.getAppToken(input.appId)}`
        }
      }
    );
    
    return {
      id: `dispatch_${Date.now()}`,
      messageId: response.data.messages[0].id,
      appId: input.appId,
      payload: input.payload,
    };
  }

  async refreshAppToken(appId: string) {
    // Meta token refresh implementation
    const response = await this.client.post('/oauth/access_token', {
      client_id: config.meta.clientId,
      client_secret: config.meta.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: await this.getRefreshToken(appId)
    });
    
    return {
      appId,
      token: response.data.access_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000).toISOString(),
    };
  }

  async getApp(appId: string) {
    const response = await this.client.get(`/${appId}`, {
      headers: {
        'Authorization': `Bearer ${await this.getAppToken(appId)}`
      }
    });
    
    return {
      appId,
      provider: 'meta',
      data: response.data
    };
  }

  async providerAction(input: {
    appId?: string;
    action: string;
    payload: Record<string, unknown>;
  }) {
    // Route to appropriate Meta API endpoint
    const endpoint = this.mapActionToEndpoint(input.action);
    
    const response = await this.client.post(endpoint, input.payload, {
      headers: {
        'Authorization': `Bearer ${await this.getAppToken(input.appId)}`
      }
    });
    
    return {
      provider: 'meta',
      appId: input.appId,
      action: input.action,
      status: 'success',
      payload: response.data,
    };
  }

  private mapActionToEndpoint(action: string): string {
    const actionMap: Record<string, string> = {
      'get_templates': '/templates',
      'submit_template': '/templates',
      'get_profile': '/profile',
      'update_profile': '/profile',
    };
    return actionMap[action] || '/unknown';
  }

  private async getAppToken(appId: string): Promise<string> {
    // Fetch and cache token from database
    // Return stored token
    return '';
  }

  private async getRefreshToken(appId: string): Promise<string> {
    // Fetch refresh token from database
    return '';
  }
}
```

### Step 3: Register Provider Service in Module

Update `src/app.module.ts`:

```typescript
import { MetaClientService } from './meta/meta-client.service';

@Module({
  providers: [
    GupshupClientService,
    MetaClientService,  // Add new provider
    // ... other providers
  ],
})
export class AppModule {}
```

### Step 4: Create Provider Selection Logic

Update `src/gupshup/gupshup-client.service.ts` to include provider factory:

```typescript
@Injectable()
export class ProviderFactory {
  constructor(
    private gupshup: GupshupClientService,
    private meta: MetaClientService,
  ) {}

  getProvider(providerCode: string): IBspProvider {
    switch (providerCode) {
      case 'gupshup':
        return this.gupshup;
      case 'meta':
        return this.meta;
      default:
        throw new Error(`Unknown provider: ${providerCode}`);
    }
  }
}
```

### Step 5: Define Provider Interface

Create `src/common/provider.interface.ts`:

```typescript
export interface IBspProvider {
  createEmbeddedOnboardingLink(input: OnboardingInput): Promise<OnboardingResult>;
  sendMessage(input: MessageInput): Promise<MessageResult>;
  refreshAppToken(appId: string): Promise<TokenResult>;
  getApp(appId: string): Promise<AppData>;
  providerAction(input: ActionInput): Promise<ActionResult>;
}

export interface OnboardingInput {
  workspaceId: string;
  businessId: string;
  callbackUrl: string;
  state: string;
  metadata?: Record<string, unknown>;
}

export interface OnboardingResult {
  appId: string;
  url: string;
  providerResponse: Record<string, unknown>;
}

// ... other interfaces
```

### Step 6: Add Configuration

Update `src/config.ts`:

```typescript
export const config = {
  // ... existing config
  meta: {
    apiBase: process.env.META_API_BASE || 'https://graph.instagram.com',
    apiVersion: process.env.META_API_VERSION || 'v18.0',
    clientId: process.env.META_CLIENT_ID || '',
    clientSecret: process.env.META_CLIENT_SECRET || '',
  }
};
```

### Step 7: Update Environment Example

Update `.env.example`:

```bash
# Meta Provider
META_API_BASE=https://graph.instagram.com
META_API_VERSION=v18.0
META_CLIENT_ID=your-meta-client-id
META_CLIENT_SECRET=your-meta-client-secret
```

---

## Adding New Functionality

### Example: Add Custom Endpoint

Add new endpoint to handle custom provider action:

**1. Create DTO (Data Transfer Object):**

```typescript
// src/common/dtos/send-bulk-messages.dto.ts
export class SendBulkMessagesDto {
  appId: string;
  recipients: Array<{
    to: string;
    messageText: string;
    templateVariables?: Record<string, string>;
  }>;
}
```

**2. Add Service Method:**

```typescript
// src/messages/messages.service.ts
async sendBulkMessages(input: SendBulkMessagesDto) {
  const app = await this.appModel.findOne({ appId: input.appId });
  if (!app) throw new NotFoundException('App not found');

  const provider = this.providerFactory.getProvider(app.provider);
  
  const results = await Promise.allSettled(
    input.recipients.map(recipient =>
      this.sendMessage({
        appId: input.appId,
        to: recipient.to,
        type: 'text',
        text: recipient.messageText
      })
    )
  );

  return {
    appId: input.appId,
    total: input.recipients.length,
    successful: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
    results: results
  };
}
```

**3. Add Controller Method:**

```typescript
// src/messages/messages.controller.ts
@Post('bulk')
async sendBulk(@Body() dto: SendBulkMessagesDto) {
  return ok(await this.messagesService.sendBulkMessages(dto));
}
```

**4. Add Tests:**

```typescript
// src/messages/messages.service.spec.ts
describe('MessagesService', () => {
  describe('sendBulkMessages', () => {
    it('should send messages to multiple recipients', async () => {
      const input = {
        appId: 'test_app_123',
        recipients: [
          { to: '+919876543210', messageText: 'Hello 1' },
          { to: '+919876543211', messageText: 'Hello 2' }
        ]
      };

      const result = await service.sendBulkMessages(input);

      expect(result.total).toBe(2);
      expect(result.successful).toBeGreaterThan(0);
    });

    it('should handle failures gracefully', async () => {
      // Test error handling
    });
  });
});
```

---

## Testing Strategy

### Unit Testing

```typescript
// Example: Test Apps Service
import { Test, TestingModule } from '@nestjs/testing';
import { AppsService } from './apps.service';
import { getModelToken } from '@nestjs/mongoose';
import { BspApp } from '../models/bsp-app.schema';

describe('AppsService', () => {
  let service: AppsService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppsService,
        {
          provide: getModelToken(BspApp.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<AppsService>(AppsService);
  });

  describe('create', () => {
    it('should create a new app', async () => {
      const input = {
        workspaceId: 'ws_test',
        provider: 'gupshup',
        appName: 'Test App'
      };

      const mockApp = { _id: '123', ...input };
      mockModel.findOneAndUpdate.mockResolvedValue(mockApp);

      const result = await service.create(input);

      expect(result).toEqual(mockApp);
      expect(mockModel.findOneAndUpdate).toHaveBeenCalled();
    });
  });
});
```

### Integration Testing

```typescript
// Test with real database
describe('AppsController (Integration)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('POST /internal/v1/bsp/apps', () => {
    it('should create app', () => {
      return request(app.getHttpServer())
        .post('/internal/v1/bsp/apps')
        .set('Authorization', `Bearer ${process.env.INTERNAL_SERVICE_SECRET}`)
        .send({
          workspaceId: 'ws_test',
          appName: 'Test App',
          provider: 'gupshup'
        })
        .expect(201)
        .expect(res => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.appId).toBeDefined();
        });
    });
  });
});
```

### Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# With coverage
npm run test:cov

# Watch mode
npm run test:watch
```

---

## Code Organization

### Module Structure Best Practices

```typescript
// ✅ Good: Clear separation of concerns
feature/
  ├── feature.controller.ts    (handles HTTP)
  ├── feature.service.ts       (business logic)
  ├── feature.module.ts        (configuration)
  ├── dtos/
  │   ├── create-feature.dto.ts
  │   └── update-feature.dto.ts
  ├── entities/
  │   └── feature.entity.ts
  └── tests/
      ├── feature.controller.spec.ts
      └── feature.service.spec.ts
```

### Naming Conventions

```typescript
// Controllers
class FeatureController { }

// Services
class FeatureService { }

// Modules
class FeatureModule { }

// DTOs
class CreateFeatureDto { }
class UpdateFeatureDto { }

// Entities/Schemas
class Feature { }

// Guards
class FeatureAuthGuard { }

// Middleware
class FeatureMiddleware { }

// Enums
enum FeatureStatus { }

// Interfaces
interface IFeature { }
```

---

## Common Patterns

### Pattern 1: Async Processing with Queue

```typescript
// Use BullMQ for long-running tasks
import { Queue } from 'bullmq';

@Injectable()
export class ProcessingService {
  private queue: Queue;

  constructor() {
    this.queue = new Queue('processing', {
      connection: { host: 'localhost', port: 6379 }
    });
  }

  async queueMessageProcessing(messageId: string) {
    await this.queue.add('process-message', { messageId });
  }
}
```

### Pattern 2: Error Recovery with Retries

```typescript
@Injectable()
export class RetryableService {
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
      }
    }
    
    throw lastError;
  }
}
```

### Pattern 3: Caching with Redis

```typescript
@Injectable()
export class CachedService {
  constructor(private redis: Redis) {}

  async getCachedData<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await fetcher();
    await this.redis.setex(key, ttl, JSON.stringify(data));
    
    return data;
  }
}
```

---

## Debugging

### Enable Debug Logging

```typescript
// Set environment variable
DEBUG=bsp-service:*

// Or in code
import { Logger } from '@nestjs/common';

const logger = new Logger('AppService');
logger.debug('Debug message', { context: 'data' });
```

### Use VSCode Debugger

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug BSP Service",
      "program": "${workspaceFolder}/node_modules/@nestjs/cli/bin/nest.js",
      "args": ["start", "--debug", "0.0.0.0:9229", "--watch"],
      "restart": true,
      "runtimeArgs": ["--nolazy"]
    }
  ]
}
```

### Database Query Logging

```typescript
// Enable MongoDB query logging
mongoose.set('debug', (collection, method, query) => {
  console.log(`${collection}.${method}`, query);
});
```

### Check Service Logs

```bash
# Tail logs
docker logs -f bsp-service

# View specific errors
docker logs bsp-service | grep "ERROR"

# Save to file
docker logs bsp-service > logs.txt 2>&1
```

---

## Performance Tuning

### Database Optimization

```typescript
// 1. Use indexes
BspAppSchema.index({ workspaceId: 1, appId: 1 });
BspAppSchema.index({ status: 1, createdAt: -1 });

// 2. Select specific fields
const app = await this.appModel
  .findOne({ appId })
  .select('appId status -accessToken')  // Exclude sensitive
  .lean();  // Return plain objects

// 3. Batch operations
const apps = await this.appModel
  .find({ status: 'live' })
  .limit(1000)
  .lean();

// 4. Aggregation pipeline
const stats = await this.appModel.aggregate([
  { $match: { status: 'live' } },
  { $group: { _id: '$provider', count: { $sum: 1 } } }
]);
```

### API Response Optimization

```typescript
// 1. Pagination
const limit = 20;
const skip = (page - 1) * limit;
const data = await this.model.find().skip(skip).limit(limit);

// 2. Response compression
// Configure in main.ts
app.use(compression());

// 3. Caching headers
@Get()
cacheableGet() {
  return {
    data: { /* ... */ },
    headers: {
      'Cache-Control': 'public, max-age=300'
    }
  };
}
```

---

## Deployment

### Docker Build

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3004
CMD ["node", "dist/main.js"]
```

### Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bsp-service
  labels:
    app: bsp-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bsp-service
  template:
    metadata:
      labels:
        app: bsp-service
    spec:
      containers:
      - name: bsp-service
        image: your-registry/bsp-service:1.0.0
        ports:
        - containerPort: 3004
        env:
        - name: NODE_ENV
          value: production
        - name: INTERNAL_SERVICE_SECRET
          valueFrom:
            secretKeyRef:
              name: bsp-secrets
              key: internal-secret
        - name: MONGODB_URI_BSP
          valueFrom:
            secretKeyRef:
              name: bsp-secrets
              key: mongodb-uri
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3004
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3004
          initialDelaySeconds: 10
          periodSeconds: 5
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy BSP Service

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test:cov
    
    - name: Build
      run: npm run build
    
    - name: Build Docker image
      run: |
        docker build -t bsp-service:${{ github.sha }} .
        docker tag bsp-service:${{ github.sha }} bsp-service:latest
    
    - name: Push to registry
      run: |
        docker login -u ${{ secrets.REGISTRY_USER }} -p ${{ secrets.REGISTRY_PASSWORD }}
        docker push bsp-service:${{ github.sha }}
        docker push bsp-service:latest
    
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/bsp-service \
          bsp-service=bsp-service:${{ github.sha }} \
          --record
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker logs bsp-service

# Verify environment variables
env | grep -i bsp

# Test database connection
npm run test:db-connection

# Check port availability
lsof -i :3004
```

### Database Connection Issues

```bash
# Test MongoDB connection
mongosh "mongodb://localhost:27017/wapi_bsp"

# Check indexes
db.bsp_apps.getIndexes()

# Verify credentials in .env
cat .env | grep MONGO
```

### Memory Leaks

```bash
# Generate heap dump
kill -USR2 <pid>

# Analyze with clinic.js
npm i -g clinic
clinic doctor -- npm run dev
```

### Performance Issues

```bash
# Check slow queries
db.setProfilingLevel(1, { slowms: 100 })

# Monitor metrics
npm install @nestjs/terminus
# Add health check endpoint
```

---

**Next Document:** [06-OPERATIONS.md](06-OPERATIONS.md) - Learn how to operate in production

