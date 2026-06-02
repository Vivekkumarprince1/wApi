# Production-Hardening Final Report

This report covers the audit, fixes, and tests landed against the
issues observed in the running stack. Each section names the root
cause, the files changed, the risk level, and how to validate.

Architecture as observed (current paths, not the legacy monolith):

```
Frontend (Next 15)
  └─ /api/v1/*  ─►  API Gateway (Fastify, 5001)
                     ├─ /api/v1/billing/*    ─►  Billing Service (Express, 3003)
                     ├─ /api/v1/campaign/*   ─►  Campaign Service (Express, 3002)
                     ├─ /api/v1/automation/* ─►  Automation Service (Express, 3001)
                     ├─ /socket.io/*         ─►  WebSocket Service (Socket.IO + Redis adapter, 4000)
                     └─ everything else      ─►  Core Server (Express monolith, 3004)
                                                  ├─ proxyController.forwardToService(...)
                                                  └─ MongoDB + Redis + BullMQ
```

---

## 1. Redis eviction warnings (`volatile-lru` vs `noeviction`)

**Root cause** — Each service stood up its own `IORedis` client with
hand-rolled options. BullMQ probed the policy on every queue init and
logged `IMPORTANT! Eviction policy is volatile-lru. It should be
"noeviction"` once per queue per service — looks like a storm. There
was no boot-time validation and no single source of truth.

**Fix**
- New shared helpers in
  [packages/contracts/src/redis-config.ts](packages/contracts/src/redis-config.ts):
  - `assertRedisPolicy()` — boot-time validator. **Fails fast in
    production**, **warns once in development**, optionally repairs
    via `REDIS_AUTO_FIX_POLICY=1`.
  - `bullmqConnectionOptions()` — the canonical
    `{ maxRetriesPerRequest: null, enableReadyCheck: false }` blob.
  - `resolveRedisUrl()` — single URL fallback.
  - `readMaxMemoryPolicy()` — used by the `/health/redis`
    diagnostics endpoint.
- Service redis modules now route through the contract:
  [billing-service/src/lib/redis.ts](billing-service/src/lib/redis.ts),
  [campaign-service/src/lib/redis.ts](campaign-service/src/lib/redis.ts),
  [automation-service/src/lib/redis.ts](automation-service/src/lib/redis.ts),
  [server/src/utils/ioredis.ts](server/src/utils/ioredis.ts),
  [websocket-service/src/index.ts](websocket-service/src/index.ts).
- Each service calls `ensureRedisPolicy()` (or `assertRedisPolicy`
  directly) exactly once at boot. Subsequent imports are no-ops via an
  internal flag, so the warning fires at most once per process.
- New diagnostics endpoint
  [GET /health/redis](server/src/index.ts) on the core server returns
  `{ policy, required, ok, url(redacted) }`.

**Risk** — low. Behaviour preserved for healthy environments; existing
clients keep their exports (`redisClient`, `getSharedConnection`, etc.).

**Validation**
- Boot any service against a Redis that has
  `maxmemory-policy=volatile-lru` and watch for **one** warning, not
  five.
- `redis-cli config set maxmemory-policy noeviction`, restart, see the
  warning disappear.
- Hit `GET http://localhost:3004/health/redis` — expect `ok: true`.
- Run the unit tests (Section 9).

---

## 2. Billing `GET /api/billing/wallets/admin/stats` returns 401

**Root cause** — two issues, the second masquerading as the first.

1. The gateway *did* inject `x-user-id` / `x-user-role` /
   `x-internal-service-secret` for `/api/v1/billing/*`. But the
   billing `authenticate` middleware only accepted gateway headers
   when `safeEqualSecret(x-internal-service-secret)` returned `true`
   AND `x-user-id` was present. If `INTERNAL_SERVICE_SECRET` differs
   between the gateway and billing `.env`, **both branches fail** —
   the gateway branch on the secret mismatch, the JWT branch because
   the gateway strips the original Authorization header. Hence the
   `x-workspace-id: undefined` / `x-user-id: undefined` log line.
