# DEPLOYMENT CHECKLIST - Interakt Parity Week 1

## 🔴 CRITICAL - MUST DO BEFORE FIRST WEBHOOK

- [ ] **Set `META_APP_SECRET` in production**
  ```bash
  export META_APP_SECRET="your_app_secret_from_meta"
  ```
  Location: Get from Meta App Dashboard > Settings > App Secret

- [ ] **Generate and set `TOKEN_MASTER_KEY`**
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  # Copy output to:
  export TOKEN_MASTER_KEY="<32-byte-hex-string>"
  ```

- [ ] **Ensure Redis is running**
  ```bash
  redis-server --port 6379
  # Or use managed Redis (AWS ElastiCache, etc.)
  export REDIS_URL="redis://your-redis-host:6379"
  ```

- [ ] **Enable webhook worker**
  ```bash
  export START_WEBHOOK_WORKER=true
  ```

- [ ] **Set webhook verification token** (same one Meta expects)
  ```bash
  export META_VERIFY_TOKEN="your_verify_token"
  ```

---

## 🔧 DEPLOYMENT STEPS (Local → Staging → Production)

### Step 1: Install New Dependencies
```bash
npm install bullmq rate-limiter-flexible
npm install @aws-sdk/client-secrets-manager  # Optional for AWS
npm install --save-dev cross-env
```

### Step 2: Update .env Files

**Local (.env.local):**
```
# Token Security
USE_AWS_SECRETS=false
TOKEN_MASTER_KEY=<your-32-byte-hex>

# Webhook Queue
START_WEBHOOK_WORKER=true
REDIS_URL=redis://localhost:6379

# Meta Config
META_APP_SECRET=<from-meta-dashboard>
META_VERIFY_TOKEN=<your-choice>
```

**Staging (.env.staging):**
```
# Token Security
USE_AWS_SECRETS=true
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
TOKEN_MASTER_KEY=<32-byte-hex>

# Webhook Queue
START_WEBHOOK_WORKER=true
REDIS_URL=<staging-redis-url>

# Meta Config
META_APP_SECRET=<staging-secret>
META_VERIFY_TOKEN=<staging-token>
```

**Production (.env.production):**
```
# Token Security
USE_AWS_SECRETS=true
AWS_REGION=ap-south-1
TOKEN_MASTER_KEY=<rotate-this-monthly>

# Webhook Queue
START_WEBHOOK_WORKER=true
REDIS_URL=<prod-redis-url>

# Meta Config
META_APP_SECRET=<prod-secret>
META_VERIFY_TOKEN=<prod-token>

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=<your-sentry-dsn>
```

### Step 3: Test Before Deploying

#### 3a. Test Token Storage
```bash
curl -X POST http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
# Should work with new token storage
```

#### 3b. Test Opt-Out Detection
```bash
# Send webhook with STOP message
curl -X POST http://localhost:5000/api/v1/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{
    "object":"whatsapp_business_account",
    "entry":[{
      "changes":[{
        "value":{
          "messages":[{
            "from":"919876543210",
            "text":{"body":"STOP"}
          }]
        }
      }]
    }]
  }'
# Check: Contact should be flagged as optedOut
```

#### 3c. Test Rate Limiting
```bash
# Rapid-fire requests
for i in {1..110}; do
  curl http://localhost:5000/api/v1/messages/send -X POST \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"contactId":"xxx","body":"test"}' &
