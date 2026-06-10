# wApi — Infrastructure Analysis

> Based strictly on what exists in the repo: process orchestration, `.env(.example)` files, and the infrastructure clients each service instantiates. Where an infrastructure capability is **absent**, that is stated as a finding, not assumed to exist elsewhere.

---

## 1. Current Infrastructure Reality

| Capability | Status in repo | Evidence |
|---|---|---|
| Containerization (Docker) | ❌ **None** | no `Dockerfile`/`docker-compose*` anywhere (find sweep) |
| Orchestration (Kubernetes/Helm/Nomad) | ❌ **None** | no manifests/charts |
| CI/CD | ❌ **None** | no `.github/workflows`, no other CI config |
| Cloud IaC (Azure/Terraform/Pulumi) | ❌ **None** | no IaC files; no Azure config |
| Process management | ⚠️ Dev-only | `wapi-runner.js` spawns 12 Node processes locally |
| Service discovery | ⚠️ Static | hardcoded `localhost:PORT` env defaults (`api-gateway/src/index.ts:133-143`) |
| MongoDB | ✅ Client only | Mongoose 8 / native driver; URIs via env; no provisioning |
| Redis | ✅ Client only | ioredis; BullMQ; socket.io redis-adapter |
| Kafka | ✅ Client only (optional in dev) | kafkajs; fails soft when absent |
| Secret management | ⚠️ `.env` files | git-ignored `.env`; hardcoded dev fallbacks |
| TLS / ingress | ❌ **None** | services bind `0.0.0.0:PORT` HTTP; no proxy/cert config |
| Monitoring / metrics | ❌ **None** | no Prometheus/OTel/healthcheck aggregation beyond `/health` |
| Centralized logging | ⚠️ Optional | winston + **optional** `@logtail`; otherwise stdout via runner |
| Tracing | ❌ **None** | correlation-id header only (`api-gateway/src/index.ts:42`) |

**Bottom line:** the repository contains application code and a dev launcher. **All runtime infrastructure is undefined.** This is the dominant gap between current state and "enterprise SaaS."

---

## 2. Process Orchestration (`wapi-runner.js`)

The only orchestrator. It:
- Defines 12 processes with name/dir/cmd/color (`wapi-runner.js:6-18`).
- `spawn`s each in a **detached process group** (`detached:true`, `wapi-runner.js:51-56`) so the whole tree can be killed via `process.kill(-pid)` (`:129`) — required for clean port release on Ctrl-C.
- Demotes known-benign stderr lines (`warning`, `deprecation`, kafkajs warn, cloudinary missing, reserved schema pathname) to `[WARN]` (`:86-91`).
- **Auto-restarts crashed children after 3s** (`:102-112`) — a crude supervisor with no backoff cap or crash-loop detection.
- Interactive console: `status/restart/stop/start/log/logs/clear/exit` (`:182-316`).

This is appropriate for a single 8 GB dev box (the documented target — `CLAUDE.md` "Memory constraints") but is **not** a production runtime: no health-gated restarts, no rolling deploys, no resource isolation, single host.

---

## 3. MongoDB

- **Driver:** Mongoose 8 in all services except webhook-ingestor (native `mongodb`, `index.ts:5,29`).
- **Connection:** each service opens its own pool; `bufferCommands` disabled in some (`websocket-gateway/src/index.ts:29`); admin-portal opens up to **4** pooled connections (core via `mongoose.connect`, others via `createConnection`, `maxPoolSize:5`, `db.ts:48-91`).
- **DB names diverge by service default** (`wapi`, `wapi_billing`, `wa_campaigns`, `wapi_automation`, `wapi_bsp`) — see database-analysis §1.
- **No replica-set / sharding / backup config** in repo. No transactions used (saga pattern instead).
- **Provisioning, HA, PITR backups, encryption-at-rest: undefined.**

**Recommendation:** managed MongoDB (Atlas or self-managed replica set) with: dedicated DB per bounded context, `workspace`-hashed sharding for `messages`/`conversations` at scale, automated PITR backups, TLS + encryption-at-rest, and per-service least-privilege DB users.

---

## 4. Redis

Three distinct uses, all on the same Redis by default (`REDIS_URL || redis://localhost:6379`):
1. **Session cache** in auth-service (`session:{token}`, 60s TTL — `authController.ts:825-899`, `auth-service/src/utils/redis.ts`).
2. **BullMQ queues**: `campaign-engine` and the billing saga queue (`campaign-service/src/lib/redis.ts` `getSharedRedis`, `CampaignWorker.ts:23`; automation answerbot crawl queue).
3. **socket.io fan-out** via `@socket.io/redis-adapter` (`websocket-gateway/src/index.ts:360-373`).

`maxRetriesPerRequest:null` is set for the pub/sub clients (required by BullMQ/adapter — `websocket/index.ts:362`).

**Findings:** one Redis instance serves cache + queues + pub/sub — fine for dev, but in production these have different durability/latency needs. **Recommendation:** separate Redis for BullMQ (durable, AOF) from cache (ephemeral), and use Redis Cluster or managed Redis with failover. No Redis auth/TLS configured in defaults.

