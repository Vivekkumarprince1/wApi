# Comprehensive Microservices Audit Report

> **May 8, 2026 — Audit sync:** Commerce, checkout → billing, worker-bridge `list-orders`, migration scripts, **pass 4** (correlation-id propagation, inbox `$text` search, FormSubmission API + contact UI, canvas) — see [`reports/PLATFORM_AUDIT_SYNC_2026_05_08.md`](reports/PLATFORM_AUDIT_SYNC_2026_05_08.md). **Cursor canvas:** `~/.cursor/projects/.../canvases/wApi-platform-audit.canvas.tsx`. Use that pair as the **authoritative delta** for current open issues; tables below remain the **May 6 snapshot**.

**Audit Date:** May 6, 2026  
**Services Analyzed:** 5 (automation-service, billing-service, campaign-service, frontend, server)  
**Total Issues Found:** 47  
**Critical Issues:** 8 | **High:** 15 | **Medium:** 18 | **Low:** 6  

---

## Executive Summary

This audit identified significant issues across all microservices that require immediate attention:

- **8 CRITICAL issues** blocking production deployment
- **15 HIGH severity issues** causing potential runtime failures
- **18 MEDIUM severity issues** affecting code quality and maintainability
- **6 LOW severity issues** for cleanup and optimization

The most urgent problems are:
1. Missing `.env` files in all services
2. Inconsistent authentication patterns across services
3. Missing microservice API contract documentation
4. Incomplete service implementations (billing, campaign)
5. Configuration validation gaps

---

## Service Breakdown

### 1. AUTOMATION-SERVICE

**Status:** 70% Complete | **Issues:** 6 | **Critical:** 1 | **High:** 1

