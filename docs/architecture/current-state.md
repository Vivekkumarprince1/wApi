# wApi — Current State Architecture

> **Scope & method.** This document is reverse-engineered *only* from source in this repository. Every claim cites the file(s) it was derived from. Where the code is ambiguous or a path appears dead, that is called out explicitly rather than assumed.
> **Snapshot date:** derived from repo state as of the analysis run.

---

## 1. Monorepo Structure

A monorepo with **no root `package.json`** — each service/app installs its own dependencies, and `@wapi/contracts` is linked by relative `file:` path. (Source: `CLAUDE.md`; absence verified by `ls` of repo root showing only `apps/`, `services/`, `packages/`, `wapi-runner.js`.)

```
wApi/
├── apps/
│   ├── admin-portal/      Next 16 + React 19 — Super Admin Platform (port 3100)
│   └── frontend/          Next 16 + React 19 — customer app (port 3000)
├── packages/
│   └── contracts/         @wapi/contracts — shared types, DTOs, Kafka/Socket event payloads
├── services/
│   ├── api-gateway/       Express + http-proxy-middleware (5001)
│   ├── auth-service/      Express (3006) — identity, JWT, OTP, RBAC, audit consumer
│   ├── automation-service/ Express (3001/3005*) — workflows, auto-reply, answerbot, AI intent
│   ├── billing-service/   Express (3003) — wallet, ledger, invoices, Razorpay, commerce
│   ├── campaign-service/  Express (3002) — campaigns, segments, BullMQ worker
│   ├── chat-service/      Express (3008) — conversations, inbox, message persistence
│   ├── contact-service/   Express (3007) — contacts, CRM, tags, quick-replies, bulk import
│   ├── service-provider/  NestJS (3004) — BSP/Gupshup lifecycle, templates, webhooks, dispatch
│   ├── webhook-ingestor/  Fastify (3013) — inbound BSP webhook edge → Kafka
│   └── websocket-gateway/ Express + socket.io (3009) — realtime fan-out
└── wapi-runner.js         dev orchestrator (spawns all 12 processes)
```

> **\*Port ambiguity (documented defect).** The gateway proxies automation to `http://localhost:3005` (`services/api-gateway/src/index.ts:138`) and chat-service triggers automation at `AUTOMATION_SERVICE_URL || 'http://localhost:3005'` (`services/chat-service/src/services/kafkaService.ts:242`), but `CLAUDE.md` documents automation-service on **3001**. The automation service's own `dev` script (`services/automation-service/package.json`) has no `tsx`/`node` prefix (`"dev": "src/index.ts"`) — it is malformed and would not start as written. These must be reconciled.

### Per-service runtime & stack (from each `package.json`)

| Service | Framework | Key deps | Build |
|---|---|---|---|
| api-gateway | Express 4 | `http-proxy-middleware`, `helmet`, `cors`, `morgan` | `tsc` |
| auth-service | Express 4 | `mongoose`, `ioredis`, `kafkajs`, `jsonwebtoken`, `bcryptjs`, `nodemailer`, `twilio` | `tsc` |
| automation-service | Express 4 | `bullmq`, `ioredis`, `kafkajs`, `cheerio`, `zod`, `winston`, `swagger-ui-express` | `tsc` |
| billing-service | Express 4 | `bullmq`, `razorpay`, `ioredis`, `kafkajs`, `zod` | `tsc` |
| campaign-service | Express 4 | `bullmq`, `ioredis`, `kafkajs`, `zod` | `tsc` |
| chat-service | Express 4 | `mongoose`, `kafkajs`, `jsonwebtoken` | `tsc` |
| contact-service | Express 4 | `mongoose`, `kafkajs`, `express-validator` | `tsc` |
| service-provider | **NestJS 10** | `@nestjs/mongoose`, `bullmq`, `ioredis`, `kafkajs`, `cloudinary`, `class-validator` | `nest build` |
| webhook-ingestor | **Fastify** | `kafkajs`, `mongodb` (native driver, not mongoose) | `tsc` |
| websocket-gateway | Express + `socket.io` | `@socket.io/redis-adapter`, `kafkajs`, `mongoose` | `tsc` |

