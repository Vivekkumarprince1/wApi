# Production-Hardening Fix Plan

Architecture as observed in this repo (current paths, not the old monolith):

```
Frontend (Next 15)
  └─ /api/v1/*  ─►  API Gateway (Fastify, 5001)
                     ├─ /api/v1/billing/*    ─►  Billing Service (Express, 3003)
                     ├─ /api/v1/campaign/*   ─►  Campaign Service (Express, 3002)
                     ├─ /api/v1/automation/* ─►  Automation Service (Express, 3001)
                     ├─ /socket.io/*         ─►  WebSocket Service (Socket.IO + Redis adapter, 4000)
                     └─ everything else      ─►  Core Server (Express monolith, 3004)
                                                  ├─ proxyController.forwardToService(...)
                                                  │   re-forwards selected calls to billing/campaign/automation
                                                  └─ MongoDB + Redis + BullMQ
```

Key cross-cutting findings drove the plan below.

---

## 1. Redis eviction warnings

**Root cause**
The `IMPORTANT! Eviction policy is volatile-lru. It should be "noeviction"` line is emitted by **BullMQ itself** the first time it touches Redis. Each service stands up its own `IORedis` client *and* multiple `Queue`/`Worker` instances, and every service repeats this dance: `billing-service/src/lib/redis.ts`, `campaign-service/src/lib/redis.ts`, `automation-service/src/lib/redis.ts`, `server/src/utils/ioredis.ts`, `websocket-service/src/index.ts`.
Symptom = repeated warnings = no central validation + bad maxmemory-policy on the actual Redis.

**Fix**
- Add `packages/contracts/src/redis-config.ts` with `assertRedisPolicy()` + `createBullMQConnection()`. Single source of truth.
- Each service calls `assertRedisPolicy()` once on boot:
  - prod: log error + exit 1 if `maxmemory-policy !== 'noeviction'`
  - dev: single condensed warning (with `REDIS_AUTO_FIX_POLICY=1` it will run `CONFIG SET maxmemory-policy noeviction`)
- BullMQ gets a shared dedicated connection factory. Cuts duplicate connections too.
- Add `/health/redis` to gateway + core that returns `{ url, policy, ok }`.

## 2. Billing 401 on `/api/billing/wallets/admin/stats`

**Root cause**
The gateway *does* inject `x-user-id` / `x-user-role` / `x-internal-service-secret` on `/api/v1/billing/*` (see [proxy.ts:107-114](api-gateway/src/routes/proxy.ts:107)). The reason `undefined` shows up at the billing service is two-fold:

1. The gateway only injects `x-workspace-id` *if* `req.user.workspaceId` is set. For a super-admin JWT this field is empty → no header. The billing controller for `admin/*` then sees `req.workspace = undefined` and *logs* the undefined values when downstream code tries to read them.
2. The billing `authenticate` middleware accepts gateway headers **only when the timing-safe compare on `x-internal-service-secret` succeeds AND `x-user-id` is present**. If `INTERNAL_SERVICE_SECRET` differs between gateway and billing service `.env` files, both arms fail and you get 401.

**Fix**
- Stop silently dropping `x-workspace-id`: send the empty string and let the downstream filter on it (so the gateway log clearly shows whether the value was actually omitted vs. lost).
- Stronger logging: on `safeEqualSecret` mismatch, log the request path and a SHA-256 prefix of both secrets to make config drift obvious in dev (never the secrets).
- Add an explicit `requireSuperAdmin` middleware in billing that handles `super_admin` plus the legacy `admin` alias.
- Make the gateway-→-billing axios path in `proxyController.forwardToService` always forward `x-user-id`, `x-workspace-id`, `x-user-role`, `x-correlation-id`, `x-internal-service-secret`.
- Add an integration unit test verifying the header pipeline.

## 3. `admin` vs `super_admin` drift

**Root cause**
- JWT issued by `authController.login` can carry `role: 'admin'` for a workspace admin while a separate `role: 'super_admin'` exists for platform staff.
- Several places casually compare to magic strings: `frontend/src/store/auth-store.ts` uses `['owner','manager','admin']` to mean **workspace admin**, billing route `authorize(['super_admin'])` means **platform admin**.
- There is no shared enum, so a casual rename (or an old JWT) silently mismatches.

**Fix**
- Add `packages/contracts/src/roles.ts` with a canonical enum + helpers (`isPlatformAdmin`, `isWorkspaceAdmin`, `normalizeRole`).
- Wire it into:
  - billing `authorize`
  - gateway `authenticateGateway` (validate the decoded `role` against the enum)
  - core `authController.me` (echo the canonical role)
- Allow the legacy `'admin'` value to map only to **workspace admin**, never to `super_admin`, eliminating implicit conversion.

## 4. `/api/v1/auth/session` request storm

