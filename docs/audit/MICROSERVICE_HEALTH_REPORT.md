# Microservice Health & Communication Report — 2026-06-10 (updated 2026-06-11)

## 2026-06-11 deep inter-comm runtime verification — ALL PASS after 3 fixes

Live tests against the running stack (internal secret + service-name headers):
| Path | Result |
|---|---|
| campaign → chat `POST /api/internal/worker-bridge` (socket-broadcast → Kafka → ws) | ✅ `{"success":true}` |
| campaign → billing `GET /api/billing/wallets/:ws/pricing` (internalAuth) | ✅ 200 |
| campaign → contact `POST /internal/v1/contacts/query` | ✅ 200 |
| any → service-provider `GET /internal/v1/bsp/admin/health` | ✅ 200 |
| chat → automation `POST /api/automation/engine/trigger-event` | ✅ `{"success":true,"rulesCount":0}` |
| **Inbound webhook pipeline E2E**: gateway `/api/webhooks/gupshup` → ingestor → Kafka `raw-webhook-events` → service-provider consumer | ✅ "Webhook processed successfully inside BSP service" (signed AND unsigned-in-dev) |
| socket.io handshake through gateway `/socket.io` | ✅ sid issued |
| billing reserve/settle routes (`internalAuth`, timing-safe) | ✅ middleware verified |
| BullMQ: automation scheduler/run + answerbot-crawl + campaign-engine queues ↔ workers | ✅ names match, workers started on boot |
| Kafka topics produced vs consumed (raw-webhook → parsed-message → chat-realtime + contact/billing/campaign/automation/audit events) | ✅ coherent; ws-gateway subscribes to all 5 fan-out topics |

### Fixes applied 2026-06-11
1. **webhook-ingestor rejected all unsigned provider webhooks in dev** (`WEBHOOK_SECRET` set ⇒ HMAC required, but Gupshup doesn't sign unless configured) — entire inbound message pipeline 401'd. Now: validate-when-signature-present, allow-when-absent in non-production; production stays strict.
2. **chat-service checkout-bot hardcoded `http://localhost:3003`** for billing calls (pay-link + manual orders) — now uses `BILLING_SERVICE_URL` (added to chat `.env`).
3. **`wapi-runner.js` spawned nonexistent `apps/frontend`** → infinite restart loop every 3s. Renamed to `apps/customer-portal`.

### Notes
- Gateway `/api/internal/{chat,billing,contacts,provider}` bridge mounts have **zero callers** (all services call each other directly) — legacy, candidates for removal.
- Mongo split is intentional: billing/campaign/automation/BSP own DBs; auth+chat+contact+ws-gateway+ingestor share `wapi` (ws membership checks therefore consistent with auth).
- Ops gotcha: services run under `tsx`/`nest --watch`; killing a child process does NOT trigger the runner's auto-restart (the watcher parent survives) — restart via the runner console or touch a source file.

## Live status (full stack under wapi-runner)
| Service | Port | Health | Notes |
|---|---|---|---|
| api-gateway | 5001 | ✅ 200 | restarted twice during audit to load fixes |
| automation-service | 3001 | ✅ | gateway env pointed at 3005 (FIXED) |
| campaign-service | 3002 | ✅ | |
| billing-service | 3003 | ✅ | timing-safe secret compare (best practice in repo) |
| service-provider | 3004 | ✅ | NestJS; all /bsp/v1 + internal routes reachable post-fix |
| auth-service | 3006 | ✅ | verify-session powering gateway auth |
| contact-service | 3007 | ✅ | E2E contact create/delete verified |
| chat-service | 3008 | ✅ | |
| websocket-gateway | 3009 | ✅ | socket.io behind gateway ws proxy |
| webhook-ingestor | 3013 | ✅ | Fastify |

## Service→service matrix (paths verified against target controllers)
- chat → service-provider: `/internal/v1/bsp/messages/send` ✓ (BSP_SERVICE_URL, default :3004)
- auth → service-provider: `/internal/v1/bsp/onboarding/sync-state`, `/internal/v1/bsp/apps/:id` ✓
- automation → service-provider: `/internal/v1/bsp/provider/actions` ✓
- campaign → service-provider: `/internal/v1/bsp/templates/:id` ✓ ; campaign → billing via BILLING_SERVICE_URL ✓
- automation/campaign → gateway (MONOLITH_*_URL :5001): `/api/internal/*` bridge routes ✓
- gateway → all services: env URLs verified against actual ports (one bug fixed)

## Eventing
- Kafka: producers in auth/billing/campaign/contact/automation/service-provider; consumers in websocket-gateway + webhook-ingestor + service-provider. Broker env naming varies (`KAFKA_BROKER` vs `KAFKA_BROKERS`) but every reader falls back to `localhost:9092` and all .envs agree — consistent in dev. Recommend standardizing on `KAFKA_BROKERS` later.
- BullMQ: REDIS_URL consistent (`redis://localhost:6379`) across automation/billing/campaign/service-provider.

## Env consistency
- `INTERNAL_SERVICE_SECRET` identical across all 10 services + gateway ✓ ; admin-portal was placeholder (FIXED).
- `JWT_SECRET` identical across services ✓ (dev default; production guards exist in ws-gateway/billing).
- websocket-gateway intentionally has no INTERNAL_SERVICE_SECRET (JWT-handshake only).
- Gupshup/Razorpay/Google secrets are committed in .env files — rotate & externalize before production.