(Source: all `services/*/package.json`.)

---

## 2. Service Map

The **API Gateway** (`services/api-gateway/src/index.ts`) is the single ingress for the customer frontend. It is a pure HTTP router (`http-proxy-middleware`) plus a synchronous auth-verification middleware. The complete routing table, read directly from the gateway:

| Public path (gateway) | Target service | Rewrite | Source line |
|---|---|---|---|
| `/api/v1/auth/*` | auth | strip `/api/v1/auth` | `index.ts:238` |
| `/api/v1/super-admin/*` | auth | → `/super-admin` | `index.ts:239` |
| `/api/v1/workspace/billing` | billing | strip prefix | `index.ts:244` |
| `/api/v1/workspace/pricing` | billing | → `/pricing` | `index.ts:246` |
| `/api/v1/workspace/{tags,quick-replies}` | contact | — | `index.ts:254-255` |
| `/api/v1/workspace/{waba,profile,webhooks,whatsapp/health,phone-numbers,connection-status}` | service-provider | → `/provider/v1/workspace/*` | `index.ts:256-261` |
| `/api/v1/workspace/*` (fallback) | auth | → `/workspace` | `index.ts:264` |
| `/api/v1/settings/api-keys` | automation | → `/keys` | `index.ts:267` |
| `/api/v1/settings/integrations` | automation | → `/api/v1/integrations` | `index.ts:273` |
| `/api/v1/settings/team` | auth | → `/workspace/members` | `index.ts:279` |
| `/api/v1/settings/*` | auth | → `/workspace/settings` | `index.ts:308` |
| `/api/v1/business/*` | auth | strip prefix | `index.ts:314` |
| `/api/v1/contacts/:id/send-template` | chat | → `/api/v1/inbox/contacts/*` | `index.ts:329` |
| `/api/v1/contacts`, `/crm`, `/bulk` | contact | — | `index.ts:334-336` |
| `/api/v1/inbox`, `/conversations`, `/analytics`, `/metrics`, `/support` | chat | — | `index.ts:339-343` |
| `/api/v1/billing/*` | billing | → `/api/billing/wallets` | `index.ts:346` |
| `/api/v1/commerce/*` | billing | — | `index.ts:351` |
| `/api/v1/campaign/*` | campaign | → `/api/campaign` | `index.ts:354` |
| `/api/v1/ads/*` | campaign | — | `index.ts:359` |
| `/api/v1/automation/*` | automation | → `/api/automation` | `index.ts:364` |
| `/api/v1/{flows,widget,developer,integrations}` | automation | — | `index.ts:369-372` |
| `/api/v1/onboarding/*` | service-provider | → `/provider/v1/onboarding` | `index.ts:375-381` |
| `/api/v1/templates`, `/api/v1/upload` | service-provider | — | `index.ts:382-383` |
| `/api/internal/*` | billing / contact / provider / chat | various | `index.ts:386-410` |
| `/api/webhooks/razorpay` | billing | → `/api/billing/webhooks` | `index.ts:414` |
| `/api/webhooks/*` | webhook-ingestor | → `/webhooks` | `index.ts:419` |
| `/socket.io` (WS upgrade) | websocket-gateway | `ws:true` | `index.ts:431-439` |

**Observation:** routing is order-sensitive and hand-tuned (multiple comments warn "MUST come before…", e.g. `index.ts:242-243`). The path-rewrite scheme is highly heterogeneous — each downstream service mounts routes on a *different* base (`/api/billing/wallets`, `/api/campaign`, `/api/automation`, `/provider/v1/*`, bare `/workspace`). This is a fragility hotspot.

### Inter-service call topology (synchronous HTTP, beyond the gateway)

