# Week 2 Integration Checklist

Use this to verify all Week 2 features are correctly integrated.

## Prerequisites ✓

- [ ] Node.js v18+ installed
- [ ] MongoDB running (or in-memory DB)
- [ ] Redis running (`redis-server`)
- [ ] All dependencies installed (`npm install`)

---

## Backend Integration

### 1. Token Refresh Cron

**File**: `src/services/tokenRefreshCron.js`

- [ ] File exists and is 280+ lines
- [ ] Has `start()` method
- [ ] Exports singleton instance
- [ ] Uses `secretsManager.retrieveRefreshToken()` and `.storeRefreshToken()`

**In server.js**:
- [ ] Line contains: `const tokenRefreshCron = require('./services/tokenRefreshCron');`
- [ ] Line contains: `tokenRefreshCron.start();`
- [ ] Logs: `"Token refresh cron started (every 6 hours)"`

**Test**:
```bash
# Check logs for cron startup
npm start | grep "Token refresh cron"
# Should show: "✅ Token refresh cron started"
```

---

### 2. Message Retry Queue

**Files**:
- [ ] `src/services/messageRetryQueue.js` exists (280+ lines)
- [ ] `src/middlewares/phoneThroughputMiddleware.js` exists

**In server.js**:
- [ ] Has: `const { initializeMessageRetryQueue, startMessageRetryWorker } = require('./services/messageRetryQueue');`
- [ ] Has: `initializeMessageRetryQueue(redisConnection);`
- [ ] Has: `startMessageRetryWorker(redisConnection);` (optional, for background processing)

**In messageController.js**:
- [ ] Has: `const { enqueueRetry } = require('../services/messageRetryQueue');`
- [ ] In error handler, calls: `await enqueueRetry({...}, err.message, 0);`

**Test**:
```bash
# Check for queue initialization
npm start | grep "Message retry worker"
# Should show: "✅ Message retry worker started"
```

---

### 3. Template Abuse Prevention

**Files**:
- [ ] `src/services/templateAbuseService.js` exists (230+ lines)
- [ ] `src/models/TemplateMetric.js` exists (45+ lines)

**Methods exist**:
- [ ] `recordTemplateCreation(workspaceId, phoneNumberId, templateData)`
- [ ] `recordTemplateRejection(workspaceId, templateName, rejectionReason)`
- [ ] `getWorkspaceMetrics(workspaceId, timeWindowDays)`
- [ ] `getPendingTemplates(workspaceId)`
- [ ] `getRejectedTemplates(workspaceId)`

**Test**:
```bash
# Create metric record
curl -X POST http://localhost:5000/api/v1/admin/templates/create \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name":"test_template"}'
```

---

### 4. Conversation-Based Billing

**Files**:
- [ ] `src/services/conversationBillingService.js` exists (240+ lines)
- [ ] `src/routes/billingRoutes.js` exists (140+ lines)
- [ ] `src/models/Conversation.js` has billing fields added

**Conversation.js fields added**:
- [ ] `conversationType` (customer_initiated / business_initiated)
- [ ] `messageCount`
- [ ] `templateMessageCount`
- [ ] `freeMessageCount`
- [ ] `isBillable`

**In server.js**:
- [ ] Has: `const billingRoutes = require('./routes/billingRoutes');`
- [ ] Has: `app.use('/api/v1/billing', billingRoutes);`

**Methods exist**:
- [ ] `getOrCreateConversation(workspaceId, contactId, messageType)`
- [ ] `getConversationMetrics(workspaceId, startDate, endDate)`
- [ ] `calculateBillingAmount(workspaceId, plan, startDate, endDate)`

**Test**:
```bash
curl http://localhost:5000/api/v1/billing/conversations/current-month \
  -H "Authorization: Bearer TOKEN"
# Should return JSON with conversation metrics
```

---

### 5. Phone Throughput Rate Limiter