2. `/admin/stats` was gated with `authorize(['super_admin'])` using a
   plain `Array.includes(req.user.role)`. Any role-string drift
   between issuer and consumer immediately 401s.

**Fix**
- Stronger diagnostics in
  [billing-service/src/middleware/auth.ts](billing-service/src/middleware/auth.ts):
  on a secret mismatch we log a SHA-256 fingerprint prefix of both
  secrets (never the secret itself) so config drift is one log line
  away from being obvious. Dedupes per `(providedFp, expectedFp)` so
  repeated requests don't flood logs.
- New `requireSuperAdmin` middleware compares through the canonical
  `isPlatformAdmin()` helper, accepting all super-admin aliases
  (`super_admin`, `staff`, `superadmin`, `super-admin`).
  [billing-service/src/middleware/auth.ts](billing-service/src/middleware/auth.ts)
- Wallet routes updated:
  [billing-service/src/routes/walletRoutes.ts](billing-service/src/routes/walletRoutes.ts)
- The gateway proxy now sends `x-workspace-id` as `""` instead of
  silently dropping the header, so the downstream service can tell
  "header lost in transit" from "no value":
  [api-gateway/src/routes/proxy.ts](api-gateway/src/routes/proxy.ts).
- The core server's `proxyController.buildProxyHeaders` does the same:
  [server/src/controllers/proxyController.ts](server/src/controllers/proxyController.ts).

**Risk** — low/medium. The new middleware is stricter (super-admin
required) but behaviour is identical for the legitimate caller.

**Validation**
- `curl -H "Cookie: auth_token=$JWT"
  http://localhost:5001/api/v1/billing/wallets/admin/stats`
  should return 200 with stats data when the JWT carries `role:
  super_admin`.
- Mismatch the `INTERNAL_SERVICE_SECRET` between gateway and billing,
  retry — expect a clear one-line `[Billing Auth]
  x-internal-service-secret mismatch …` warning, not a generic 401.

---

## 3. `admin` vs `super_admin` drift across services

**Root cause** — There was no shared enum. JWTs sometimes carried
`role: 'admin'` (workspace admin), sometimes `role: 'super_admin'`
(platform admin). The frontend treated `'admin'` as a workspace
admin; the billing service treated `'super_admin'` as the platform
admin. A casual rename or a stale JWT slipped through.

**Fix**
- New canonical enum:
  [packages/contracts/src/roles.ts](packages/contracts/src/roles.ts).
  - `Roles.{SuperAdmin, Owner, Admin, Manager, Agent, Viewer}`.
  - `normalizeRole()` — maps known strings + documented aliases. The
    legacy `'admin'` **always** normalises to workspace admin, never
    super_admin.
  - `isPlatformAdmin()` / `isWorkspaceAdmin()` / `roleAtLeast()`.
- Wired into:
  - gateway auth ([api-gateway/src/middlewares/auth.ts](api-gateway/src/middlewares/auth.ts))
  - gateway proxy header injection ([api-gateway/src/routes/proxy.ts](api-gateway/src/routes/proxy.ts))
  - billing auth + `requireSuperAdmin` ([billing-service/src/middleware/auth.ts](billing-service/src/middleware/auth.ts))
  - core proxy controller ([server/src/controllers/proxyController.ts](server/src/controllers/proxyController.ts))

**Risk** — low. Existing role strings continue to flow; only the
interpretation is consolidated.

**Validation**
- Run `npm test` inside `packages/contracts`. The included tests
  cover the alias map and the platform/workspace boundary.

---

## 4. `/api/v1/auth/session` request storm

**Root cause**
- `frontend/src/store/auth-store.ts` deduped concurrent calls via
  `inFlightPromise` but did **not** throttle sequential calls. Login,
  register, billing and onboarding pages all fired `fetchSession(true)`
  inside the first second of a page load.
- `AuthInitializer` listened to both `storage` and `authChange`
  events. `storage` fires on any cross-tab localStorage write — every
  socket bootstrap re-triggered a session fetch.