- **Gateway → auth-service**: every authenticated request calls `POST {auth}/internal/v1/auth/verify-session` *synchronously* before proxying (`api-gateway/src/index.ts:76`). Auth-service is therefore on the hot path of **every** API call. If auth is down the gateway returns 502 (`index.ts:110-124`).
- **chat-service → contact-service**: `POST /internal/v1/contacts/resolve` to resolve/create a contact for an inbound message (`chat-service/src/services/kafkaService.ts:158`).
- **chat-service → automation-service**: fire-and-forget `POST /api/automation/engine/trigger-inbound` after persisting an inbound message (`kafkaService.ts:243`).
- **chat-service → service-provider**: `POST /internal/v1/bsp/messages/send` for every outbound message (`chat-service/src/controllers/chatController.ts:441,622`; `internalController.ts:68,187,411`; `checkout-bot-service.ts:376`).
- **campaign worker → billing/contact/chat/BSP**: via `microserviceWorkerClient` and `serviceRequest('billing', …)` (`campaign-service/src/workers/CampaignWorker.ts:60,87,91,169`).
- **auth control-plane → billing**: `GET {billing}/api/billing/wallets/admin/stats` for the super-admin snapshot (`control-plane-service.ts:26`).
- **admin-portal → all 4 DBs (direct read)** + **gateway (writes)** (`apps/admin-portal/src/server/db.ts`, `auth.ts`).

---

## 3. Dependency Graph

```
                         ┌────────────────────────┐
        frontend ───────▶│      api-gateway       │◀──── admin-portal (writes)
        (3000)           │        (5001)          │
                         └───────────┬────────────┘
   admin-portal (3100) ── direct DB reads (core/billing/campaign/automation)
                                     │ verify-session (sync, hot path)
                                     ▼
   ┌─────────┬──────────┬───────────┬──────────┬───────────┬──────────┬─────────────┐
   ▼         ▼          ▼           ▼          ▼           ▼          ▼             ▼
 auth     contact     chat       campaign   billing   automation  service-     websocket
 (3006)   (3007)     (3008)      (3002)     (3003)    (3001)      provider     gateway
                                                                  (3004,Nest)  (3009)
   │         ▲           │            │          ▲          ▲          ▲             ▲
   │         │ resolve   │ send       │ saga     │ saga     │ trigger  │ dispatch    │
   │         └───────────┤────────────┤──────────┤──────────┘          │             │
   │                     │            │          │                     │             │
   └─ audit-events ──────┴── parsed-message-events, chat-realtime-sync, campaign-events,
                              billing-events, contact-events, raw-webhook-events  (Kafka)
                                     │                                              ▲
                              webhook-ingestor (3013, Fastify) ── raw-webhook-events┘
```

**Shared infrastructure:** MongoDB (Mongoose 8 / native driver in ingestor), Redis (ioredis + BullMQ + socket.io redis-adapter), Kafka (kafkajs). (Source: dependency lists in §1, broker/URI usage throughout.)

`@wapi/contracts` is depended on by: auth, automation, billing, campaign, chat, contact, service-provider, admin-portal (`package.json` deps). **Not** depended on by api-gateway, webhook-ingestor, or websocket-gateway — those three redefine event/topic strings as local literals (e.g. `KAFKA_TOPIC = 'raw-webhook-events'` in `webhook-ingestor/src/index.ts:17`; topic list in `websocket-gateway/src/index.ts:289`). This is a contract-drift risk.

---

## 4. Runtime Architecture

There is **no container/orchestration layer**. The only process manager is `wapi-runner.js`, a development orchestrator that `spawn`s all 12 processes in a detached process group, routes their stdout/stderr with colored prefixes, auto-restarts crashed children after 3s, and exposes an interactive console (`status`, `restart`, `stop`, `start`, `log`, `logs`) (`wapi-runner.js:6-18, 44-117, 182-316`).

Memory is a first-class constraint: every `dev`/`build` script sets `NODE_OPTIONS=--max-old-space-size=2048..4096` because the target dev box is 8 GB and all 12 processes run in parallel (`CLAUDE.md` "Memory constraints"; visible in each `package.json`).