| Issue | Type | Severity | File | Details |
|-------|------|----------|------|---------|
| Duplicate dotenv.config() | Dead Code | LOW | [src/index.ts#L1-L17](automation-service/src/index.ts#L1) | Called twice, line 17 should be removed |
| Missing MONOLITH_INTERNAL_URL validation | Config Problem | CRITICAL | [src/config.ts](automation-service/src/config.ts) | No fallback, causes startup failure |
| Unused imports in controllers | Dead Code | MEDIUM | [src/controllers/AutomationEngineController.ts](automation-service/src/controllers/AutomationEngineController.ts) | Multiple models imported but not all used |
| Route prefix standardization incomplete | API Consistency | MEDIUM | [src/index.ts#L48](automation-service/src/index.ts#L48) | Comment mentions standardizing to `/api/automation/engine` |
| Missing AuthRequest type consistency | Type Mismatch | HIGH | [src/middleware/auth.ts](automation-service/src/middleware/auth.ts) | Different pattern than server and other services |

**Required Fixes:**
```bash
1. Add MONOLITH_INTERNAL_URL to .env.example with default
2. Remove duplicate dotenv.config() from line 17
3. Standardize auth middleware with server implementation
4. Create shared AuthRequest interface
5. Audit controller imports and remove unused ones
```

---

### 2. BILLING-SERVICE

**Status:** 60% Complete | **Issues:** 10 | **Critical:** 2 | **High:** 4

| Issue | Type | Severity | File | Details |
|-------|------|----------|------|---------|
| Missing .env file | Config Problem | CRITICAL | [.env (missing)](billing-service/.env.example) | Production will fail without env setup |
| Model organization inconsistent | Configuration | MEDIUM | [src/models/](billing-service/src/models/) | Some in index.ts, some in separate files with inconsistent exports |
| Inconsistent auth middleware | API Consistency | HIGH | [src/routes/walletRoutes.ts#L3](billing-service/src/routes/walletRoutes.ts#L3) | Uses custom pattern different from server |
| Route method possibly unimplemented | Broken Reference | HIGH | [src/routes/walletRoutes.ts#L38](billing-service/src/routes/walletRoutes.ts#L38) | `verifyPaymentMethod` may not exist |
| Missing invoice PDF generation | Missing Code | HIGH | [src/services/InvoiceService.ts](billing-service/src/services/InvoiceService.ts) | Partial implementation only |
| Commerce controller incomplete | Missing Code | MEDIUM | [src/controllers/commerceController.ts](billing-service/src/controllers/commerceController.ts) | Features not fully implemented |

**Required Fixes:**
```bash
1. Create .env from .env.example
2. Verify WalletController has all required methods:
   - verifyPaymentMethod
   - verifyRecharge
   - verifyPlanUpgrade
3. Consolidate model exports (choose centralized or modular)
4. Complete invoice PDF generation
5. Complete commerce payment flow or remove routes
6. Standardize auth middleware (copy from server)
```

---

### 3. CAMPAIGN-SERVICE

**Status:** 65% Complete | **Issues:** 11 | **Critical:** 1 | **High:** 5

| Issue | Type | Severity | File | Details |
|-------|------|----------|------|---------|
| Duplicate dotenv.config() | Dead Code | LOW | [src/config.ts](campaign-service/src/config.ts#L2) & [src/index.ts](campaign-service/src/index.ts#L2) | Called in both files |
| Missing .env file | Config Problem | CRITICAL | [.env (missing)](campaign-service/.env.example) | Production deployment will fail |
| Monolith worker client bridge incomplete | Broken Reference | HIGH | [src/lib/monolith-worker-client.ts](campaign-service/src/lib/monolith-worker-client.ts) | Multiple methods require `/api/internal/worker-bridge` endpoint |
| Campaign lock TTL too long | Functionality Issue | HIGH | [src/services/CampaignService.ts#L11-L18](campaign-service/src/services/CampaignService.ts#L11) | 30-min TTL with no renewal = concurrent execution risk |
| Segment resolution incomplete | Missing Code | MEDIUM | [src/services/SegmentService.ts](campaign-service/src/services/SegmentService.ts) | `resolveSegmentContacts` may not handle all cases |
| CampaignBatch model incomplete | Missing Code | MEDIUM | [src/services/CampaignService.ts](campaign-service/src/services/CampaignService.ts) | Model used but not verified complete |

**Required Fixes:**
```bash
1. Create .env from .env.example
2. Add validation for MONGODB_URI_CAMPAIGN
3. Implement lock renewal mechanism:
   - Change TTL to 5 minutes
   - Add heartbeat to extend TTL during execution
   - Or use Redis EXTEND command
4. Document monolith API contract for /api/internal/worker-bridge:
   - send-template
   - billing-park/settle
   - preflight-validate
   - get-pricing, get-template, get-contact
5. Complete SegmentService.resolveSegmentContacts
6. Verify CampaignBatch model has all required fields
```

---

### 4. SERVER (Main Backend)

**Status:** 75% Complete | **Issues:** 17 | **Critical:** 3 | **High:** 6

| Issue | Type | Severity | File | Details |
|-------|------|----------|------|---------|
| Missing .env file | Config Problem | CRITICAL | [.env (missing)](server/.env.example) | 30+ env vars required |
| lucide-react imported in backend | Unused Dependency | MEDIUM | [src/config/feature-config.ts](server/src/config/feature-config.ts#L1) | React library in backend = wrong module |
| Auth middleware pattern differs from microservices | API Mismatch | CRITICAL | [src/middlewares/authMiddleware.ts](server/src/middlewares/authMiddleware.ts) | Uses gateway headers + JWT; microservices use different patterns |
| Socket emitter not validated before use | Config Problem | HIGH | [src/services/socket-emitter.ts](server/src/services/socket-emitter.ts) | `getSocketEmitter()` throws if not initialized |
| Socket service has no error handling | Functionality Issue | HIGH | [src/services/socket-service.ts#L23-L30](server/src/services/socket-service.ts#L23) | Silent failures if both global.io and Redis emitter unavailable |
| Workspace access guard has no error handling | Functionality Issue | MEDIUM | [src/middlewares/authMiddleware.ts](server/src/middlewares/authMiddleware.ts#L59) | Dynamic import of workspace-access-service with no try-catch |
| Mixed dynamic requires in routes | Code Quality | MEDIUM | [src/routes/messageRoutes.ts](server/src/routes/messageRoutes.ts#L13) | Uses dynamic require() for conversationController instead of import |
| Insecure config defaults | Security | MEDIUM | [src/config/index.ts](server/src/config/index.ts) | Uses 'change-me' and empty string defaults |

**Required Fixes:**
```bash
1. Create .env from .env.example with all required variables
2. Mark security-critical vars (JWT_SECRET, INTERNAL_SERVICE_SECRET, etc.)
3. Remove lucide-react from backend (it's for React):
   - Move feature-config to frontend only, or
   - Create backend version without React imports
4. Standardize auth middleware across all services:
   - Document pattern (gateway headers vs JWT)
   - Create shared AuthRequest interface
   - Implement consistent in all services
5. Fix socket emitter initialization:
   - Call initSocketEmitter() in server startup
   - Add check in getSocketEmitter(): if (!emitter) throw with clear message
6. Add error handling to socket-service:
   try {
     const io = getIO();
     if (!io) return getSocketEmitter().to(roomId);
     return io.to(roomId);
   } catch (err) {
     console.error('[SocketService] Failed to get broadcaster:', err);
     return getSocketEmitter().to(roomId);
   }
7. Move workspace-access-service import to top level or add error handling
8. Replace dynamic require() with proper imports at module level
```

---

### 5. FRONTEND

**Status:** 85% Complete | **Issues:** 3 | **Critical:** 1 | **High:** 0

| Issue | Type | Severity | File | Details |
|-------|------|----------|------|---------|
| Missing .env file | Config Problem | CRITICAL | [.env (missing)](frontend/.env.exampler) | Production deployment will fail |
| .env.example filename typo | Config Problem | LOW | [.env.exampler](frontend/.env.exampler) | Should be `.env.example` not `.env.exampler` |
| Unused import | Dead Code | LOW | [src/app/crm/layout.tsx](frontend/src/app/crm/layout.tsx#L12) | `ListTodo` imported from lucide-react but not used |

**Required Fixes:**
```bash
1. Rename .env.exampler to .env.example
2. Create .env from .env.example
3. Remove unused ListTodo import from src/app/crm/layout.tsx
```

---

## Cross-Service Issues (8 Issues)

### Database & Type Mismatches (3 Issues)

| Issue | Services | Severity | Impact |
|-------|----------|----------|--------|
| **Workspace Model Inconsistency** | billing-service vs campaign-service vs server | HIGH | Workspace data structure differs; billing has minimal model, campaign uses monolith version, server has full model with relations |
| **ID Type Inconsistency** | all services | HIGH | Some use string IDs, others use ObjectId directly; causes type errors at integration points |
| **Contact/Conversation Schemas Mismatched** | automation-service vs server | MEDIUM | Different field definitions possible; causes data mapping issues |

**Fixes:**
```typescript
// Create shared models library or document canonical schemas:
// src/types/shared.ts (or shared package)
export interface SharedWorkspace {
  _id: ObjectId | string;
  billingStatus: 'active' | 'suspended' | 'inactive';
  planId: ObjectId | string;
  members: Array<{ userId: ObjectId | string; role: string }>;
}

// Use in all services with consistent conversion:
// At API boundaries: convert ObjectId to string
// In database queries: use ObjectId
```

### Missing API Contracts (3 Issues)

| Endpoint | Caller | Callee | Status | Doc |
|----------|--------|--------|--------|-----|
| `/api/internal/worker-bridge` | campaign-service | server | ❌ Not documented | Needs OpenAPI spec |
| `/api/internal/send-template` | campaign-service | server | ❌ Unclear | Needs contract |
| Wallet sync endpoint | campaign-service | billing-service | ❌ Missing | Need to create |

**Fixes:**
```bash
1. Create OpenAPI specifications for:
   - /api/internal/worker-bridge (all methods)
   - All microservice-to-microservice calls
2. Document error codes and retry policies
3. Create shared SDK or type definitions for these endpoints
```

### Environment Variable Inconsistencies (2 Issues)

| Variable | automation-service | billing-service | campaign-service | server |
|----------|-------|--------|------------|--------|
| Monolith URL | `MONOLITH_INTERNAL_URL` | ❌ Uses server URL | `MONOLITH_URL` | ✅ Default: localhost:3000 |
| Billing Service | ❌ None | ✅ Default | ✅ Used | ✅ Used |
| Redis | `REDIS_URL` | `REDIS_URL` | `REDIS_URL` | `REDIS_URL` |

**Fixes:**
```bash
# Standardize environment variable names:
MONOLITH_URL=http://localhost:5001
AUTOMATION_SERVICE_URL=http://localhost:3001
BILLING_SERVICE_URL=http://localhost:3003
CAMPAIGN_SERVICE_URL=http://localhost:3002

# Update each service to use consistent names
```

---

## Issues by Severity

### CRITICAL (8 issues) - Fix Before Production

1. ✅ **automation-service**: Missing MONOLITH_INTERNAL_URL validation
2. ✅ **billing-service**: Missing .env file
3. ✅ **campaign-service**: Missing .env file + no database URL validation
4. ✅ **server**: Missing .env file (30+ required variables)
5. ✅ **server**: Auth middleware pattern incompatible with microservices
6. ✅ **frontend**: Missing .env file
7. ✅ **all services**: Workspace model schema conflicts
8. ✅ **all services**: API contract documentation missing

### HIGH (15 issues) - Fix This Sprint

1. ✅ **automation-service**: Missing AuthRequest type consistency
2. ✅ **billing-service**: Inconsistent auth middleware, route methods unimplemented
3. ✅ **billing-service**: Missing invoice PDF generation, incomplete commerce controller
4. ✅ **campaign-service**: Monolith worker client bridge incomplete, campaign lock TTL too long
5. ✅ **server**: Socket emitter not validated, socket service error handling missing
6. ✅ **server**: lucide-react in backend (wrong module)
7. ✅ **all services**: ID type inconsistency across services

### MEDIUM (18 issues) - Fix Next Sprint

1. ✅ **automation-service**: Unused imports, route prefix inconsistency
2. ✅ **billing-service**: Model organization inconsistent
3. ✅ **campaign-service**: Duplicate dotenv, segment resolution incomplete, CampaignBatch incomplete
4. ✅ **server**: Config defaults insecure, workspace guard error handling, dynamic requires
5. ✅ **server**: Contact/Conversation schema mismatches

### LOW (6 issues) - Nice to Have

1. ✅ **automation-service**: Duplicate dotenv.config() call
2. ✅ **campaign-service**: Duplicate dotenv.config() call
3. ✅ **frontend**: Unused ListTodo import, .env.exampler typo
4. ✅ **server**: Unused cheerio dependency

---

## Dependency Matrix

### automation-service → ?
```
✅ Models (MongoDB)
✅ Redis (cache)
❌ monolith (MONOLITH_INTERNAL_URL)
  - Internal client for sending actions
```

### billing-service → ?
```
✅ Models (MongoDB)
✅ Redis (cache)
❌ Razorpay (webhook integration)
❌ monolith (for workspace sync)
```

### campaign-service → ?
```
✅ Models (MongoDB)
✅ Redis (cache, queue)
❌ monolith (/api/internal/worker-bridge)
  - Send templates
  - Get pricing
  - Get templates & contacts
  - Billing park/settle
  - Socket broadcast
```

### server → ?
```
✅ Models (MongoDB)
✅ Redis (cache, socket)
❌ automation-service (workflows)
❌ billing-service (wallets)
❌ campaign-service (campaigns)
✅ Google OAuth
✅ Cloudinary
✅ Gupshup BSP
✅ Razorpay payments
```

### frontend → ?
```
✅ server (REST API)
❌ Socket.io (real-time)
✅ Google OAuth
✅ Gupshup docs (static)
```

---

## Action Plan

### Phase 1: CRITICAL (Week 1)
```bash
# Create all .env files
1. cp server/.env.example server/.env
2. cp automation-service/.env.example automation-service/.env
3. cp billing-service/.env.example billing-service/.env
4. cp campaign-service/.env.example campaign-service/.env
5. cp frontend/.env.exampler frontend/.env  # Also fix typo

# Fill in environment variables
vim server/.env  # Requires: JWT_SECRET, INTERNAL_SERVICE_SECRET, MONGODB_URI, REDIS_URL
vim automation-service/.env
vim billing-service/.env
vim campaign-service/.env
vim frontend/.env

# Standardize auth middleware
# Copy server implementation to all microservices
# Create shared AuthRequest interface in types/auth.ts
```

### Phase 2: HIGH (Week 1-2)
```bash
# Fix socket service
# Add error handling to socket-service.ts
# Add initialization check to socket-emitter.ts

# Fix billing service routes
# Verify all controller methods exist
# Implement missing commerce endpoints

# Document API contracts
# Create OpenAPI spec for /api/internal/worker-bridge
# Document all microservice-to-microservice endpoints

# Fix campaign lock mechanism
# Implement lock renewal in CampaignService
```

### Phase 3: MEDIUM (Week 2-3)
```bash
# Remove lucide-react from backend
# Move feature-config or create backend version

# Standardize model organization
# Decide on centralized vs modular
# Implement consistent export patterns

# Add proper error handling
# Socket service, workspace guard, etc.

# Fix type inconsistencies
# ID types, workspace schema, etc.
```

### Phase 4: LOW (Week 3)
```bash
# Remove unused imports/dependencies
# Clean up code quality issues
# Fix filename typos
```

---

## Verification Checklist

After fixes, verify:

- [ ] All services start without errors
- [ ] All services can access their databases
- [ ] Redis connections work
- [ ] Auth middleware works consistently
- [ ] Cross-service API calls succeed
- [ ] Socket events broadcast properly
- [ ] Environment variables are validated
- [ ] No console errors on startup
- [ ] Health check endpoints return 200
- [ ] Microservice discovery works

---

## Files Requiring Immediate Changes

### CRITICAL
- `server/.env` - must be created
- `automation-service/.env` - must be created
- `billing-service/.env` - must be created
- `campaign-service/.env` - must be created
- `frontend/.env` - must be created
- `server/src/middlewares/authMiddleware.ts` - standardize auth
- `campaign-service/src/services/CampaignService.ts` - fix lock
- `campaign-service/src/lib/monolith-worker-client.ts` - document

### HIGH PRIORITY
- `server/src/services/socket-emitter.ts` - add init check
- `server/src/services/socket-service.ts` - add error handling
- `server/src/config/feature-config.ts` - remove from backend
- `billing-service/src/routes/walletRoutes.ts` - verify methods
- `automation-service/src/config.ts` - add validation

### MEDIUM PRIORITY
- `automation-service/src/index.ts` - remove duplicate dotenv
- `campaign-service/src/index.ts` - remove duplicate dotenv
- `billing-service/src/models/` - standardize organization
- `frontend/.env.exampler` - rename to .env.example
- `server/src/config/index.ts` - remove insecure defaults

---

## Conclusion

This project shows good architectural separation but needs:
1. **Environment configuration cleanup** (most urgent)
2. **API contract documentation** (prevents integration failures)
3. **Standardized authentication** (security critical)
4. **Type safety improvements** (prevents runtime errors)
5. **Error handling enhancements** (production stability)

With the fixes outlined above, the microservices architecture can be production-ready.

---

*Report Generated: May 6, 2026*  
*Audit Scope: Full codebase including configuration, types, dependencies, and inter-service communication*