**Fix**
- New `MIN_SESSION_REFETCH_MS = 1500` guard. Re-entrant
  `fetchSession(true)` calls within that window return immediately.
  [frontend/src/store/auth-store.ts](frontend/src/store/auth-store.ts).
- New `invalidateSession()` helper as the canonical post-mutation
  refresh path — clears `inFlightPromise` and `lastFetchedAt`, then
  fetches once. Same file.
- `AuthInitializer` no longer listens to the broad `storage` event;
  only the explicit `authChange` window event:
  [frontend/src/components/providers/auth-initializer.tsx](frontend/src/components/providers/auth-initializer.tsx).

**Risk** — low. Behaviour for genuinely new tabs / logout is
preserved; only the cross-tab storage chatter is suppressed.

**Validation**
- Log in, watch the network tab. Pre-fix: 5–8 `/auth/session` calls
  inside the first second. Post-fix: 1 (with `cache-control: private,
  max-age=2` allowing the browser to short-circuit further mounts).

---

## 5. `/auth/session` latency (1.2–1.5 s → < 200 ms target)

**Root cause** ([server/src/controllers/authController.ts:166+](server/src/controllers/authController.ts:166))
- `SystemSettings.getSettings()` was awaited **twice** sequentially
  in the response payload.
- The billing-service wallet RPC was awaited **before**
  `getWorkspaceAccessDecision()` ran — sequential, not parallel.
- An optional legacy `POST /wallets/:id/sync` round-trip ran for every
  request whose local balance was zero — by far the common case.

**Fix**
- `SystemSettings.getSettings()` is now memoised for 30s with a single
  in-flight promise:
  [server/src/models/system/SystemSettings.ts](server/src/models/system/SystemSettings.ts).
  Also calls `.lean()` so we don't pay full hydration for a read.
- `me()` now `Promise.all`s the three independent IO calls (wallet
  fetch, access decision, system settings):
  [server/src/controllers/authController.ts](server/src/controllers/authController.ts).
- Legacy-sync RPC is gated on `localBalancePaise > 0`. For every user
  whose balance is already 0 this saves the round-trip entirely.
- Sets `Cache-Control: private, max-age=2` so back-to-back mounts in
  the same render cycle don't repeat the network call.

**Risk** — medium. The cache is per-process and 30s long. Force an
invalidation via `(SystemSettings as any).invalidateCache()` from the
admin settings save path if you want the dashboard to reflect immediate
changes; otherwise the 30s window is well within UX tolerance.

**Validation**
- Hot-path: `time curl -H "Cookie: …"
  http://localhost:5001/api/v1/auth/session`. Expect < 200 ms steady
  state once caches warm.
- Cold path (first request after process boot): < 500 ms.

---

## 6 + 7. Gupshup auth + token cache thrashing

**Root cause** ([server/src/services/bsp/gupshup-token-service.ts](server/src/services/bsp/gupshup-token-service.ts))
- `resolvePartnerToken(true)` logged `Forced refresh requested for
  Partner Token - clearing cache` on every call, even when the 30s
  cool-down later short-circuited and returned the cached token. Logs
  looked like a storm even when one HTTP login was occurring per 30s.
- The forced-refresh code path **wiped the in-memory cache and Redis
  key before** checking the cool-down — leaving a 30-second window in
  which the cache was empty but no fetch happened.
- A 401 storm against an app could collapse onto the Redis lock but
  each iteration still queued its own forced refresh, repeating the
  expensive partner-token flow.

**Fix** (single file, [server/src/services/bsp/gupshup-token-service.ts](server/src/services/bsp/gupshup-token-service.ts))
- The cool-down is now consulted **before** any cache invalidation,
  so an ignored force-refresh is a true no-op.
- The log line moved to the actual refresh path. It now reads
  `Refreshing Partner Token` and fires exactly once per real login.
- New in-process `inflightPartnerRefresh: Promise<string> | null`
  collapses concurrent partner refreshes to a single HTTP call.
- New `inflightAppRefresh: Map<appId, Promise<string>>` does the same
  for app tokens, so 401 storms against a single appId collapse to one
  re-login instead of one per caller.