Each service:
- Loads `.env` via `dotenv` at boot.
- Connects to MongoDB (most via Mongoose; ingestor via native `mongodb` driver).
- Optionally connects to Kafka — **all consumers/producers fail soft in non-production**: on connect failure they set `simulatedMode = true` and continue (`webhook-ingestor/src/index.ts:48-54`, `chat-service/src/services/kafkaService.ts:77-83`, `websocket-gateway/src/index.ts:349-351`, `provider-kafka-consumer.service.ts:91-97`). In production they `throw`. This means **locally the event backbone may be silently absent**.

---

## 5. Data Flow (high level)

### Inbound (customer → platform)
Two ingestion paths exist (see Message-Flow doc for full sequence):

1. **Direct BSP webhook** → `service-provider` `webhooks.controller`/`webhooks.service` → parses → produces `parsed-message-events` (`service-provider/src/channels/whatsapp/webhooks/webhooks.service.ts:105,137`).
2. **Edge ingestor** → `webhook-ingestor` (Fastify) validates HMAC, replies 200 instantly, produces `raw-webhook-events` (`webhook-ingestor/src/index.ts:163-206`) → consumed by `service-provider`'s `ProviderKafkaConsumerService`, which **re-invokes `webhooksService.receiveGupshup`** (`provider-kafka-consumer.service.ts:56`) → produces `parsed-message-events`.

`chat-service` is the sole consumer of `parsed-message-events` (`chat-service/src/services/kafkaService.ts:25`): it resolves the contact (HTTP to contact-service), upserts a `Conversation`, creates a `Message`, then produces `chat-realtime-sync` and fires the automation trigger.

`websocket-gateway` consumes `chat-realtime-sync`, `contact-events`, `automation-events`, `billing-events`, `campaign-events` and fans them out to socket.io rooms `workspace:{id}` / `conversation:{id}` (`websocket-gateway/src/index.ts:289, 168-274`).

### Outbound (agent/campaign → customer)
UI → gateway → chat-service (persist) → **synchronous** `POST {bsp}/internal/v1/bsp/messages/send` → `service-provider` `MessagesService.send` → `GupshupClientService.sendMessage` → records a `ProviderMessageDispatch` (`service-provider/src/channels/whatsapp/messages/messages.service.ts:14-45`). Status updates return later via the inbound webhook path and update the `Message` (`chat-service/src/services/kafkaService.ts:87-145`).

### Campaign
campaign-service enqueues BullMQ jobs on `campaign-engine`; `CampaignWorker` runs a **saga** with billing: emits `CampaignCreatedEvent` → waits for `BudgetReservedEvent` → processes batches (sends templates via the BSP bridge with client-side rate pacing) → emits `CampaignCompletedEvent` (`campaign-service/src/workers/CampaignWorker.ts:54-253`; events in `packages/contracts/src/billing-events.ts`).

---

## 6. Authentication Flow

```
Browser ──(auth_token cookie / Bearer)──▶ api-gateway
  api-gateway strips ALL client-supplied x-user-*/x-workspace-id/x-internal-* headers   (index.ts:47-53)
  api-gateway ──POST /internal/v1/auth/verify-session {token}──▶ auth-service           (index.ts:76)
     auth-service: jwt.verify(token, JWT_SECRET)                                          (authController.ts:819)
        → Redis cache check session:{token} (60s TTL)                                     (authController.ts:825-847)
        → loads User, resolves activeWorkspace, loads Permission (role+permissions), Workspace
        → enforces SystemSettings.maintenanceMode (503 unless super_admin)                (authController.ts:880)
        → returns {user, workspace, role, permissions, isImpersonating}
  api-gateway re-injects TRUSTED headers + x-internal-service-secret                       (index.ts:94-106)
  api-gateway proxies to target service
```

