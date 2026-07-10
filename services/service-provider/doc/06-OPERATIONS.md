# BSP Provider Operations Manual
## Production Deployment, Monitoring, and Troubleshooting

**Document Version:** 1.0.0  
**Previous Document:** 05-IMPLEMENTATION-GUIDE.md

---

## Table of Contents

1. [Production Deployment](#production-deployment)
2. [Monitoring & Observability](#monitoring--observability)
3. [Health Checks](#health-checks)
4. [Performance Management](#performance-management)
5. [Incident Response](#incident-response)
6. [Backup & Recovery](#backup--recovery)
7. [Scaling Guidelines](#scaling-guidelines)
8. [Security Operations](#security-operations)
9. [Maintenance Windows](#maintenance-windows)
10. [Runbooks](#runbooks)

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing (unit, integration, e2e)
- [ ] Code review completed
- [ ] Security scanning passed
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment window
- [ ] Backup created
- [ ] Load testing completed

### Deployment Strategy: Blue-Green

```
Current Production (Blue)
└─ Running stable version

New Release (Green)
└─ Running new version
   
Traffic Switch
├─ Route 0% → Green (validate)
├─ Route 5% → Green (canary)
├─ Route 25% → Green (ramp)
├─ Route 100% → Green (full)
└─ Decommission Blue (after 24h)
```

### Rolling Deployment (Kubernetes)

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # Zero-downtime
  minReadySeconds: 10
  progressDeadlineSeconds: 600
```

### Canary Release

```bash
# 1. Deploy canary (5% traffic)
kubectl set image deployment/bsp-service \
  bsp-service=bsp-service:v2.0.0 \
  --record

# 2. Monitor metrics
watch "kubectl get pods -l app=bsp-service"

# 3. Increase traffic gradually
kubectl patch deployment bsp-service \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/replicas", "value":10}]'

# 4. Full rollout (if metrics healthy)
kubectl rollout undo deployment/bsp-service  # Rollback if needed
```

### Rollback Procedure

```bash
# Check rollout history
kubectl rollout history deployment/bsp-service

# Rollback to previous version
kubectl rollout undo deployment/bsp-service

# Rollback to specific revision
kubectl rollout undo deployment/bsp-service --to-revision=3

# Verify rollback
kubectl rollout status deployment/bsp-service
```

---

## Monitoring & Observability

### Key Metrics Dashboard

#### Application Metrics

```
┌─────────────────────────────────────────────────┐
│  BSP Service Metrics Dashboard                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Request Metrics                                 │
│ ├─ Requests/sec:     1,234.5                   │
│ ├─ Avg Latency:      245ms                     │
│ ├─ P99 Latency:      1,234ms                   │
│ └─ Error Rate:       0.12%                     │
│                                                 │
│ Business Metrics                                │
│ ├─ Messages Sent:    45,678/hr                 │
│ ├─ Delivery Rate:    99.87%                    │
│ ├─ Template Sync:    OK                        │
│ └─ Apps Connected:   2,345                     │
│                                                 │
│ System Metrics                                  │
│ ├─ CPU Usage:        45%                       │
│ ├─ Memory Usage:     62%                       │
│ ├─ Disk Usage:       78%                       │
│ └─ Database:         Connected                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Request latency (p50) | < 100ms | > 200ms |
| Request latency (p99) | < 500ms | > 1000ms |
| Error rate | < 0.5% | > 1% |
| Message delivery rate | > 99% | < 98% |
| Token refresh success | > 99.5% | < 98% |
| Database query latency | < 50ms | > 100ms |
| Redis latency | < 5ms | > 10ms |
| Memory usage | < 70% | > 85% |
| CPU usage | < 60% | > 80% |
| Disk usage | < 80% | > 90% |

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'bsp-service'
    static_configs:
      - targets: ['localhost:3004']
    metrics_path: '/metrics'
    scrape_interval: 5s
    
  - job_name: 'mongodb'
    static_configs:
      - targets: ['localhost:27017']
      
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']
```

### Grafana Dashboards

Essential dashboards:

1. **Overview Dashboard**
   - Request rate and latency
   - Error rate
   - Active connections
   - Database status

2. **Business Dashboard**
   - Messages sent/received
   - Delivery rates
   - Template metrics
   - App health status

3. **System Dashboard**
   - CPU, memory, disk usage
   - Network I/O
   - Process metrics
   - Go runtime stats

4. **Database Dashboard**
   - Query latency distribution
   - Slow queries
   - Connection pool status
   - Index usage

### Distributed Tracing (Jaeger)

```typescript
// Add to app.module.ts
import { JaegerTracer } from 'opentelemetry-jaeger-trace-exporter';

// Instrument HTTP requests
app.use((req, res, next) => {
  const span = tracer.startSpan(`${req.method} ${req.path}`);
  res.on('finish', () => {
    span.setTag('http.status_code', res.statusCode);
    span.finish();
  });
  next();
});
```

---

## Health Checks

### Liveness Probe

**Indicates:** Service is running and can respond

```bash
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2026-05-20T15:35:00Z"
}
```

**Kubernetes Configuration:**
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3004
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe

**Indicates:** Service is ready to accept traffic

```bash
GET /ready

Response:
{
  "ready": true,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "providers": {
      "gupshup": "ok"
    }
  }
}
```

**Kubernetes Configuration:**
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3004
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

### Deep Health Check

```bash
GET /health/deep

Response:
{
  "status": "ok",
  "checks": {
    "database": {
      "status": "ok",
      "latency": 5,
      "connections": 10
    },
    "redis": {
      "status": "ok",
      "latency": 1,
      "memory": "2Gb"
    },
    "providers": {
      "gupshup": {
        "status": "ok",
        "latency": 234,
        "lastCheck": "2026-05-20T15:35:00Z"
      }
    },
    "disk": {
      "available": "45Gb",
      "usage": "78%"
    }
  }
}
```

---

## Performance Management

### Optimization Checklist

**Database Level:**
- [ ] All queries use indexes
- [ ] Slow query log monitored
- [ ] Connection pooling optimized
- [ ] Database statistics up to date
- [ ] Archive old data regularly

**Application Level:**
- [ ] Response compression enabled
- [ ] Caching implemented
- [ ] Query optimization done
- [ ] N+1 problems fixed
- [ ] Memory leaks checked

**Infrastructure Level:**
- [ ] CDN configured for static assets
- [ ] Load balancing optimized
- [ ] Horizontal scaling tested
- [ ] Network latency acceptable
- [ ] Database replication tuned

### Load Testing

```bash
# Using Apache Bench
ab -n 10000 -c 100 http://localhost:3004/health

# Using wrk (more realistic)
wrk -t4 -c100 -d30s \
  -s script.lua \
  http://localhost:3004/internal/v1/bsp/apps

# Using k6 (scenario-based)
k6 run load-test.js
```

### Database Tuning

```bash
# Check slow queries
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().sort({ millis: -1 }).limit(5)

# Analyze query execution plan
db.bsp_apps.find({ workspaceId: 'ws_123' }).explain('executionStats')

# Rebuild indexes
db.bsp_apps.reIndex()

# Check index usage
db.bsp_apps.aggregate([{ $indexStats: {} }])
```

### Connection Pool Tuning

```typescript
// Optimal MongoDB connection pool
const mongoUrl = 'mongodb://host/db?maxPoolSize=100&minPoolSize=10&waitQueueTimeoutMS=5000';

// Optimal Redis connection pool
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});
```

---

## Incident Response

### Incident Severity Levels

| Level | Impact | Response Time | Examples |
|-------|--------|--------------|----------|
| **P1** | Critical | 5 minutes | Service down, data loss, security breach |
| **P2** | High | 15 minutes | Degraded performance, 50%+ error rate |
| **P3** | Medium | 1 hour | 10-20% error rate, slow response |
| **P4** | Low | 4 hours | Minor issues, non-critical features |

### P1 Incident Runbook

```
1. IMMEDIATE ACTION
   ├─ Page on-call engineer
   ├─ Create incident in PagerDuty
   ├─ Post to #incident-response Slack
   └─ Gather team in war room

2. DIAGNOSIS (First 5 minutes)
   ├─ Check health endpoints
   ├─ Review recent deployments
   ├─ Check monitoring dashboards
   ├─ Review error logs
   └─ Check provider status (Gupshup, etc.)

3. MITIGATION (Next 10 minutes)
   ├─ Scale up if resource constrained
   ├─ Rollback recent deployment if suspicious
   ├─ Switch to backup provider if available
   ├─ Route traffic to healthy instances
   └─ Stop problematic background jobs

4. COMMUNICATION
   ├─ Update status page
   ├─ Post customer update every 5 minutes
   ├─ Email enterprise customers
   └─ Monitor social media

5. RESOLUTION
   ├─ Implement fix
   ├─ Test in staging
   ├─ Deploy to production
   └─ Verify resolution

6. POST-INCIDENT
   ├─ Schedule blameless RCA
   ├─ Document timeline
   ├─ Identify action items
   └─ Share learnings with team
```

### Rollback Procedure

```bash
# Immediate rollback
kubectl rollout undo deployment/bsp-service

# Verify rollback complete
kubectl rollout status deployment/bsp-service

# Check service health
curl http://bsp-service/health

# Monitor error logs
kubectl logs -f deployment/bsp-service | grep ERROR

# Communicate status
# Post to #incident-response: "Rolled back to previous version"
```

### Escalation Contacts

```
Level 1: On-Call Engineer
├─ Paged automatically
└─ 30 minute SLA

Level 2: Team Lead
├─ If issue not resolved in 30 minutes
└─ 15 minute response time

Level 3: Engineering Manager
├─ For critical or customer-impacting
└─ 5 minute response time

External: Vendor Support
├─ For provider-level issues (Gupshup, etc.)
├─ Use support tickets and emergency line
└─ Provide detailed reproduction steps
```

---

## Backup & Recovery

### Backup Strategy

**Daily Backups (Retention: 7 days)**
```bash
# Automated daily backup at 2 AM UTC
mongodump --uri "mongodb://user:pass@host/db" \
  --out /backups/daily/$(date +%Y-%m-%d)
```

**Weekly Backups (Retention: 4 weeks)**
```bash
# Every Sunday
mongodump --uri "mongodb://user:pass@host/db" \
  --out /backups/weekly/week-$(date +%V)
```

**Monthly Backups (Retention: 1 year)**
```bash
# First day of month
mongodump --uri "mongodb://user:pass@host/db" \
  --out /backups/monthly/$(date +%Y-%m)
```

### Backup Verification

```bash
# Test restore from daily backup
docker run -v /backups/daily:/backup --rm -it mongo mongorestore /backup/2026-05-20

# Verify data integrity
db.bsp_apps.count()
db.bsp_messages.count()
```

### Recovery Procedures

**Scenario 1: Corrupted App Record**

```bash
# 1. Find backup with good data
ls -la /backups/daily/

# 2. Restore single collection
mongorestore --uri "mongodb://user:pass@host/db" \
  --archive=/backups/daily/2026-05-19/dump.archive \
  --nsInclude='connectsphere_bsp.bsp_apps'

# 3. Verify restoration
db.bsp_apps.findOne({ appId: 'corrupted_app' })

# 4. If good, complete recovery
# Otherwise, try older backup
```

**Scenario 2: Complete Database Loss**

```bash
# 1. Create new MongoDB instance
docker run -d --name mongodb mongo:6.0

# 2. Restore from latest backup
mongorestore --uri "mongodb://localhost" \
  --archive=/backups/daily/2026-05-20/dump.archive

# 3. Verify data
mongosh
use connectsphere_bsp
db.bsp_apps.count()

# 4. Point service to new database
kubectl set env deployment/bsp-service \
  MONGODB_URI_BSP="mongodb://new-host:27017/connectsphere_bsp"

# 5. Verify service connectivity
curl http://bsp-service/health
```

### Disaster Recovery Testing

**Monthly DR Drill:**

```bash
# 1. Restore backup to staging
mongorestore --uri "mongodb://staging-host" \
  --archive=/backups/monthly/$(date +%Y-%m)/dump.archive

# 2. Deploy service to staging
helm upgrade --install bsp-staging bsp-chart \
  --values staging-values.yaml

# 3. Run smoke tests
npm run test:smoke

# 4. Document results
# Document: "DR Drill $(date +%Y-%m-%d) - PASSED"
```

---

## Scaling Guidelines

### Horizontal Scaling (Add More Pods)

**When to scale out:**
- CPU usage > 75%
- Memory usage > 80%
- Request latency increasing
- Queue depth growing

**Scale out procedure:**
```bash
# Increase replicas
kubectl scale deployment/bsp-service --replicas=5

# Monitor scaling progress
kubectl get deployment bsp-service -w

# Verify load balancing
kubectl get pods -l app=bsp-service
```

**Load Balancing:**
```yaml
# Kubernetes Service for load balancing
apiVersion: v1
kind: Service
metadata:
  name: bsp-service
spec:
  type: LoadBalancer
  selector:
    app: bsp-service
  ports:
    - port: 80
      targetPort: 3004
  sessionAffinity: ClientIP  # For stateful connections
```

### Vertical Scaling (Increase Resources)

**When to scale up:**
- Single pod CPU/Memory near limits
- Cannot add more pods (license/cost constraints)
- Network bandwidth saturated

**Scale up procedure:**
```bash
# Update resource requests
kubectl set resources deployment/bsp-service \
  -c=bsp-service \
  --requests=cpu=500m,memory=1Gi \
  --limits=cpu=2000m,memory=4Gi

# Node must have available resources
kubectl describe nodes | grep -A 5 "Allocated resources"
```

### Database Scaling

**MongoDB Sharding:**
```bash
# Enable sharding on collection
sh.shardCollection("connectsphere_bsp.bsp_apps", { "workspaceId": 1, "appId": 1 })

# Add more shards
sh.addShard("shard1.example.com:27017")
sh.addShard("shard2.example.com:27017")

# Monitor shard status
sh.status()
```

### Auto-Scaling Policy

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: bsp-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: bsp-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
```

---

## Security Operations

### Security Checklist

- [ ] TLS/SSL enabled for all traffic
- [ ] API keys rotated regularly
- [ ] Database credentials encrypted
- [ ] Network segmentation enforced
- [ ] WAF rules configured
- [ ] DDoS protection enabled
- [ ] Security scanning automated
- [ ] Audit logs enabled
- [ ] Access controls enforced
- [ ] Secrets management implemented

### Credential Rotation

**Monthly Rotation Schedule:**

```bash
# 1. Generate new credentials
openssl rand -hex 32  # New INTERNAL_SERVICE_SECRET

# 2. Add to secrets manager
aws secretsmanager put-secret-value \
  --secret-id bsp-service-secret \
  --secret-string '{"INTERNAL_SERVICE_SECRET":"new-secret"}'

# 3. Update service deployment
kubectl patch secret bsp-secrets \
  -p '{"data":{"INTERNAL_SERVICE_SECRET":"'$(echo -n 'new-secret' | base64)'"}}'

# 4. Trigger rolling restart
kubectl rollout restart deployment/bsp-service

# 5. Verify all pods using new secret
kubectl exec deployment/bsp-service -- env | grep SECRET

# 6. Document rotation
echo "Secret rotated $(date)" >> rotation.log
```

### Network Security

```yaml
# Kubernetes Network Policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: bsp-service-netpol
spec:
  podSelector:
    matchLabels:
      app: bsp-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: main-service
    ports:
    - protocol: TCP
      port: 3004
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: mongodb
    ports:
    - protocol: TCP
      port: 27017
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
```

---

## Maintenance Windows

### Planned Maintenance Schedule

**Weekly (Tuesday 2 AM UTC):**
- Database maintenance (vacuuming, stats refresh)
- Log rotation
- Cache clearing
- Non-critical updates

**Monthly (First Sunday 3 AM UTC):**
- Database backups
- Major dependency updates
- Security patches
- Infrastructure upgrades

**Quarterly (Start of month 1 AM UTC):**
- Database optimization
- Full system testing
- Disaster recovery drill
- Performance review

### Maintenance Notification

```bash
# 1 week before
- Email customers
- Post on status page
- Update runbooks

# 1 day before
- Send reminder
- Prepare rollback plan
- Notify team

# 1 hour before
- Start war room
- Check monitoring
- Verify backup

# During window
- Execute plan
- Monitor every 5 minutes
- Update status page

# After completion
- Verify all systems
- Send completion email
- Document issues
```

---

## Runbooks

### Runbook: High Error Rate (> 5%)

```
DETECTION
├─ Alert triggered: error_rate > 5%
├─ Check dashboard: /metrics
└─ Severity: P2

DIAGNOSIS (First 5 min)
├─ Check recent deployments
│  kubectl rollout history deployment/bsp-service
├─ Review error logs
│  kubectl logs -f deployment/bsp-service | grep ERROR
├─ Check provider status
│  curl https://status.gupshup.io
├─ Check database connectivity
│  kubectl exec deployment/bsp-service -- npm run test:db
└─ Check rate limiting
   kubectl get pods bsp-service -o custom-columns=MEMORY:.status.containerStatuses[*].lastState

MITIGATION
├─ If recent deployment: Rollback
│  kubectl rollout undo deployment/bsp-service
├─ If database issue: Scale up MongoDB
│  kubectl scale statefulset mongodb --replicas=4
├─ If memory issue: Restart pods
│  kubectl rollout restart deployment/bsp-service
└─ If rate-limited: Contact provider

RESOLUTION
├─ Monitor error rate
├─ Error rate should decrease to < 1%
└─ Close incident

POST-INCIDENT
├─ Review error logs for patterns
├─ Implement alerting for early detection
└─ Schedule blameless RCA
```

### Runbook: Database Slow Queries

```
DETECTION
├─ Alert: database_latency > 100ms
├─ Check metrics: Database queries taking > 2 seconds
└─ Severity: P3

DIAGNOSIS
├─ Check slow query log
│  db.setProfilingLevel(1, { slowms: 100 })
│  db.system.profile.find().sort({ millis: -1 }).limit(10)
├─ Identify problematic query
├─ Check if missing index
└─ Check database disk space

MITIGATION
├─ If missing index: Create index
│  db.bsp_apps.createIndex({ workspaceId: 1, appId: 1 })
├─ If disk full: Archive old data
│  db.bsp_webhook_events.deleteMany({ createdAt: { $lt: ISODate('2026-02-20') } })
└─ If high load: Scale MongoDB vertically

RESOLUTION
├─ Verify latency back to < 50ms
├─ Monitor for regression
└─ Update query if needed
```

---

## Conclusion

This operations manual provides the framework for managing BSP Provider in production. Key principles:

1. **Automation First** - Automate everything possible
2. **Observability** - Instrument deeply, alert smartly
3. **Resilience** - Design for failure, practice recovery
4. **Communication** - Keep stakeholders informed
5. **Documentation** - Update runbooks after incidents

---

**For Support:**
- Slack: #bsp-provider-support
- Email: platform-team@company.com
- PagerDuty: On-call rotation
- Wiki: [internal.company.com/bsp](internal.company.com/bsp)

**Document Version:** 1.0.0  
**Last Updated:** May 2026  
**Next Review:** August 2026