- Cache writes also backfill the memory cache so the next caller
  short-circuits without re-reading Redis.

**Risk** — low. Same external behaviour; fewer HTTP calls and fewer
log lines.

**Validation**
- Force 50 concurrent `resolveAppToken(appId)` calls during a 401
  storm. Pre-fix: 50 partner-token refresh logs. Post-fix: 1.
- Tail logs during normal operation: at most one `Refreshing Partner
  Token` per token TTL.

---

## 8. API Gateway hardening

**Root cause**
- `rewriteRequestHeaders` spread every inbound header into the
  upstream request. A client could simply set its own `x-user-id` /
  `x-internal-service-secret` and bypass authentication entirely.
- No upstream timeout — a hung billing-service held a gateway
  connection forever.
- The noisy `[API Gateway] Proxying route …` log line fired on every
  request.

**Fix** ([api-gateway/src/routes/proxy.ts](api-gateway/src/routes/proxy.ts))
- Inbound headers in `STRIPPED_INBOUND_HEADERS` are removed before the
  authoritative trusted values are added. Includes `x-user-id`,
  `x-workspace-id`, `x-user-role`, `x-user-impersonating`,
  `x-internal-service-secret` plus the hop-by-hop set
  (`connection`, `keep-alive`, `te`, `trailer`, `transfer-encoding`,
  `upgrade`, the `proxy-*` family).
- `requestsTimeout` defaults to 8s, overridable via
  `GATEWAY_UPSTREAM_TIMEOUT_MS`.
- Correlation ID echoed on every response via a Fastify `onSend` hook.
- Removed the noisy per-request console.log.
- Role from JWT is normalised through `normalizeRole()` before being
  forwarded ([api-gateway/src/middlewares/auth.ts](api-gateway/src/middlewares/auth.ts)).

