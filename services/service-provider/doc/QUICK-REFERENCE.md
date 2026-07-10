# BSP Provider - Quick Reference Guide
## Cheat Sheet and Command Reference

**Document Type:** Quick Reference  
**Updated:** May 2026

---

## 🚀 Getting Started (5 minutes)

### Install and Run Locally

```bash
# 1. Clone and navigate
git clone <repo> && cd bsp-service

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env

# 4. Start services
docker-compose up -d

# 5. Run in watch mode
npm run dev

# Service: http://localhost:3004
```

### Test It Works

```bash
# Health check
curl http://localhost:3004/health

# Get internal secret from .env
SECRET=$(grep INTERNAL_SERVICE_SECRET .env | cut -d= -f2)

# Create app
curl -X POST http://localhost:3004/internal/v1/bsp/apps \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_test",
    "appName": "My App",
    "provider": "gupshup"
  }'
```

---

## 📚 Documentation Quick Links

| Question | Document | Section |
|----------|----------|---------|
| What is this? | 01-Overview | Overview |
| How does it work? | 02-Architecture | Architecture |
| Database schema? | 03-Data Models | All Models |
| API endpoints? | 04-API Reference | All Endpoints |
| Add new provider? | 05-Implementation | Adding Provider |
| Deploy to prod? | 06-Operations | Deployment |

---

## 🔌 Most Used APIs

### Create App
```bash
curl -X POST http://localhost:3004/internal/v1/bsp/apps \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_123",
    "businessId": "biz_456",
    "appName": "Support Chat",
    "provider": "gupshup"
  }'
```

### Send Message
```bash
curl -X POST http://localhost:3004/internal/v1/bsp/messages/send \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "gupshup_app_xyz",
    "to": "+919876543210",
    "type": "text",
    "text": "Hello world!"
  }'
```

### Get Message Status
```bash
curl http://localhost:3004/internal/v1/bsp/messages/msg_123 \
  -H "Authorization: Bearer $SECRET"
```

### Start Onboarding
```bash
curl -X POST http://localhost:3004/internal/v1/bsp/onboarding/start \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "gupshup_app_xyz",
    "callbackUrl": "https://your-app.com/callback"
  }'
```

### Sync Templates
```bash
curl -X POST http://localhost:3004/internal/v1/bsp/templates/sync \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"appId": "gupshup_app_xyz"}'
```

---

## 📊 Key MongoDB Collections

```javascript
// List all collections
show collections

// Check app status
db.bsp_apps.findOne({ appId: "gupshup_app_xyz" })

// Find all apps in workspace
db.bsp_apps.find({ workspaceId: "ws_123" }).pretty()

// Check message delivery status
db.bsp_message_dispatch.find({ status: "failed" }).limit(5)

// Monitor token expiration
db.bsp_tokens.find({ expiresAt: { $lt: new Date() } })

// Check webhook events
db.bsp_webhook_events.find({ processed: false }).count()

// Get app health status
db.bsp_health_snapshots.findOne({ appId: "gupshup_app_xyz" }, { sort: { createdAt: -1 } })
```

---

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker logs -f bsp-service

# Execute command in container
docker exec -it bsp-service npm run test

# Rebuild image
docker-compose up -d --build

# Clean everything
docker-compose down -v
```

---

## 🧪 Testing Commands

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test:cov

# Integration tests
npm run test:integration

# Specific test file
npm run test -- apps.service.spec.ts

# Debug tests
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

## 🚢 Deployment Commands

### Docker Build
```bash
# Build image
docker build -t bsp-service:latest .

# Tag for registry
docker tag bsp-service:latest your-registry/bsp-service:v1.0.0

# Push to registry
docker push your-registry/bsp-service:v1.0.0
```

### Kubernetes
```bash
# Deploy
kubectl apply -f deployment.yaml

# Check status
kubectl get deployment bsp-service
kubectl get pods -l app=bsp-service

# View logs
kubectl logs -f deployment/bsp-service

# Scale
kubectl scale deployment bsp-service --replicas=3

# Rollout status
kubectl rollout status deployment/bsp-service

# Rollback
kubectl rollout undo deployment/bsp-service

# Check events
kubectl describe deployment bsp-service
```

---

## 🔧 Troubleshooting Commands

### Check Service Health
```bash
# HTTP health
curl http://localhost:3004/health -v

# Deep health check
curl http://localhost:3004/health/deep | jq

# Check readiness
curl http://localhost:3004/ready
```

### Database Troubleshooting
```bash
# MongoDB shell
mongosh "mongodb://localhost:27017/connectsphere_bsp"

# Test connection
npm run test:db-connection

# Check indexes
db.bsp_apps.getIndexes()