---

## 5. Kafka

- **Client:** kafkajs everywhere; broker `KAFKA_BROKER`/`KAFKA_BROKERS` default `localhost:9092`.
- **Topology:** 8 topics + per-topic DLQs (see message-flow §1). Consumer groups: `wapi-bsp-webhook-group`, `wapi-chat-service-group`, `wapi-websocket-gateway-group`, billing/campaign/audit groups.
- **Critical behavior:** **non-production fails soft** — on connect error services set `simulatedMode=true` and continue without the bus (`webhook-ingestor:48-54`, `chat/kafkaService.ts:77-83`, `websocket/index.ts:349-351`, `provider-kafka-consumer.service.ts:91-97`). In production they `throw`.
- **No schema registry, no partitioning strategy documented, no topic provisioning/IaC, no `fromBeginning` replay strategy** (`fromBeginning:false` everywhere).

**Recommendation:** managed Kafka (MSK/Confluent/Redpanda) with: explicit topic/partition provisioning (partition by `workspaceId`), schema registry (Avro/JSON-schema) validated on consume, DLQ drain+alert consumer, and consumer-group lag monitoring.

---

## 6. Secret Management

**Current:** plain `.env` files (git-ignored per `.gitignore`), loaded by `dotenv`. Inventory of secret-bearing env vars (from `.env.example`):

- `JWT_SECRET` (auth, websocket, automation, billing, campaign, service-provider, admin-portal) — **must be identical across all** for cross-service JWT verify.
- `INTERNAL_SERVICE_SECRET` (gateway, automation, billing, campaign, service-provider, ingestor) — shared internal-trust secret.
- `WEBHOOK_SECRET` / `GUPSHUP_WEBHOOK_SECRET` (ingestor, service-provider) — HMAC verify.
- `GUPSHUP_PARTNER_*` (email/password/client-secret/token), `GUPSHUP_API_BASE_URL` (service-provider).
- `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` (billing).
- `GOOGLE_CLIENT_ID/SECRET` (auth).
- `SMTP_*` (auth), `TWILIO` creds (auth deps).
- `INTEGRATION_ENCRYPTION_KEY` (service-provider secret-box; falls back to `internalServiceSecret` then `'change-me-in-production'`).
- `MONGODB_URI*`, `REDIS_URL`, `KAFKA_BROKER`.

**Encryption at rest for provider credentials** is implemented (AES-256-GCM, scrypt-derived key) in `service-provider/src/common/secret-box.ts` — good. But the **KEK falls back to `'change-me-in-production'`** if env unset (`secret-box.ts:8`).

**Critical findings:**
- **Hardcoded dev fallbacks reach production-capable code**: `INTERNAL_SERVICE_SECRET` → `'dev-internal-service-secret-change-me'`; `JWT_SECRET` → `'your-jwt-secret'`/`'your-default-secret'`; encryption KEK → `'change-me-in-production'`. If any env is unset in prod, trust collapses. (See security-review.)
- No secret rotation, no vault, no per-environment scoping, no secret in CI (there is no CI).

**Recommendation:** a secrets manager (Azure Key Vault / AWS Secrets Manager / HashiCorp Vault) injected at deploy; **remove all hardcoded fallbacks** and fail-fast on missing secrets in production (the ingestor already does this for its own vars — `webhook-ingestor/src/index.ts:262-272` — generalize that pattern).

---

## 7. Networking, TLS, Ingress

- All services bind `0.0.0.0:<port>` over **plain HTTP** (e.g. `api-gateway/src/index.ts:460`).
- CORS: gateway uses an allow-list from `ALLOWED_ORIGINS` (`index.ts:20-35`) — good; but auth-service uses `origin:true` (reflect-any) (`auth-service/src/index.ts:14`) and websocket-gateway uses `origin:'*'` with credentials (`websocket/index.ts:18-20`) — see security-review.
- Helmet is applied on the gateway (`index.ts:28`) and some services, not uniformly.
- **No reverse proxy, no TLS termination, no WAF, no API rate limiting at the edge beyond the in-process limiter** (`rateLimit.ts`, per-instance).

**Recommendation:** terminate TLS at a managed ingress/load balancer (Azure App Gateway / ALB / nginx-ingress), put a WAF in front, move rate limiting to the edge (or a shared Redis-backed limiter), and keep internal traffic on a private network/mesh with mTLS.

---

## 8. Observability

- **Logging:** `morgan` (HTTP) + `console.log` + `winston` (some services). `@logtail/winston` is an **optional** peer in contracts — not guaranteed wired. The runner colorizes/prefixes stdout (`wapi-runner.js`).
- **Correlation:** gateway generates/propagates `x-correlation-id` (`index.ts:42-44`) and downstream calls forward it in places (`internal/v1/auth/verify-session` sends it — `index.ts:80`). But there is **no trace propagation** through Kafka or BullMQ.
- **Health:** each service exposes `GET /health` (e.g. `api-gateway/src/index.ts:442`, `webhook-ingestor:251`); ingestor reports Kafka connectivity. No aggregated health/readiness, no `/metrics`.
- **No metrics, no tracing, no dashboards, no alerting, no SLO definitions.**