**Token issuance** is in auth-service: JWT signed with `config.jwtSecret`, set as `auth_token` cookie (`authController.ts:101, 291, 325`). Login supports password (`bcrypt`), OTP (email/phone via `otp-service`/`twilio`/SMTP), and Google OAuth (`authController.ts:96-299`). Facebook login is a **mock** returning `'mock-fb-token'` (`authController.ts:301-308`).

**Downstream trust model:** services trust the gateway-injected headers, gated by a shared `x-internal-service-secret` / `x-internal-secret` (`service-provider/src/common/internal-auth.guard.ts`, `workspace-auth.guard.ts:18-38`). The default secret is the literal `'dev-internal-service-secret-change-me'` in many places (`api-gateway/src/index.ts:106`, `webhook-ingestor/src/index.ts:18`, `chat-service/.../kafkaService.ts:162,247`).

**Two separate identity realms:**
- Customer realm: `auth_token` cookie, workspace roles `owner/admin/manager/agent/viewer` (`auth-service/src/models/index.ts:76-135`).
- Admin realm: `admin_token` cookie, platform roles `super_admin / super_admin_support / super_admin_finance / super_admin_readonly`, capabilities resolved by `adminCan()` in `@wapi/contracts` (`apps/admin-portal/src/server/auth.ts`, `packages/contracts/src/admin.ts`). Admin login verifies against the *same* core `User` collection but rejects non-admin roles (`auth.ts:96-98`).

---

## 7. Message Flow (summary — full detail in `message-flow.md`)

- Topics in use (from `packages/contracts/src/kafka-events.ts` + grep of producers/consumers): `raw-webhook-events`, `parsed-message-events`, `chat-realtime-sync`, `billing-events`, `campaign-events`, `contact-events`, `automation-events`, `audit-events`. Declared but with **no observed producer/consumer pair fully wired**: `campaign-ledger-ops`, `campaign-budget-reserved` (declared in `kafka-events.ts:10-11` only).
- Every Kafka consumer implements a manual 3-attempt retry with exponential backoff and a `{topic}-dlq` dead-letter publish (`chat-service/.../kafkaService.ts:32-72`, `websocket-gateway/src/index.ts:298-344`, `provider-kafka-consumer.service.ts:39-86`). webhook-ingestor instead persists failures to a Mongo `webhook_dead_letters` collection with a replay endpoint (`webhook-ingestor/src/index.ts:73-92, 217-248`).
- Realtime delivery uses socket.io with a Redis adapter for multi-instance fan-out (`websocket-gateway/src/index.ts:360-373`).

---

## 8. Deployment Architecture

**There is none committed.** Verified absence (find across repo, excluding `node_modules`/`dist`/`.next`):
- ❌ No `Dockerfile` anywhere.
- ❌ No `docker-compose.yml`.
- ❌ No Kubernetes manifests / Helm charts.
- ❌ No `.github/workflows` or any CI/CD config.
- ❌ No Terraform / Azure / cloud IaC.
- ✅ Only `wapi-runner.js` (a dev process manager) and `.env`/`.env.example` per service.

(Source: `find` sweep; `.gitignore` confirms `.env` is git-ignored, and `dist`/`.next`/`node_modules` excluded.)

**Implication:** the platform is currently a **developer-laptop deployment**. Production hosting, scaling, secret distribution, MongoDB/Redis/Kafka provisioning, TLS, and ingress are all undefined in-repo. This is the single largest gap to "enterprise-grade SaaS."

---

## 9. Existing Strengths