**Root cause**
- `frontend/src/store/auth-store.ts` dedupes concurrent calls via `inFlightPromise` but **does not throttle sequential calls**. Login, register, billing, onboarding pages and `AuthInitializer` all call `fetchSession(true)` independently within the first second.
- `AuthInitializer` listens to both `storage` and `authChange` events and re-fires `fetchSession(true)` on each, which the socket bootstrap also dispatches.
- The query provider has `staleTime: 60_000` but session is not a React Query → does not benefit.

**Fix**
- Add a `MIN_SESSION_REFETCH_MS` guard (default 1500ms) in `auth-store.ts`. Re-entrant `fetchSession(force=true)` within that window returns the cached promise.
- Replace ad-hoc post-mutation `fetchSession(true)` callers with a single `invalidateSession()` helper that respects the throttle.
- Clear the `authChange` listener cycle: only the auth store dispatches it, only AuthInitializer listens.

## 5. `/auth/session` latency 1.2–1.5s

**Root cause** ([authController.ts:166-348](server/src/controllers/authController.ts:166))
- `SystemSettings.getSettings()` is called **twice** sequentially in the response payload.
- `proxyController.forwardToService('billing', GET wallet)` is awaited *before* `getWorkspaceAccessDecision()` runs — sequential, not parallel.
- An optional `POST /wallets/:id/sync` round-trip is gated on a stale flag and adds another sequential billing call.
- The self-healing Gupshup sync (`syncAssignedGupshupApp`) is fire-and-forget but reuses the request connection — usually OK; left alone.

**Fix**
- Cache `SystemSettings.getSettings()` for 30s (already memoized in some legacy versions but here it's not).
- `Promise.all` the wallet fetch with the access decision.
- Guard the legacy-sync RPC with `Wallet.isLegacySynced` first via a HEAD/lean fetch, or just skip it when the local balance is 0 (the common case).
- Defer the system status fetch to a parallel call.
- Add `cache-control: private, max-age=2` for clients that re-poll.

Target: under 200ms steady state once the in-memory caches warm.

## 6 + 7. Gupshup auth + token cache thrashing

**Root cause** ([gupshup-token-service.ts:228-300](server/src/services/bsp/gupshup-token-service.ts:228))
- The line `console.log('[GupshupTokenService] Forced refresh requested for Partner Token - clearing cache')` runs on *every* `resolvePartnerToken(true)` call, even when the 30s cool-down later returns the cached token. Looks like a storm in logs even though only ~one real refresh per 30s happens.
- The forced-refresh cool-down is only applied after the call has already wiped the in-memory cache and Redis key, so the actual cache *was* invalidated for that 30s window even when no fetch happens — racy.
- App-token refresh cascades: on a 401 it triggers `resolvePartnerToken(true)`, and if many app calls 401 at once each triggers its own retry path (still safe due to lock, but log-spammy and CPU-busy).

**Fix**
- Move the log line *after* the cool-down and *after* cache short-circuits, so it only fires when an actual partner-login HTTP request is about to happen.
- Don't wipe `partnerMemoryCache` / Redis until we've decided we will actually refetch.
- Promise-level single-flight: `inflightPartnerRefresh: Promise<string> | null` next to the Redis lock so concurrent refreshes inside the same process collapse to one HTTP call.
- App-token: same single-flight `Map<appId, Promise>` so a 401 storm collapses to one re-login.

## 8. Gateway hardening

**Root cause**
- The gateway happily copies every inbound header into the upstream call (`proxy.ts` `rewriteRequestHeaders` spreads all `headers`). That means a client can spoof `x-user-id` / `x-internal-service-secret` and ride it directly to billing/automation.
- No request timeouts or upstream retry policy.

**Fix**
- Strip `x-user-id`, `x-workspace-id`, `x-user-role`, `x-user-impersonating`, `x-internal-service-secret`, `x-correlation-id` from inbound headers *before* the gateway adds the trusted versions.
- Add per-upstream timeout (8s default) via `replyFrom` options.
- Always set a fresh `x-correlation-id` if not provided, and surface it on the response.
- Use `pino`'s child logger keyed by correlation id (already configured, just propagate).

## 9. Health / Ready / Metrics

Each Express service currently has only `/health`. Add:
- `/health` — process up
- `/ready`  — DB + Redis reachable (writeable for `/ready`)
- `/metrics` — bare `process` + queue depth counters in Prometheus exposition format (no extra dependency: just plain text)

## 10. FINAL_REPORT.md

Each fix gets: root cause • files changed • risk level (low/med/high) • how to validate locally.

---

## Execution order

1. `@wapi/contracts` extensions (roles, redis-config) — additive, low risk.
2. Redis assertion + wiring per service.
3. Gateway header hardening + correlation-id discipline.
4. Billing auth diagnostics + super_admin alias.
5. Gupshup token service single-flight + log fix.
6. Core `/auth/session` parallelisation.
7. Frontend session throttle.
8. /health,/ready,/metrics endpoints.
9. Tests where feasible (header forwarding + role enum + redis policy validator).
10. FINAL_REPORT.md.
