# Microservice Health & Communication Report — 2026-06-10

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
