# Test Report — 2026-06-10

## Build verification (all clean)
| Package | Result |
|---|---|
| packages/contracts | ✅ tsc |
| api-gateway | ✅ tsc (after installing missing `zod`) |
| auth, automation, billing, campaign, chat, contact, webhook-ingestor, websocket-gateway | ✅ tsc |
| service-provider | ✅ nest build |
| customer-portal | ✅ tsc --noEmit |

## Runtime (full stack via `node wapi-runner.js`, Mongo/Redis/Kafka local)
All 10 backend ports up: 5001, 3001–3004, 3006–3009, 3013. No crashes in runner output.

## Gateway smoke tests (status codes)
Unauthenticated (expect 401, NOT 404/502 — proves route exists & auth enforced):
- `/api/v1/inbox/conversations` 401 ✅ · `/api/v1/onboarding/status` 401 ✅ · `/api/v1/onboarding/bsp/status` 401 ✅ · `/api/v1/workspace/waba` 401 ✅ · `/api/v1/automation/engine/rules` 401 ✅ · `/api/v1/automation/engine/logs` 401 ✅

Authenticated (trusted internal headers, real user/workspace from dev DB) — all **200**:
contacts, inbox conversations, automation rules, automation logs (new alias), **workspace/waba**, **onboarding/status**, **onboarding/bsp/status**, templates, billing info, crm pipelines, analytics overview, **super-admin/gupshup/health**, campaigns, flows, integrations, support tickets, tags, commerce products, workspace/connection-status, workspace/profile.

## Security regression tests
- Identity headers + **wrong** secret → 401 ✅ (spoof rejected)
- Identity headers + **no** secret → 401 ✅ (headers stripped)
- Garbage Bearer token → **401** ✅ (was 502 before fix)

## End-to-end write flow
- `POST /api/v1/contacts` → 201-equivalent success with persisted doc → `GET /contacts/:id` 200 → `DELETE` 200 ✅

## Frontend runtime (customer-portal dev, port 3000)
- `/` 200 ✅ · `/auth/login` 200 ✅
- `/inbox` unauthenticated → 307 redirect to `/auth/login?callbackUrl=%2Finbox` ✅ (proxy middleware works)
- Next rewrite → gateway: `/api/v1/auth/session` → `{"authenticated":false}` 200 ✅
- admin-portal `/login` (port 3100) 200 ✅

## Not covered (requires real credentials / external providers)
- Live Gupshup onboarding & webhook delivery (needs partner creds + ngrok callback)
- Razorpay payment verification (needs live keys/webhook secret)
- OTP login E2E (needs SMTP/SMS delivery)
- Browser-level UI interaction tests (forms, modals) — typecheck + API contract verification done instead
