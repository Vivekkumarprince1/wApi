# wApi — Security Review

> Findings derived from source inspection only. Severity uses CVSS-style qualitative bands (Critical/High/Medium/Low) considering exploitability × impact for a **multi-tenant SaaS handling customer PII and payments**. Each finding cites code and gives a concrete mitigation.

---

## 1. Executive Summary

The platform has **several correct, deliberate controls** — gateway header sanitization, HMAC webhook verification, AES-GCM credential encryption, a separate admin realm, session caching, and per-topic DLQs. However, the **secret-management posture is the dominant risk**: production-capable code paths fall back to **hardcoded default secrets** for the internal-trust secret, JWT signing key, and the credential KEK. Combined with **application-only tenant isolation** and **no committed TLS/network controls**, the system is not yet safe for production multi-tenant operation. None of the findings require a redesign — they are configuration, hardening, and a few targeted code changes.

**Critical: 3 · High: 5 · Medium: 6 · Low: 3**

---

## 2. JWT Implementation

**What exists:** HS256 JWTs signed with `config.jwtSecret`; issued by auth-service (`authController.ts:101,291,325`), verified at the gateway via `verify-session` and locally by websocket-gateway (`index.ts:79`) and the BSP guard (`workspace-auth.guard.ts:43`). Session payload cached in Redis 60s (`authController.ts:825-899`).

| ID | Finding | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| **JWT-1** | **Default JWT secret fallbacks** `'your-jwt-secret'` and `'your-default-secret'` — token forgery if env unset | **Critical** | `websocket-gateway/src/index.ts:14`, `service-provider/.../workspace-auth.guard.ts:38` | Remove fallbacks; fail-fast at boot if `JWT_SECRET` missing; same secret loaded from Key Vault everywhere |
| JWT-2 | Symmetric HS256 shared across all services — any single service compromise yields a forging key | High | `JWT_SECRET` in every `.env.example` | Move to **RS256/ES256 + JWKS**; only auth-service holds the private key; services verify with public key |
| JWT-3 | No standard `aud`/`iss`/`jti` claims or rotation; revocation only via 60s cache expiry | Medium | `authController.ts:819` `jwt.verify` with no options | Add `iss/aud/jti`, short TTL + refresh tokens, Redis denylist on logout (logout only clears cookie + cache today, `authController.ts:117-129`) |
| JWT-4 | Password-reset token uses same secret, 1h, no single-use enforcement | Medium | `authController.ts:325-329,347-367` | Single-use (store jti), separate purpose key |

---

## 3. RBAC

**What exists:** Customer RBAC via `Permission.permissions` map seeded from `getDefaultPermissions(role)` for owner/admin/manager/agent/viewer (`auth-service/models/index.ts:76-135`); custom `Role` collection; admin RBAC via `adminCan()` capabilities (`contracts/admin.ts`).

| ID | Finding | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| RBAC-1 | **Permissions injected as a header** (`x-permissions`, URL-encoded JSON) and trusted downstream — enforcement is per-service and inconsistent | High | gateway sets it (`api-gateway/src/index.ts:99`); services read headers | Centralize a policy check (PDP) or a shared guard; ensure **every** mutating route checks a capability, not just presence of a token |
| RBAC-2 | Downstream services largely trust gateway-set role/workspace with only the shared internal secret as proof | High | `workspace-auth.guard.ts:18-38`, `internal-auth.guard.ts` | mTLS between gateway and services (mesh); signed internal context; rotate secret |
| RBAC-3 | `verifySession` auto-creates an **owner** Permission if missing and the user's `workspace` matches | Medium | `authController.ts:867-875` | Risky self-elevation path; make explicit and audited, never implicit |
| RBAC-4 | Custom roles store free-form `permissions: Mixed` | Low | `auth-service/models:273` | Validate against a known capability set |

---

## 4. Token Storage