done
# After ~100 requests, should get 429 with X-RateLimit headers
```

#### 3d. Test Webhook Queue
```bash
# Monitor queue in Redis
redis-cli
> LLEN "bull:webhooks:*"  # Should see jobs being processed
> HGETALL "bull:webhooks:*"  # See job details
```

### Step 4: Monitor After Deploy

#### Check Logs
```bash
# Webhook queue initialization
grep "Webhook queue" logs/*
grep "Webhook worker" logs/*

# Token storage
grep "Tokens securely stored" logs/*
grep "Stored systemUserToken" logs/*

# Opt-out detection
grep "OptOut" logs/*

# Rate limiting
grep "WorkspaceRateLimit" logs/*
```

#### Key Metrics to Watch
```
- [WebhookQueue] Jobs active/completed/failed
- [OptOut] Contact opted out count
- [SecureTokens] Token retrieval latency
- [RBAC] Permission check failures
```

---

## ✅ VERIFICATION CHECKLIST

After deployment, verify:

- [ ] **ESB flow succeeds**
  - Start ESB: `/api/v1/onboarding/esb/start`
  - Complete callback
  - Check: `workspace.esbFlow.webhooksSubscribed === true`
  - Check: `workspace.esbFlow.phoneRegistered === true`

- [ ] **Webhooks arrive & process**
  - Inbox shows incoming messages
  - Check queue: `LLEN bull:webhooks:*` decreases over time
  - Monitor: No `[WebhookQueue] ❌ Job failed` messages

- [ ] **Opt-out works**
  - Send "STOP" to number
  - Contact should have `optOut.status = true`
  - Next message attempt should fail with 403

- [ ] **Rate limiting works**
  - Rapid requests → 429 after limit
  - Different workspace → different counter
  - Headers `X-RateLimit-*` present

- [ ] **Token storage secure**
  - No plain tokens in logs
  - AWS Secrets Manager shows secrets (if using)
  - Tokens decrypt correctly on retrieval

- [ ] **Audit logs created**
  - Send message → audit log entry created
  - Create contact → audit log entry created
  - Query: `AuditLog.countDocuments({workspace: id})`

---

## 🆘 TROUBLESHOOTING

### Webhooks Not Arriving
```bash
# 1. Check subscribed_apps call succeeded
db.workspaces.findOne({_id: xxx}).esbFlow.webhooksSubscribed
# Should be: true, webhooksSubscribedAt: <date>

# 2. Check webhook URL in Meta dashboard
# Should be: https://yourapi.com/api/v1/webhook

# 3. Verify META_VERIFY_TOKEN set
echo $META_VERIFY_TOKEN  # Should output something
# If empty: export in .env or deployment config

# 4. Check queue is processing
redis-cli LLEN bull:webhooks:* # Should decrease

# 5. Retry subscription
curl -X POST http://localhost:5000/api/v1/onboarding/esb/retry-subscription \
  -H "Authorization: Bearer <token>"
```

### Rate Limit Too Strict
```javascript
// In workspaceRateLimit.js, adjust:
const LIMITS_BY_PLAN = {
  free: { points: 100, duration: 60 }, // Increase "points" value
};
```

### Token Storage Failing
```bash
# Check AWS credentials
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_REGION=ap-south-1

# Or fall back to local:
export USE_AWS_SECRETS=false
export TOKEN_MASTER_KEY=<32-byte-hex>

# Test:
curl -X POST /api/v1/auth/me -H "Authorization: Bearer <token>"
# Should work
```

### Opt-Out Not Detecting
```bash
# 1. Check message text is lowercase-normalized
grep "\[OptOut\]" logs/* | head -5

# 2. Verify keyword list
grep "STOP_KEYWORDS\|START_KEYWORDS" src/services/optOutService.js

# 3. Manual test:
db.contacts.findOne({phone:"919876543210"}).optOut.status
# Should be true after STOP message
```

---

## 📞 SUPPORT

If deployment fails:

1. **Check logs first**: `tail -f logs/app.log`
2. **Verify env vars**: All required vars set?
3. **Redis running**: `redis-cli ping` → PONG?
4. **MongoDB connected**: Check connection string
5. **Meta credentials valid**: Test with curl

Critical logs to share:
```bash
grep -E "ERROR|FATAL|Failed|Exception" logs/app.log | tail -20
```

---

**Deployment Status: READY**
**Last Updated: 2026-01-16**
**Version: Week 1 Fixes**