**Recommendation:** OpenTelemetry SDK in every service (traces+metrics+logs), context propagation across HTTP/Kafka/BullMQ, a collector → Prometheus/Grafana + Tempo/Jaeger + Loki (or a SaaS like Datadog/Grafana Cloud), structured JSON logs with `correlationId`+`workspaceId`, RED/USE dashboards, and consumer-lag + DLQ-depth alerts.

---

## 9. Environment Variable Catalog (per service)

| Service | Notable env vars |
|---|---|
| api-gateway | `PORT`, `ALLOWED_ORIGINS`, `*_SERVICE_URL` (auth/contact/chat/bsp/automation/billing/campaign/websocket/ingestor), `INTERNAL_SERVICE_SECRET` |
| auth-service | `MONGO_URI`, `JWT_SECRET`, `SMTP_*`, `SIGNUP_OTP_TTL_MINUTES`, `GOOGLE_CLIENT_ID/SECRET`, `REDIS_URL` |
| automation-service | `MONGO_URI`, `REDIS_URL`, `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, `MONOLITH_INTERNAL_URL`, `BSP_SERVICE_URL` |
| billing-service | `MONGO_URI`, `REDIS_URL`, `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, `RAZORPAY_*`, `BSP_SERVICE_URL` |
| campaign-service | `MONGO_URI`, `REDIS_URL`, `KAFKA_BROKERS`, `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, `BILLING_SERVICE_URL`, `BSP_SERVICE_URL`, `MONOLITH_URL` |
| chat-service | `MONGO_URI`, `KAFKA_BROKER` (note: also needs CONTACT/AUTOMATION/BSP URLs + INTERNAL secret used in code but absent from `.env.example` — gap) |
| contact-service | `MONGO_URI` (minimal; KAFKA used in code) |
| service-provider | `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, `MONGO_URI`, `REDIS_URL`, `KAFKA_BROKER`, `GUPSHUP_PARTNER_*`, `GUPSHUP_*_BASE_URL`, `GUPSHUP_WEBHOOK_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `MAIN/CAMPAIGN/BILLING_SERVICE_URL` |
| webhook-ingestor | `WEBHOOK_SECRET`, `INTERNAL_SERVICE_SECRET`, `MONGO_URI`, `KAFKA_BROKER`, `VERIFY_TOKEN` |
| websocket-gateway | `MONGO_URI`, `JWT_SECRET`, `KAFKA_BROKER` (REDIS_URL used in code) |
| admin-portal | `JWT_SECRET`, `ADMIN_COOKIE_NAME`, `ADMIN_SESSION_TTL`, `MONGODB_URI(_BILLING/_CAMPAIGN/_AUTOMATION)`, `GATEWAY_URL`, `INTERNAL_SERVICE_SECRET`, `*_SERVICE_URL`, `IMPERSONATION_COOKIE_DOMAIN`, `BUSINESS_VERIFICATION_PROVIDER` |
| frontend | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `BACKEND_API_URL`, `ALLOWED_DEV_ORIGINS` |

> **Config drift gap:** several services use env vars in code that are missing from their `.env.example` (e.g. chat-service uses `CONTACT_SERVICE_URL`, `AUTOMATION_SERVICE_URL`, `BSP_SERVICE_URL`, `INTERNAL_SERVICE_SECRET` in `kafkaService.ts`/`chatController.ts` but its `.env.example` lists only `PORT/NODE_ENV/MONGO_URI/KAFKA_BROKER`). This will cause "works on my machine" failures.

---

## 10. Target Infrastructure (preview — see future-state.md / roadmap.md)

1. **Containerize** every service (multi-stage Node images, distroless runtime, the existing `NODE_OPTIONS` heap caps become container memory limits).
2. **Kubernetes** (AKS, given Azure mention) with: Deployments + HPA per service, the gateway behind App Gateway/Ingress + WAF + TLS, a service mesh (Linkerd/Istio) for mTLS + retries + traffic shaping.
3. **Managed data plane:** MongoDB Atlas (or CosmosDB Mongo API), managed Redis, managed Kafka — all private-networked, TLS, encrypted-at-rest, automated backups.
4. **GitOps CI/CD:** GitHub Actions → build/test/scan → push images → ArgoCD/Flux deploy per environment; per-service independent pipelines (the monorepo already isolates deps).
5. **Secrets:** Azure Key Vault + CSI driver; zero hardcoded fallbacks; fail-fast validation at boot.
6. **Observability:** OpenTelemetry → Grafana stack (or Datadog); SLOs, consumer-lag & DLQ alerts, synthetic webhook canaries.
7. **Multi-region** (later): active-passive Mongo/Kafka replication, geo-DNS, regionalized webhook ingestion.