# Profile slow queries
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().sort({ millis: -1 }).limit(10)
```

### Redis Troubleshooting
```bash
# Redis CLI
redis-cli

# Check key space
INFO keyspace

# Monitor commands
MONITOR

# Check memory
INFO memory

# Clear cache
FLUSHDB
```

### Check Logs
```bash
# Tail logs
npm run dev 2>&1 | grep ERROR

# Filter by level
docker logs bsp-service | grep "ERROR\|WARN"

# Search for pattern
kubectl logs deployment/bsp-service | grep "message.*failed"
```

---

## 🔐 Environment Variables

```bash
# Required
INTERNAL_SERVICE_SECRET=secret-key
MONGODB_URI_BSP=mongodb://localhost:27017/connectsphere_bsp
REDIS_URL=redis://localhost:6379

# Optional
NODE_ENV=development
PORT=3004
LOG_LEVEL=debug

# Gupshup Provider
GUPSHUP_PARTNER_TOKEN=token
GUPSHUP_WEBHOOK_SECRET=secret
GUPSHUP_PARTNER_EMAIL=email@gupshup.io
GUPSHUP_PARTNER_PASSWORD=password

# Services
MAIN_SERVICE_URL=http://localhost:5001
CAMPAIGN_SERVICE_URL=http://localhost:3002
BILLING_SERVICE_URL=http://localhost:3003
```

---

## 📈 Monitoring & Metrics

### Health Endpoints
```
GET /health           # Basic health
GET /health/deep      # Detailed health
GET /ready            # Readiness check
GET /metrics          # Prometheus metrics
```

### Key Metrics to Monitor
```
# Request metrics
rate(http_requests_total[5m])
histogram_quantile(0.95, http_request_duration_seconds)

# Business metrics
messages_sent_total
message_delivery_rate
template_sync_success_rate

# System metrics
process_resident_memory_bytes
process_cpu_seconds_total
nodejs_heap_size_used_bytes
```

### Alert Thresholds
```
Error Rate > 1%           → Page on-call
Latency P99 > 1s          → Warning
Memory Usage > 85%        → Warning
DB Latency > 100ms        → Warning
Message Delivery < 98%    → Page on-call
Token Refresh Failure > 1% → Page on-call
```

---

## 🔄 Common Operations

### Add New Provider

```bash
# 1. Create service (in src/provider-name/)
touch src/meta/meta-client.service.ts

# 2. Register in module
# Edit src/app.module.ts

# 3. Create configuration
# Edit src/config.ts

# 4. Test the provider
npm run test -- meta-client.service.spec.ts

# 5. Deploy
npm run build
npm run start
```

### Deploy New Version

```bash
# 1. Tag release
git tag v1.1.0
git push origin v1.1.0

# 2. Build image
docker build -t bsp-service:v1.1.0 .

# 3. Push image
docker push your-registry/bsp-service:v1.1.0

# 4. Update deployment
kubectl set image deployment/bsp-service \
  bsp-service=your-registry/bsp-service:v1.1.0 --record

# 5. Monitor rollout
kubectl rollout status deployment/bsp-service

# 6. Check logs
kubectl logs -f deployment/bsp-service
```

### Rotate Secrets

```bash
# 1. Generate new secret
openssl rand -hex 32

# 2. Update secrets manager
aws secretsmanager put-secret-value \
  --secret-id bsp-service-secret \
  --secret-string '{"INTERNAL_SERVICE_SECRET":"new-secret"}'

# 3. Update Kubernetes
kubectl patch secret bsp-secrets -p \
  '{"data":{"INTERNAL_SERVICE_SECRET":"'$(echo -n 'new-secret' | base64)'"}}'

# 4. Restart deployment
kubectl rollout restart deployment/bsp-service

# 5. Verify
kubectl exec deployment/bsp-service -- env | grep SECRET
```

---

## 📊 Data Backup

```bash
# Full backup
mongodump --uri "mongodb://localhost:27017/connectsphere_bsp" \
  --out /backups/$(date +%Y-%m-%d)

# Backup specific collection
mongodump --uri "mongodb://localhost:27017/connectsphere_bsp" \
  --collection bsp_apps \
  --out /backups/apps-$(date +%Y-%m-%d)

# Restore backup
mongorestore --uri "mongodb://localhost:27017/connectsphere_bsp" \
  /backups/2026-05-20

# List backups
ls -lah /backups/
```

---

## 🐛 Debug Mode

```bash
# Debug app
node --inspect-brk ./dist/main.js

# Debug with CLI logging
DEBUG=bsp-service:* npm run dev

# Enhanced logging
LOG_LEVEL=trace npm run dev

# Monitor memory
node --max-old-space-size=4096 ./dist/main.js

