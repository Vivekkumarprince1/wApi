# QUICK REFERENCE - Week 1 Fixes

## 📋 What Changed (One-Pager)

| Layer | File | Purpose | Status |
|-------|------|---------|--------|
| **Security** | `secretsManager.js` | Token encryption vault | ✅ New |
| **Compliance** | `optOutService.js` | STOP keyword auto-detection | ✅ New |
| **Performance** | `webhookQueue.js` | Async webhook processing | ✅ New |
| **Authorization** | `Permission.js` + `rbac.js` | Role-based access control | ✅ New |
| **Audit** | `AuditLog.js` + `auditService.js` | Compliance logging | ✅ New |
| **Scaling** | `workspaceRateLimit.js` | Per-workspace rate limiting | ✅ New |
| **Integration** | `metaAutomationService.js` | subscribeAppToWABA() + registerPhoneForMessaging() | ✅ Updated |
| **Onboarding** | `onboardingController.js` | Uses secretsManager + calls new Meta endpoints | ✅ Updated |
| **Webhooks** | `metaWebhookController.js` | Enqueues async + detects opt-outs | ✅ Updated |
| **Data** | `Contact.js` | Added optOut schema | ✅ Updated |

---

## 🚀 Deploy in 5 Steps

```bash
# 1. Generate token key
TOKEN_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 2. Set required env vars
export TOKEN_MASTER_KEY=$TOKEN_MASTER_KEY
export META_APP_SECRET="from-meta-dashboard"
export META_VERIFY_TOKEN="your-choice"
export REDIS_URL="redis://localhost:6379"
export START_WEBHOOK_WORKER=true

# 3. Install dependencies
npm install bullmq rate-limiter-flexible

# 4. Restart server
npm restart  # or docker restart if containerized

# 5. Verify
curl http://localhost:5000/api/v1/health
# Should return 200 + queue status
```

---

## ✅ Verify It Works

```bash
# 1. Check queue is running
redis-cli LLEN bull:webhooks:*

# 2. Send test message
curl -X POST http://localhost:5000/api/v1/messages/send \
  -H "Authorization: Bearer <token>" \
  -d '{"contactId":"xxx","body":"test"}'

# 3. Check logs
grep "Message sent\|Webhook enqueued" logs/app.log

# 4. Monitor rate limit headers
curl -v http://localhost:5000/api/v1/messages/send 2>&1 | grep X-RateLimit
# Should see: X-RateLimit-Remaining, X-RateLimit-Reset
```

---

## 🔴 Critical URLs/Functions

| What | Where | Impact |
|------|-------|--------|
| Token storage | `secretsManager.storeToken(ws, type, token)` | ESB flow breaks if missing |
| Opt-out check | `optOutService.isOptedOut(contact)` | Messages to opted-out contacts fail |
| Rate limiting | `workspaceRateLimiter` middleware | Rapid requests get 429 |
| Webhook queue | `webhookQueue.enqueueWebhook(body, sig)` | Webhooks timeout if not queued |

---

## 🆘 If It's Broken

### Webhooks not arriving?
```javascript
// Check: subscribed_apps was called during ESB
workspace.esbFlow.webhooksSubscribed === true  // Should be true

// If false, call:
POST /api/v1/onboarding/esb/retry-subscription
```

### Opt-out not working?
```javascript
// Check keyword detection
grep "OptOut" logs/app.log

// If empty, check:
process.env.START_WEBHOOK_WORKER === 'true'  // Must be true
redis-cli ping  // Must return PONG
```

### Rate limit too strict?
```javascript
// In workspaceRateLimit.js:
const LIMITS_BY_PLAN = {
  free: { points: 100, duration: 60 },  // Adjust points value
};
```

### Tokens not storing?
```bash
# Check if key exists
echo $TOKEN_MASTER_KEY  # Should output 64-char hex

# If not set:
export TOKEN_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

---

## 📊 Metrics to Watch

```bash
# Webhook queue depth (should stay < 100)
redis-cli LLEN bull:webhooks:*

# Webhook success rate (should be > 99%)
grep "Webhook processed" logs/app.log | wc -l
grep "Webhook failed" logs/app.log | wc -l

# Rate limit hits (normal: 0-10 per day)
grep "429 Too Many Requests" logs/app.log | wc -l

# Opt-outs detected (normal: varies by volume)
grep "OptOut detected" logs/app.log | wc -l

# Token operations (should be < 100ms each)
grep "Token retrieval" logs/app.log | tail -5
```

---

## 🔐 Security Checklist

- [ ] TOKEN_MASTER_KEY set (don't commit to git)
- [ ] META_APP_SECRET set (from Meta Dashboard)
- [ ] META_VERIFY_TOKEN set (for webhook validation)
- [ ] No plain tokens in logs
- [ ] AWS credentials configured (if using AWS Secrets)
- [ ] Redis password set (if production Redis)
- [ ] HTTPS enabled for webhook URL

---

## Files Changed (For Code Review)

**New files** (review for security):
- `server/src/services/secretsManager.js` - Token encryption
- `server/src/services/webhookQueue.js` - Queue logic
- `server/src/services/optOutService.js` - Compliance logic
- `server/src/middlewares/rbac.js` - Authorization
- `server/src/middlewares/workspaceRateLimit.js` - Rate limiting

**Updated files** (review for regressions):
- `server/src/controllers/onboardingController.js` - ESB changes
- `server/src/controllers/metaWebhookController.js` - Queue + opt-out
- `server/src/services/metaAutomationService.js` - New Meta calls
- `server/src/models/Contact.js` - New optOut field

---

**Status**: ✅ Code Complete  
**Next**: Deploy to staging + QA verification