| ID | Finding | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| TOK-1 | `auth_token` JWT readable by websocket-gateway from the cookie and used as Bearer — implies it is the raw JWT in a JS-reachable cookie | Medium | `websocket-gateway/src/index.ts:65-79`, gateway parses `auth_token` cookie (`index.ts:66-70`) | Ensure cookie is `httpOnly`, `Secure`, `SameSite=Lax/Strict`; verify `setAuthCookie` flags in `auth-service/src/utils/authHelper.ts`; prefer opaque session id over raw JWT in cookie |
| TOK-2 | Admin cookie flags are correct (`httpOnly`, `secure` in prod, `sameSite:strict`) — **good** | — (positive) | `admin-portal/src/server/auth.ts:134-143` | Keep; apply same rigor to customer cookie |

---

## 5. Secrets Management

| ID | Finding | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| **SEC-1** | **Hardcoded internal-service secret** `'dev-internal-service-secret-change-me'` used as fallback in trust-bearing paths | **Critical** | `api-gateway/src/index.ts:106`, `webhook-ingestor/src/index.ts:18`, `chat-service/.../kafkaService.ts:162,247` | Remove fallback; fail-fast; rotate; move to Key Vault; **mesh mTLS** so a leaked secret alone is insufficient |
| **SEC-2** | **Credential KEK fallback** `'change-me-in-production'` for AES-GCM provider-secret encryption | **Critical** | `service-provider/src/common/secret-box.ts:8` | Require `INTEGRATION_ENCRYPTION_KEY`; fail-fast; rotate-able KEK (envelope encryption / KMS) |
| SEC-3 | `.env` files hold all secrets; no rotation/vault | High | `.gitignore` ignores `.env`; `dotenv` everywhere | Key Vault + CSI driver; per-env scoping; rotation |
| SEC-4 | Config drift: services use secrets/URLs absent from their `.env.example` | Medium | chat-service uses `INTERNAL_SERVICE_SECRET`/`*_SERVICE_URL` not in its example (infrastructure §9) | Boot-time env validation (zod) per service; complete `.env.example` |

**Positive:** provider credentials *are* encrypted at rest with AES-256-GCM (`secret-box.ts`), and the ingestor fails-fast on missing prod env (`webhook-ingestor/src/index.ts:262-272`) — generalize that pattern everywhere.

---

## 6. API Security

| ID | Finding | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| API-1 | **No TLS in repo**; services bind plain HTTP `0.0.0.0` | High | `api-gateway/src/index.ts:460` etc. | TLS at ingress; mTLS internally; HSTS |
| API-2 | Gateway header sanitization is **correct** — strips client `x-user-*`/`x-workspace-id`/`x-internal-*` before injecting | — (positive) | `api-gateway/src/index.ts:47-53` | Keep; ensure services reject these headers unless from the mesh |
| API-3 | Helmet not applied uniformly across services | Medium | helmet only on some (`api-gateway:28`, automation/billing/campaign deps) | Apply security headers everywhere or terminate at ingress |
| API-4 | No request body size limits / input validation on many routes (only `express-validator` in contact, `zod` in some) | Medium | varies | Standardize zod validation at the edge of every service |
| API-5 | Facebook login is a **mock token** path | Low | `authController.ts:301-308` | Remove from production build or gate behind flag |

---

## 7. Webhook Verification

| ID | Finding | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| WH-1 | **Signature check bypassed when secret unset in non-production** | High | `webhook-ingestor/src/index.ts:115-117`, `webhooks.service.ts:146-148` | Acceptable in dev; ensure `NODE_ENV=production` + secret are guaranteed in every non-dev env; alert if bypass path taken |
| WH-2 | HMAC compare uses plain `===` (not constant-time) | Medium | `webhook-ingestor/src/index.ts:128`, `webhooks.service.ts:152` | Use `crypto.timingSafeEqual` to prevent timing attacks |
| WH-3 | Verify-token handshake default `'wapi-verify-token'` | Low | `webhook-ingestor/src/index.ts:139` | Require env; no default |
| WH-4 | **Positive:** instant-200 + idempotent dead-letter + replay; idempotency on `eventId`/`messageId` | — | `webhook-ingestor`, `webhooks.service.ts:57` | Keep |

---

## 8. Rate Limiting