1. **Clean event-driven seam for messaging.** The inbound pipeline (`webhook → Kafka → chat-service → realtime-sync → socket.io`) is genuinely decoupled, with DLQs and idempotent upserts keyed on provider message id (`MessageSchema.messageId` is `unique, sparse` — `contracts/models.ts:118`).
2. **Gateway header-spoofing defense.** The gateway forcibly deletes all client-supplied trust headers before injecting verified ones (`api-gateway/src/index.ts:47-53`) — a correct and important control.
3. **Consistent service skeleton.** Express services share the `src/{config,controllers,middleware,models,routes,services}` layout; NestJS service follows Nest module conventions (`CLAUDE.md` Conventions, verified by directory listing).
4. **Shared contracts package** centralizes Kafka topics, event payloads, BSP DTOs, billing saga events, and admin RBAC logic (`packages/contracts/src/*`).
5. **Saga-based budget control for campaigns** prevents overspend by reserving budget before send and settling on actuals (`CampaignWorker.ts` + `billing-events.ts`).
6. **Secrets-at-rest encryption** for provider credentials via AES-256-GCM (`service-provider/src/common/secret-box.ts`).
7. **Separate Super-Admin realm** with its own cookie, role set, and capability matrix — not bolted onto customer auth (`admin-portal/src/server/auth.ts`).
8. **Webhook resilience**: instant-200 + HMAC + Mongo dead-letter + replay endpoint at the ingestion edge (`webhook-ingestor/src/index.ts`).

---

## 10. Existing Bottlenecks

| # | Bottleneck | Evidence | Impact |
|---|---|---|---|
| B1 | **Auth on the hot path of every request.** Gateway makes a blocking HTTP call to auth-service per request, only short-circuited by a 60s Redis cache. | `api-gateway/src/index.ts:76`; cache in `authController.ts:825-899` | Auth latency/availability caps the entire platform; 502 cascade if auth is down. |
| B2 | **Synchronous outbound send.** chat-service awaits the BSP→Gupshup round-trip inline per message. | `chat-service/src/controllers/chatController.ts:438-441` | Agent send latency tied to Gupshup; no queue/backpressure for bursts. |
| B3 | **Client-side rate pacing in campaign worker.** `setTimeout` pacing inside the job, concurrency hardcoded to 5 workers × chunk 10. | `CampaignWorker.ts:21, 146-208` | Throughput is single-process bound; no distributed token-bucket; restarts lose pacing state. |
| B4 | **Double webhook processing path.** Both the ingestor→Kafka→BSP-consumer path and the direct BSP controller path call `receiveGupshup`. | `provider-kafka-consumer.service.ts:56` vs `webhooks.controller.ts` | Risk of duplicate processing; unclear which is canonical. |
| B5 | **In-memory rate limiter in gateway.** Per-instance `Map`, not shared across replicas. | `api-gateway/src/middleware/rateLimit.ts:19` | Rate limits multiply by replica count; ineffective when scaled horizontally. |
| B6 | **websocket-gateway DB lookups on fan-out.** Each `message_created` event may query `conversations` + `contacts`. | `websocket-gateway/src/index.ts:187-202` | DB load scales with message rate on the realtime hot path. |
| B7 | **Auth-service is a god-service.** Owns users, workspaces, permissions, teams, roles, invitations, notifications, business, audit consumer, system settings, webhook policy, BSP health, control-plane snapshot. | `auth-service/src/models/index.ts` (15+ schemas) | Largest blast radius; many domains share one deploy unit. |

---

## 11. Security Risks (summary — full detail in `security-review.md`)

- **R1 — Hardcoded default internal secret** `'dev-internal-service-secret-change-me'` used as a fallback in production-reachable code paths (`api-gateway/src/index.ts:106`, `webhook-ingestor/src/index.ts:18`, `chat-service/.../kafkaService.ts`). If env is unset, internal trust collapses. **Severity: Critical.**
- **R2 — Default JWT secret** fallbacks: `'your-jwt-secret'` (`websocket-gateway/src/index.ts:14`), `'your-default-secret'` (`workspace-auth.guard.ts:38`). Token forgery if env unset. **Severity: Critical.**
- **R3 — Webhook signature bypass in non-production** when secret unset (`webhook-ingestor/src/index.ts:115-117`, `webhooks.service.ts:146-148`). Acceptable in dev, dangerous if `NODE_ENV` misconfigured. **Severity: High.**
- **R4 — CORS `origin:'*'` on websocket-gateway** with `credentials:true` (`websocket-gateway/src/index.ts:18-20`). **Severity: Medium.**
- **R5 — Auth-service root CORS `origin:true`** reflects any origin with credentials (`auth-service/src/index.ts:14`). **Severity: Medium.**
- **R6 — `auth_token` cookie is the JWT**, read directly by websocket-gateway (`index.ts:65-79`) — implies it is not `httpOnly`-only/opaque; verify cookie flags. **Severity: Medium.**
- **R7 — Rate limiter fails open** on internal error and is per-instance (`rateLimit.ts:73-77`). **Severity: Medium.**
- **R8 — Tenant isolation is application-enforced only** (every query filters by `workspace`), with no DB-level guarantee; a missing filter leaks cross-tenant data. **Severity: High (systemic).**