# Profile CPU
node --prof ./dist/main.js
node --prof-process isolate-*.log > profile.txt
```

---

## 📋 Pre-Deployment Checklist

```
Before pushing to production:

[ ] All tests passing
    npm run test:cov

[ ] Build succeeds
    npm run build

[ ] No security vulnerabilities
    npm audit

[ ] Database migrations tested
    npm run migrate

[ ] Environment variables set
    cat .env | grep -E "INTERNAL|MONGO|REDIS"

[ ] Docker image built and tested
    docker build -t test . && docker run test npm run test

[ ] Kubernetes manifests valid
    kubectl apply --dry-run=client -f deployment.yaml

[ ] Rollback plan documented
    echo "Rollback to v$(git describe --tags --abbrev=0 --exclude='*-pre')"

[ ] Team notified
    slack -c #deployments "Deploying bsp-service v1.1.0"

[ ] Monitoring configured
    Check Prometheus/Grafana dashboards

[ ] Backup created
    mongodump --uri "..." --out /backups/pre-deploy
```

---

## 🆘 Emergency Procedures

### Service Down (P1)

```bash
# 1. Check health
curl http://localhost:3004/health

# 2. Check logs
docker logs bsp-service | tail -100

# 3. Restart service
docker restart bsp-service

# 4. If still down, rollback
kubectl rollout undo deployment/bsp-service

# 5. Verify recovery
curl http://localhost:3004/ready
```

### Database Down (P1)

```bash
# 1. Check MongoDB
mongosh --eval "db.adminCommand('ping')"

# 2. Check connection string
echo $MONGODB_URI_BSP

# 3. Restart MongoDB
docker restart mongodb

# 4. Restore from backup if corrupted
mongorestore --uri "..." /backups/latest

# 5. Verify data
db.bsp_apps.count()
```

### High Memory Usage

```bash
# 1. Check memory
docker stats bsp-service

# 2. Get heap dump
kill -USR2 <pid>

# 3. Analyze with clinic.js
clinic doctor -- npm run dev

# 4. Restart service
docker restart bsp-service

# 5. Increase resource limit
kubectl set resources deployment/bsp-service -c=bsp-service --limits=memory=4Gi
```

---

## 📞 Important Contacts

```
On-Call Engineer:     #on-call-rotation Slack
Platform Team Lead:   @platform-lead Slack
DevOps Lead:          @devops-lead Slack
Gupshup Support:      support@gupshup.io
PagerDuty:            https://your-pagerduty.com
Status Page:          https://status.your-domain.com
```

---

## 🔗 Useful Links

| Link | Purpose |
|------|---------|
| [Full Docs](README.md) | Complete documentation |
| [GitHub](link) | Source code |
| [Prometheus](http://localhost:9090) | Metrics |
| [Grafana](http://localhost:3000) | Dashboards |
| [MongoDB](http://localhost:27017) | Database |
| [Redis](http://localhost:6379) | Cache |
| [Jaeger](http://localhost:16686) | Tracing |

---

## 💡 Pro Tips

```bash
# Alias for common commands
alias bsp-dev='cd ~/devlopment/connectsphere/bsp-service && npm run dev'
alias bsp-test='cd ~/devlopment/connectsphere/bsp-service && npm run test'
alias bsp-logs='docker logs -f bsp-service'
alias bsp-db='mongosh "mongodb://localhost:27017/connectsphere_bsp"'

# Quick health check
alias bsp-health='curl -s http://localhost:3004/health/deep | jq'

# Get secret
alias bsp-secret='grep INTERNAL_SERVICE_SECRET .env | cut -d= -f2'

# Run with environment
alias bsp-prod='NODE_ENV=production npm run build && npm run start'
```

---

## 📝 Common Queries

```bash
# Find failing apps
db.bsp_apps.find({ status: "disconnected" }).count()

# Find messages stuck in pending
db.bsp_message_dispatch.find({ status: "pending", createdAt: { $lt: new Date(Date.now() - 3600000) } }).count()

# Find expired tokens
db.bsp_tokens.find({ expiresAt: { $lt: new Date() } }).count()

# Find unprocessed webhooks
db.bsp_webhook_events.find({ processed: false }).count()

# Get total messages sent today
db.bsp_message_dispatch.find({ createdAt: { $gte: new Date(new Date().toISOString().split('T')[0]) } }).count()

# Find apps with health issues
db.bsp_health_snapshots.find({ isHealthy: false }).sort({ checkedAt: -1 }).limit(10)
```

---

**Last Updated:** May 2026  
**Quick Ref Version:** 1.0.0  
**Total Commands:** 80+  
**Quick Commands:** 50+

For detailed information, see the full documentation at [README.md](README.md)