| ID | Finding | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| RL-1 | **In-memory, per-instance limiter** — multiplies by replica count, ineffective when scaled | Medium | `api-gateway/src/middleware/rateLimit.ts:19` | Redis-backed sliding window shared across replicas / at the edge |
| RL-2 | Limiter **fails open** on internal error | Medium | `rateLimit.ts:73-77` | Fail-closed for auth endpoints; log+alert |
| RL-3 | Auth limit is 100/15min keyed by email/IP — generous for credential stuffing | Low | `rateLimit.ts:84-92` | Tighten auth attempts; add lockout/backoff + CAPTCHA |
| RL-4 | No per-tenant quota / no outbound provider rate cap (campaign pacing is in-process) | Medium | `CampaignWorker.ts:207` | Redis token-bucket per workspace; provider TPS guard in Dispatch Worker |

---

## 9. Data Isolation (Multi-Tenancy)

| ID | Finding | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| **ISO-1** | **Tenant isolation is application-enforced only** — every query must manually filter by `workspace`; a single missing filter leaks cross-tenant data | **High** | pervasive `.find({workspace})`; no DB/framework guarantee | Framework-level guard (Mongoose plugin) that **refuses** un-`workspace`-scoped queries on tenant collections; integration tests asserting isolation |
| ISO-2 | Cross-service models (Workspace/Contact/Message/Plan) redefined per service against a shared-capable DB | High | database-analysis §1 | Single writer per aggregate; DB-per-context; read-models via API/CDC |
| ISO-3 | websocket room join checks membership (good) but socket CORS is `*` | Medium | `websocket-gateway/src/index.ts:18-20,105-108` | Restrict CORS origin; keep membership check |
| ISO-4 | Admin portal reads 4 DBs directly, bypassing service-level tenant guards | Medium | `admin-portal/src/server/db.ts` | Route admin reads through read-models/service APIs (super-admin §3) |

---

## 10. CORS & Network

| ID | Finding | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| COR-1 | websocket-gateway `origin:'*'` with `credentials:true` | Medium | `websocket-gateway/src/index.ts:18-20` | Explicit allow-list (gateway already does this — `api-gateway/src/index.ts:20-35`) |
| COR-2 | auth-service `cors({origin:true})` reflects any origin with credentials | Medium | `auth-service/src/index.ts:14` | Allow-list; auth-service should sit behind the gateway only |

---

## 11. Consolidated Risk Register

| Severity | Findings |
|---|---|
| **Critical** | JWT-1 (default JWT secret), SEC-1 (default internal secret), SEC-2 (default KEK) |
| **High** | JWT-2 (shared HS256), RBAC-1 (header-trusted perms), RBAC-2 (gateway trust), API-1 (no TLS), WH-1 (sig bypass), SEC-3 (.env secrets), ISO-1 (app-only isolation), ISO-2 (shared models) |
| **Medium** | JWT-3, JWT-4, RBAC-3, TOK-1, SEC-4, API-3, API-4, WH-2, RL-1, RL-2, RL-4, ISO-3, ISO-4, COR-1, COR-2 |
| **Low** | RBAC-4, API-5, WH-3, RL-3 |

---

## 12. Prioritized Remediation (maps into roadmap.md Phase 1)

1. **Eliminate all default-secret fallbacks** (JWT-1, SEC-1, SEC-2) and add boot-time fail-fast env validation everywhere. *(days, low risk, highest impact)*
2. **Lock down CORS & cookie flags** (COR-1/2, TOK-1). *(hours)*
3. **constant-time HMAC + verify-token env** (WH-2/3). *(hours)*
4. **Redis-backed, fail-closed rate limiting** at the edge (RL-1/2). *(days)*
5. **Tenant-isolation guard** (Mongoose plugin) + isolation tests (ISO-1). *(weeks)*
6. **RS256/JWKS migration** + claims + denylist (JWT-2/3). *(weeks)*
7. **mTLS service mesh** to back internal trust (RBAC-2, SEC-1 defense-in-depth). *(weeks, infra-dependent)*
8. **Admin MFA + separate signing key + impersonation audit** (super-admin §6). *(weeks)*