---

## 12. Scalability Limitations

1. **No horizontal-scale story.** No container images, no orchestration, no load balancer, no service discovery — services find each other by hardcoded `localhost:PORT` env defaults (`api-gateway/src/index.ts:133-143`). Scaling beyond one box is undefined.
2. **Shared-but-divergent database.** Service code defaults to *different* databases (`wapi`, `wapi_billing`, `wa_campaigns`, `wapi_automation`, `wapi_bsp`) yet cross-service entities (Workspace, Contact, Message, Plan) are **redefined locally in each service** (`auth-service/models/index.ts`, `campaign-service/models/Workspace.ts`, `billing-service/models/index.ts` `MinimalWorkspaceSchema`, `chat-service` Contact). Whether they collapse to one DB or shard is purely an env decision — there is no enforced ownership. This blocks independent scaling and risks schema drift. (See `database-analysis.md`.)
3. **Gateway is a single point of routing** with order-sensitive, hand-maintained rules and a per-instance rate limiter and per-request auth fan-out (B1, B5).
4. **Stateful in-process workers.** Campaign pacing and the answerbot crawl queue live inside service processes; restart loses in-flight pacing (`CampaignWorker.ts`, `automation-service/src/services/answerbot-crawl-queue.ts`).
5. **Kafka optional locally** → event backbone can silently degrade; no schema registry; topic names are string literals partly outside `@wapi/contracts`.
6. **No observability stack.** Logging is `morgan`/`console.log`/`winston` to stdout; correlation IDs are generated (`index.ts:42`) but there is no tracing, metrics, or centralized log sink committed (`@logtail` is an *optional* peer).
7. **Multichannel is scaffolding only.** `service-provider/src/channels/insta` and `/rcs` directories are **empty** — Instagram and RCS (named platform requirements) are not implemented; only WhatsApp/Gupshup exists.

---

## 13. Source-Cited Conclusions Index

| Conclusion | Primary source(s) |
|---|---|
| 12 deployables, ports, frameworks | `wapi-runner.js:6-18`, all `services/*/package.json` |
| Gateway routing & auth fan-out | `services/api-gateway/src/index.ts` |
| Kafka topic topology | `packages/contracts/src/kafka-events.ts`, grep of `.subscribe`/`send(topic)` |
| Inbound message pipeline | `webhook-ingestor/src/index.ts`, `service-provider/.../webhooks.service.ts`, `chat-service/.../kafkaService.ts` |
| Outbound send | `chat-service/src/controllers/chatController.ts`, `service-provider/.../messages.service.ts` |
| Campaign saga | `campaign-service/src/workers/CampaignWorker.ts`, `contracts/billing-events.ts` |
| RBAC (customer) | `auth-service/src/models/index.ts:76-135` |
| RBAC (admin) | `packages/contracts/src/admin.ts`, `admin-portal/src/server/auth.ts` |
| Realtime fan-out | `websocket-gateway/src/index.ts` |
| No Docker/k8s/CI | `find` sweep (negative result) |
| Divergent DB defaults | grep of `MONGO_URI` defaults across services |
| Empty insta/rcs channels | directory listing of `service-provider/src/channels/{insta,rcs}` |