**Risk** — medium. The header strip is intentionally aggressive. If
any external client legitimately set `x-user-impersonating` (it
shouldn't), it would stop working. Confirmed no internal callers
expect that.

**Validation**
- `curl -H 'x-user-id: hacker'
  http://localhost:5001/api/v1/billing/wallets/admin/stats` — should
  401 (no JWT) rather than be honoured as a forged identity.
- Take down the billing service and hit `/api/v1/billing/…`. Should
  504 (or equivalent) after ~8s, not hang.

---

## 9. Health / Readiness / Metrics endpoints

Every service now exposes the standard triad:

| Service | `/health` | `/live` | `/ready` | `/metrics` |
|---|---|---|---|---|
| API Gateway | proxies core | yes | proxies core | yes |
| Core Server | full report | yes | DB+Redis ping | yes (+ `/health/redis`) |
| Billing | DB report | yes | DB+Redis ping | yes |
| Campaign | DB report | yes | DB+Redis ping | yes |
| Automation | DB report | yes | DB+Redis ping | yes |
| WebSocket | basic | yes | Redis ping | yes |

`/metrics` returns plain-text Prometheus exposition (uptime, RSS,
heap). No extra dependency — keeps the metric surface minimal and
portable.

Files:
[api-gateway/src/routes/proxy.ts](api-gateway/src/routes/proxy.ts),
[server/src/index.ts](server/src/index.ts),
[billing-service/src/index.ts](billing-service/src/index.ts),
[campaign-service/src/index.ts](campaign-service/src/index.ts),
[automation-service/src/index.ts](automation-service/src/index.ts),
[websocket-service/src/index.ts](websocket-service/src/index.ts).

**Risk** — low.

**Validation** — `for s in 3001 3002 3003 3004 4000 5001; do echo
"=== :$s ==="; curl -s http://localhost:$s/ready | head; done`.

---

## 10. Tests

- [packages/contracts/src/__tests__/roles.test.ts](packages/contracts/src/__tests__/roles.test.ts)
  — covers the canonical enum, alias map, the legacy-`admin`
  guarantee, and the platform/workspace boundary.
- [packages/contracts/src/__tests__/redis-config.test.ts](packages/contracts/src/__tests__/redis-config.test.ts)
  — covers boot-time policy assertion (ok / dev-warn / prod-fail /
  auto-fix paths) using an in-memory fake client.

`npm test` inside `packages/contracts` compiles to `dist-test/` and
runs both files. No test framework dependency — pure
`node:assert/strict` + a literal `test()` helper.

---

## Performance audit (highlights)

**Bottlenecks**
- `/auth/session` was the single biggest user-facing hot path. Three
  fixes in §5 cut the steady-state path to a single DB read + cached
  settings hit.
- Each microservice opened its own ioredis socket pool. They still
  do (sockets are cheap) but BullMQ now reuses the canonical options
  factory.

**Anti-patterns identified and fixed**
- Duplicated `new IORedis(...)` instantiation across five files. Now
  goes through a single options helper.
- `Array.includes` role checks that bypass aliasing — replaced with
  `isPlatformAdmin()` / `isWorkspaceAdmin()`.
- Spreading every inbound header into the upstream request (auth
  forgery surface).
- Sequential awaits of independent IO in `/auth/session`.

**Security concerns addressed**
- Client-set `x-user-id` / `x-internal-service-secret` were
  effectively trusted before — now stripped at the gateway boundary
  before injection.
- `INTERNAL_SERVICE_SECRET` drift between services produced silent
  401s; now produces a clear one-line warning with secret
  fingerprints.

**Scalability / observability**
- `/health/redis` diagnostics endpoint to confirm policy from outside.
- Single-flight token refresh removes thundering-herd behaviour under
  401 storms.
- `/metrics` is Prometheus-compatible without taking on prom-client as
  a dependency.

**Items NOT addressed (left as follow-ups)**
- BullMQ connection sharing across queues *within* a service — each
  queue still constructs a fresh ioredis. Centralisable but lower
  priority; not a correctness bug.
- Per-route request validation in the gateway (zod schemas). The
  current model is "trust the upstream service to validate". This is
  consistent with the existing posture; flagging for a future hardening
  pass.
- Distributed tracing readiness (W3C `traceparent`). Correlation IDs
  are now consistent end-to-end; full OpenTelemetry was out of scope
  here.

---

## Files changed

```
api-gateway/src/middlewares/auth.ts
api-gateway/src/routes/proxy.ts
automation-service/src/index.ts
automation-service/src/lib/redis.ts
billing-service/src/index.ts
billing-service/src/lib/redis.ts
billing-service/src/middleware/auth.ts
billing-service/src/routes/walletRoutes.ts
campaign-service/src/index.ts
campaign-service/src/lib/redis.ts
frontend/src/components/providers/auth-initializer.tsx
frontend/src/store/auth-store.ts
packages/contracts/src/__tests__/redis-config.test.ts          (new)
packages/contracts/src/__tests__/roles.test.ts                 (new)
packages/contracts/src/redis-config.ts                          (new)
packages/contracts/src/roles.ts                                 (new)
packages/contracts/src/index.ts
packages/contracts/package.json
packages/contracts/tsconfig.json
packages/contracts/tsconfig.test.json                           (new)
server/src/controllers/authController.ts
server/src/controllers/proxyController.ts
server/src/index.ts
server/src/models/system/SystemSettings.ts
server/src/services/bsp/gupshup-token-service.ts
server/src/utils/ioredis.ts
websocket-service/src/index.ts
```

## Local validation checklist

1. `cd packages/contracts && npm install && npm test` — expect all
   tests passing.
2. `node controlled-build.js` — full TypeScript build across
   workspaces.
3. `node controlled-run.js` — start the stack. Expect:
   - One condensed Redis policy warning per service (or none in
     production when policy is correct).
   - No more `Forced refresh requested for Partner Token` floods.
   - `/api/v1/auth/session` returning in < 200 ms once warm.
   - `/api/v1/billing/wallets/admin/stats` returning 200 for a
     super_admin JWT.
4. `curl http://localhost:5001/ready` — expect 200 with both DB and
   Redis reported OK.
5. `curl http://localhost:3004/health/redis` — expect `{ ok: true,
   policy: "noeviction" }`.