**Files**:
- [ ] `src/services/phoneThroughputLimiter.js` exists (100+ lines)
- [ ] `src/middlewares/phoneThroughputMiddleware.js` exists (80+ lines)

**In messageRoutes.js**:
- [ ] Has: `const { checkPhoneThroughput } = require('../middlewares/phoneThroughputMiddleware');`
- [ ] All POST routes have `checkPhoneThroughput` middleware:
  - [ ] `/send` has it
  - [ ] `/template` has it
  - [ ] `/bulk-template` has it

**Limiter initialized**:
- [ ] Redis client passed to `PhoneThroughputLimiter`
- [ ] Plan limits defined: free (1/s), starter (10/s), pro (30/s), enterprise (80/s)

**Test**:
```bash
# Send 15 messages rapid-fire (starter plan = 10/sec)
# Check: 11th should return 429 Too Many Requests
curl -X POST http://localhost:5000/api/v1/messages/template \
  -H "Authorization: Bearer TOKEN" \
  -d '...'
# Response: 429 {"error": "Phone throughput limit exceeded"}
```

---

### 6. RBAC UI Components

**Files**:
- [ ] `client/components/RBACTeamManagement.jsx` exists (220+ lines)
- [ ] `client/components/RBACPermissionsMatrix.jsx` exists (140+ lines)
- [ ] `src/controllers/teamController.js` exists (200+ lines)

**In adminRoutes.js**:
- [ ] Has: `const teamController = require('../controllers/teamController');`
- [ ] Routes added:
  - [ ] `GET /team/members`
  - [ ] `POST /team/invite`
  - [ ] `PUT /team/members/:memberId/role`
  - [ ] `DELETE /team/members/:memberId`
  - [ ] `GET /team/permissions`

**Test**:
```bash
# Get all team members
curl http://localhost:5000/api/v1/admin/team/members \
  -H "Authorization: Bearer TOKEN"
# Returns: { success: true, members: [...] }

# Invite new member
curl -X POST http://localhost:5000/api/v1/admin/team/invite \
  -H "Authorization: Bearer TOKEN" \
  -d '{"email":"agent@team.com","role":"agent"}'
# Returns: { success: true, user: {...} }
```

---

## Model Integration

**Conversation.js**:
- [ ] Original fields intact (workspace, contact, status, etc.)
- [ ] NEW fields added:
  - [ ] `conversationType: String enum`
  - [ ] `messageCount: Number`
  - [ ] `templateMessageCount: Number`
  - [ ] `freeMessageCount: Number`
  - [ ] `isBillable: Boolean`
- [ ] Index added: `{ workspace: 1, conversationStartedAt: 1, isBillable: 1 }`

**TemplateMetric.js**:
- [ ] Schema has: workspaceId, phoneNumberId, templateName, status, rejectionReason, retryCount
- [ ] TTL index: 90 days auto-delete

---

## Routes Integration

**messageRoutes.js**:
```javascript
// Should look like:
router.post('/template',
  messagingRateLimiter,
  checkTokenExpiry,
  checkPhoneThroughput,  // ← WEEK 2
  planCheck('messages', 1),
  sendTemplateMessage
);
```

**billingRoutes.js**:
- [ ] Mounted at `/api/v1/billing`
- [ ] All endpoints RBAC-protected with `billing.view` or `admin.manage`
- [ ] Response format consistent with other routes

**adminRoutes.js**:
- [ ] Team routes mounted
- [ ] All team endpoints protected with RBAC

---

## Environment & Dependencies

**package.json**:
- [ ] `node-cron` package installed (for token refresh)
- [ ] `bull` package available (for message retry queue)
- [ ] `redis` client available

**Verify**:
```bash
npm list node-cron bull redis
# Should show versions for each
```

---

## Security Verification

