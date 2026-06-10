# Route Mismatch Report — 2026-06-10

Every mismatch found by tracing Frontend → Next rewrites → API Gateway → Service mounts.
**All items below are FIXED** (see FIXES_APPLIED.md) unless marked otherwise.

## Critical (entire feature areas 404/502)

| # | Path (client) | Gateway rewrote to | Service actually serves | Impact | Status |
|---|---|---|---|---|---|
| 1 | `/api/v1/workspace/{waba,profile,webhooks,whatsapp/health,phone-numbers,connection-status}` | `/provider/v1/workspace/*` | `/bsp/v1/workspace/*` (service-provider) | All WABA settings pages 404 | FIXED |
| 2 | `/api/v1/onboarding/*` (status, complete) | `/provider/v1/onboarding/*` | `/bsp/v1/onboarding/*` | Onboarding status/complete 404 | FIXED |
| 3 | `/api/v1/onboarding/bsp/*` (start, sync, register-phone, disconnect, runtime-profile) | `/provider/v1/onboarding/bsp/*` | `/bsp/v1/onboarding/*` | Entire BSP/Gupshup onboarding flow 404 | FIXED (dedicated mount) |
| 4 | `/api/v1/onboarding/provider/*` (legacy) | `/provider/v1/onboarding/*` | `/bsp/v1/onboarding/*` | Legacy onboarding 404 | FIXED |
| 5 | `/api/internal/provider/*` | `/internal/v1/provider/*` | `/internal/v1/bsp/*` | Internal bridge dead | FIXED |
| 6 | gateway `.env`: `AUTOMATION_SERVICE_URL=:3005` | — | automation-service listens on **:3001** | Every automation route → 502 | FIXED (env) |
| 7 | admin-portal writes via gateway (`x-internal-service-secret` + identity headers) | gateway **stripped** these headers from all inbound requests | — | Every admin-portal write unauthenticated → 401 | FIXED (trusted internal pass-through w/ timing-safe secret check) |
| 8 | `/api/v1/super-admin/gupshup/*` (admin-portal) | auth-service `/super-admin/*` (route does not exist) | service-provider `/internal/v1/bsp/admin/*` | Gupshup admin ops 404 | FIXED (sub-routing, incl. `sync-all-webhooks`→`sync-webhooks` alias) |
| 9 | `/api/v1/super-admin/plans/*`, `/api/v1/super-admin/billing/*` | auth-service (no routes) | billing-service `/api/billing/wallets/admin/*` | Plan seeding/admin billing 404 | FIXED |

## High (single endpoints broken)

| # | Frontend call | Backend reality | Status |
|---|---|---|---|
| 10 | `GET /automation/engine/logs` | service only had `/executions` | FIXED (alias route added) |
| 11 | `POST /automation/engine/rules/:id/execute` | no route/controller | FIXED (`executeRuleNow` added) |
| 12 | `PATCH /automation/engine/instagram-quickflows/:id/toggle` | no toggle route | FIXED (`toggleQuickflow` added) |
| 13 | `GET /integrations/google/spreadsheets/:id/sheets` | service had `/google/sheets` | FIXED (alias) |
| 14 | `GET /integrations/google/spreadsheets/:id/columns` | service had `/google/columns/:id` | FIXED (alias) |
| 15 | `POST /upload/media` (commerce image upload + inbox media) | service-provider only had exact `POST /api/v1/upload` | FIXED (`api/v1/upload/media` handler) |
| 16 | `POST /contacts/import` (modal sent multipart; lib sent JSON) | contact-service expects `/bulk/contacts/csv-import/upload` (JSON `{csvContent, fileName}`) / `/bulk/contacts/import` | FIXED (frontend updated, modal now sends JSON csvContent) |
| 17 | WhatsApp-form responses export URL `/api/v1/automation/whatsapp-forms/...` | engine mounts at `/api/automation/engine/...` | FIXED (frontend URL → `/api/v1/automation/engine/...`) |
| 18 | Invalid/expired token → gateway returned **502** | should be 401 | FIXED (auth-service 400/401/403 → client 401) |

## Known gaps (documented, NOT fixed — no backend implementation exists)

- `POST /api/v1/super-admin/billing/reconcile` (admin-portal "billing reconcile" button): no reconcile handler exists in billing-service. Gateway now routes it to billing admin; billing returns 404 until implemented.
- websocket: frontend listens for `inbox:message_sent`, `inbox:status_batch`, `campaign:message_status_batch` — server never emits these names (it emits `inbox:message_new`, `inbox:message_status`, `campaign:event`). Dead listeners, no functional loss (covered by emitted events).
- auth-service has **no** `/super-admin/*` routes; the gateway fallback `/api/v1/super-admin → auth` is effectively dead for non-gupshup/plans/billing paths.

## Verified-aligned (no action needed)

- `/auth/*`, `/workspace/members|teams|roles|settings|inbox-settings`, `/contacts*`, `/crm/*`, `/bulk/*`, `/inbox/*`, `/conversations/*`, `/analytics/*`, `/metrics/*`, `/support/*`, `/campaign/*`, `/ads/*`, `/flows/*`, `/widget/*`, `/developer/*`, `/templates/*` (incl. rules/analytics), `/commerce/*`, `/workspace/billing/*`, `/workspace/pricing`, `/api/webhooks/*` (razorpay → billing, rest → ingestor), `/socket.io` ws proxy, internal `chat→bsp /internal/v1/bsp/messages/send`, `auth→bsp onboarding/sync-state`, campaign/automation internal clients.
