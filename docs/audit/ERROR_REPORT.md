# Error Report — root causes by status code — 2026-06-10

## 404 Not Found (all fixed)
- `/provider/v1/*` vs `/bsp/v1/*` gateway drift → WABA settings, onboarding (incl. `/onboarding/bsp/*`), legacy provider onboarding, internal provider bridge. **Root cause:** Phase-2 BSP migration renamed NestJS controller prefixes; gateway rewrites not updated.
- `/api/v1/super-admin/*` routed to auth-service which has no such routes. **Root cause:** super-admin ops actually live in service-provider (`/internal/v1/bsp/admin`) and billing (`/api/billing/wallets/admin`).
- Missing endpoints: automation `logs`, `rules/:id/execute`, `instagram-quickflows/:id/toggle`, Google Sheets per-spreadsheet aliases, `upload/media`, `contacts/import`. All implemented or re-pointed.
- Frontend export URL missing `/engine` segment.

## 401 Unauthorized (fixed)
- Admin-portal writes: gateway stripped `x-internal-service-secret`/identity headers from ALL inbound traffic with no trusted-caller path; plus placeholder secret in admin `.env.local`. → trusted pass-through (timing-safe) + secret aligned.
- service-provider 401'd gateway-authenticated requests: NestJS guards require `x-internal-service` name which gateway never sent. → gateway injects `x-internal-service: api-gateway`.
- Invalid/expired tokens surfaced as 502 (see below) — now properly 401.

## 502 Bad Gateway (fixed)
- ALL `/api/v1/automation/*`: gateway env `AUTOMATION_SERVICE_URL=:3005`, service listens on :3001.
- Invalid token → gateway mapped auth-service 401 to a 502 "auth service offline". Now only network/5xx verify failures produce 502.

## 4xx/5xx verified-correct behaviors (no change)
- 401 on all protected routes without credentials (per-service middleware) ✓
- Spoofed identity headers without/with wrong secret → 401 ✓
- Rate limits: authRateLimit on /auth, apiRateLimit on /api, bulkRateLimit on /bulk ✓
- Proxy error handler guards ws-upgrade sockets (no `res.writeHead` crash) ✓

## Build errors (fixed)
- api-gateway TS2307 `zod` not installed (declared in package.json).

## Outstanding (documented, low risk)
- `super-admin/billing/reconcile` → billing has no handler → clean 404.
- Auth fallback `/api/v1/super-admin/*` (non gupshup/plans/billing) → 404 by design until auth-service grows such routes.