**RBAC Applied**:
- [ ] Billing endpoints require `billing.view` permission
- [ ] Team management requires `admin.manage` or `team.manage`
- [ ] Phone throughput check uses Redis (can't be bypassed by client)
- [ ] Template abuse tracking is server-side only

**Token Security**:
- [ ] Refresh tokens stored in vault (secretsManager)
- [ ] Access tokens never logged to console
- [ ] Cron job uses encrypted credentials

---

## Database Verification

```bash
# Check Conversation model has billing fields
mongo
> db.conversations.findOne()
# Should show: conversationType, messageCount, isBillable fields

# Check TemplateMetric created
> db.templatemetrics.findOne()
# Should show: workspaceId, templateName, status, rejectionReason

# Verify TTL index
> db.templatemetrics.getIndexes()
# Should show: "ttl_closed_conversations" with expireAfterSeconds: 31536000
```

---

## Performance Tests

### Token Refresh Cron
```bash
# Monitor cron logs (should run at 0000, 0600, 1200, 1800 UTC)
tail -f logs/server.log | grep "TokenRefreshCron"
```

### Message Retry Queue
```bash
# Check Redis queue depth
redis-cli
> llen message-retry:prod:1
# Should be 0-5 (depends on failed messages)
```

### Phone Throughput
```bash
# Rapid message test
for i in {1..15}; do
  curl -X POST http://localhost:5000/api/v1/messages/template \
    -H "Authorization: Bearer TOKEN" \
    -d '...' \
    -w "\nStatus: %{http_code}\n"
done
# Should see: 200 (10 times), 429 (5 times)
```

### Conversation Billing
```bash
# Get current month billing
curl http://localhost:5000/api/v1/billing/conversations/current-month \
  -H "Authorization: Bearer TOKEN" \
  -s | jq .
# Should return valid JSON with metrics
```

---

## Smoke Tests

Run these before declaring Week 2 complete:

```bash
# 1. Server starts without errors
npm start 2>&1 | head -20
# Should see: "listening on port 5000" and cron/queue startup logs

# 2. All endpoints respond
curl http://localhost:5000/api/v1/health -H "Authorization: Bearer TEST"
# Should return 200 OK

# 3. Database connects
curl http://localhost:5000/api/v1/admin/team/members \
  -H "Authorization: Bearer TOKEN" 2>&1 | grep -q "success"
# Should return success response

# 4. Redis queue initialized
redis-cli ping
# Should return: PONG

# 5. Cron job running
npm start 2>&1 | grep -i "token.*cron\|message.*retry"
# Should show startup messages
```

---

## Deployment Readiness

- [ ] All files committed to git
- [ ] No console.log statements left (use logger service)
- [ ] All errors caught and logged
- [ ] Environment variables documented
- [ ] Database migrations run (if any)
- [ ] Tests pass (see TESTING_GUIDE.md)
- [ ] Code reviewed
- [ ] Security audit passed

---

## Sign-Off

- [ ] Tech Lead reviewed & approved
- [ ] QA tested all 6 features
- [ ] Product validated against requirements
- [ ] Performance targets met
- [ ] Ready for staging deployment

**Signed off by**: _______________  
**Date**: _______________  
**Timestamp**: _______________

---

## Rollback Plan

If something breaks in production:

```bash
# 1. Disable token refresh cron
# In .env: TOKEN_REFRESH_DISABLED=true

# 2. Disable message retry queue
# In .env: MESSAGE_RETRY_DISABLED=true

# 3. Disable phone throughput checking
# In messageRoutes.js: Comment out checkPhoneThroughput middleware

# 4. Revert to previous commit
git revert <commit-hash>
npm start

# 5. Verify services restored
curl http://localhost:5000/api/v1/health
```

---

## Next Steps

After Week 2 integration is complete:

1. ✅ Deploy to staging
2. ✅ Run full test suite (TESTING_GUIDE.md)
3. ✅ Get stakeholder sign-off
4. ✅ Deploy to production
5. ⏳ Start Week 3 (monitoring + dead letter queue)

**Timeline**: 24-48 hours from completion
