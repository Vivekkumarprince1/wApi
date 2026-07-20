# ConnectSphere — Microservice Design (Target)

> Each service below maps to existing code where it already exists (cited) and notes what is **new** or **extracted**. APIs use the current `/api/v1` convention from `api-gateway/src/index.ts`. Events use the target envelope from future-state §6. "DB ownership" = the only service allowed to **write** those collections.

**Legend:** 🟢 exists today · 🟡 extract/split from existing · 🔵 new

---

## 0. Service Catalog at a Glance

| Service | State | Origin | Owns (write) |
|---|---|---|---|
| API Gateway | 🟢 | `api-gateway` | — (stateless) |
| Auth Service | 🟡 | split from `auth-service` | sessions, credentials, JWKS |
| Tenant Service | 🟡 | split from `auth-service` | workspaces, plans-ref, policies, business |
| User Service | 🟡 | split from `auth-service` | users, permissions, roles, teams, invitations |
| Core/Conversation Service | 🟢 | `chat-service` | conversations, messages, ledger, tickets, macros |
| Contact Service | 🟢 | `contact-service` | contacts, deals, pipelines, tasks, tags, quick-replies, imports |
| Campaign Service | 🟢 | `campaign-service` | campaigns, batches, campaign-messages, segments |
| Conversation/Inbox | (folded into Core) | — | — |
| Automation Service | 🟢 | `automation-service` | rules, executions, autoreply, answerbot, forms |
| Channel/BSP Service | 🟢→🟡 | `service-provider` | bsp_* (apps, dispatch, tokens, templates, webhooks) |
| Webhook Service | 🟢 | `webhook-ingestor` | webhook_dead_letters |
| Analytics Service | 🔵 | new | rollups, warehouse feeds |
| Billing Service | 🟢 | `billing-service` | wallets, transactions, invoices, subscriptions, plans, orders |
| Notification Service | 🟡 | split from `auth-service` | notifications |
| File Service | 🔵 | new (from scattered Cloudinary) | media assets metadata |
| Audit Service | 🟡 | split from `auth-service` | auditlogs, webhook policy |

---

## 1. API Gateway 🟢

- **Responsibility:** single ingress; routing; edge auth (stateless JWT/JWKS verify + Redis denylist); edge rate-limiting; correlation-id; header sanitization.
- **APIs:** proxy table in `api-gateway/src/index.ts` remains the source of truth for supported service routes.
- **Events:** none (stateless).
- **DB ownership:** none.
- **Dependencies:** Auth (JWKS, cached), Redis (denylist + shared rate-limit).
- **Scaling:** stateless, HPA on RPS; move rate-limit store to Redis (today in-memory `rateLimit.ts:19`). **Change:** drop per-request HTTP to auth (current `index.ts:76`) in favor of local JWKS verify.

## 2. Auth Service 🟡 (extracted)

- **Responsibility:** login (password/OTP/Google), token issuance, **JWKS** publication, session denylist, password reset. (Today in `auth-service/src/controllers/authController.ts`.)
- **APIs:** `POST /api/v1/auth/{login,signup,verify-otp,logout,reset}`, `GET /.well-known/jwks.json`, `POST /internal/v1/auth/verify-session` (kept for transition).
- **Events:** produces `audit-events` (auth actions).
- **DB ownership:** `sessions`/denylist (Redis), `credentials`, OTP collections.
- **Dependencies:** User Service (profile), Notification (OTP delivery), Redis.
- **Scaling:** stateless behind HPA; JWKS cached at gateway → auth off the hot path.

## 3. Tenant Service 🟡

- **Responsibility:** workspaces, plan assignment (ref to Billing's Plan), business/KYC verification, system settings, verification policy, BSP-app↔business mapping. (Today: `auth-service/models` Workspace/Business/SystemSettings/BusinessAppMap/BusinessVerificationPolicy.)
- **APIs:** `/api/v1/workspace/*` (settings, members-link), `/api/v1/business/*`, `/api/v1/onboarding/*` (delegates channel onboarding to Channel Svc).
- **Events:** `tenant.created/updated`, `plan.changed`; consumes `billing-events` for plan/limit sync.
- **DB ownership:** `workspaces`, `businesses`, `systemsettings`, `businessappmaps`, `businessverificationpolicies`.
- **Dependencies:** Billing (plan/limits), Channel (onboarding), Audit.
- **Scaling:** read-heavy; cache workspace/plan in Redis; **single writer** ends today's local `Workspace` redefinitions.

## 4. User Service 🟡

- **Responsibility:** user profiles, RBAC (`Permission` + `Role`), teams, invitations, membership checks. (Today: `auth-service/models` User/Permission/Role/Team/WorkspaceInvitation; default permission maps `index.ts:76-135`.)
- **APIs:** `/api/v1/settings/team`, `/workspace/members`, `/auth/accept-invite`, `/users/*`.
- **Events:** `user.invited/joined/removed`, `role.updated` → `audit-events`.
- **DB ownership:** `users`, `permissions`, `roles`, `teams`, `workspaceinvitations`.
- **Dependencies:** Tenant (workspace existence), Notification, Auth (credential link).
- **Scaling:** membership lookups cached in Redis (websocket-gateway already needs these — `websocket-gateway/src/index.ts:47-60`).

## 5. Core / Conversation Service 🟢 (`chat-service`)

- **Responsibility:** inbound persist, conversation window/status state machine, message timeline, inbox assignment, SLA fields, internal notes, support tickets, macros, snooze. (Today `chat-service`.)
- **APIs:** `/api/v1/inbox/*`, `/conversations/*`, `/support/*`, `POST /internal/v1/inbox/conversations/:id/messages`.
- **Events:** consumes `parsed-message-events`; produces `chat-realtime-sync`, `automation-events`, `analytics-stream`, `campaign-events` (status); **enqueues `outbound-requested`** (new — replaces sync BSP call at `chatController.ts:441`).
- **DB ownership:** `conversations`, `messages`, `conversationledgers`, `supporttickets`, `macros`.
- **Dependencies:** Contact (resolve), Dispatch Worker (send), Automation (trigger), WS Gateway (via Kafka).
- **Scaling:** consumer scales by partition; HPA on Kafka lag; **remove sync send** for burst tolerance.

## 6. Contact Service 🟢

- **Responsibility:** contacts, opt-out, CRM (deals/pipelines/tasks), tags, quick-replies, bulk import; contact source-of-truth. (Today `contact-service`.)
- **APIs:** `/api/v1/contacts/*`, `/crm/*`, `/bulk/*`, `/workspace/{tags,quick-replies}`, `POST /internal/v1/contacts/resolve` (hot path).
- **Events:** produces `contact-events`; consumes `parsed-message-events` (last-inbound timestamps).
- **DB ownership:** `contacts`, `deals`, `pipelines`, `tasks`, `tags`, `quickreplies`, `importjobs`, `contactevents`.
- **Dependencies:** none upstream; called by Core, Campaign.
- **Scaling:** add `(workspace,phone)` unique index (database §6); cache resolve; expose **bulk contact fetch** for campaigns (fixes N+1 at `CampaignWorker.ts:153`).

## 7. Campaign Service 🟢

- **Responsibility:** campaign CRUD, segments, scheduling, batch execution, budget saga with Billing, WhatsApp ads. (Today `campaign-service` + `CampaignWorker`.)
- **APIs:** `/api/v1/campaign/*`, `/ads/*`, `/segments/*`.
- **Events:** BullMQ `campaign-engine`; saga `CampaignCreatedEvent/BudgetReservedEvent/CampaignCompletedEvent` (`contracts/billing-events.ts`); consumes `campaign-events` (status totals).
- **DB ownership:** `campaigns`, `campaignbatches`, `campaignmessages`, `campaignsummaries`, `segments`, `whatsappads`.
- **Dependencies:** Billing (reserve/settle), Contact (recipients), Dispatch (send), Channel (templates).
- **Scaling:** worker HPA on queue depth; **distributed token-bucket rate-limit** in Redis (replace in-process `setTimeout` pacing at `CampaignWorker.ts:207`); bulk recipient reads.

## 8. Automation Service 🟢

- **Responsibility:** workflow engine, auto-replies, answerbot (web-crawl KB), AI-intent matching, FAQ, WhatsApp forms/flows, interactive lists, integrations (Google Sheets/Petpooja), widget, API keys. (Today `automation-service`.)
- **APIs:** `/api/v1/automation/*`, `/flows`, `/widget`, `/developer`, `/integrations`, `/settings/api-keys`; `POST /api/automation/engine/trigger-inbound` (from Core).
- **Events:** consumes `automation-events`; produces outbound auto-replies via `outbound-requested`.
- **DB ownership:** all `automation*`, `autoreply*`, `answerbot*`, `whatsappform*`, `instagram*`, `integrations`, `widgetconfigs`, `aiintentmatchlogs`.
- **Dependencies:** Core (context), Dispatch (replies), Contact (variables), Channel (form/flow send).
- **Scaling:** stateless engine + BullMQ crawl workers; **fix the broken `dev` script** (`automation-service/package.json` `"dev":"src/index.ts"`) and port mismatch (3001 vs 3005, current-state §1).

## 9. Channel / BSP Service 🟢→🟡 (`service-provider`)

- **Responsibility:** WhatsApp/Gupshup adapters, app onboarding lifecycle, token/credential vault (AES-GCM `secret-box.ts`), template mirror+rules, message dispatch record, webhook normalization, provider health. (Today `service-provider`.)
- **APIs:** `/provider/v1/workspace/*` (waba/profile/webhooks/phones), `/provider/v1/onboarding/*`, `/api/v1/templates`, `POST /internal/v1/bsp/messages/send`.
- **Events:** consumes `raw-channel-events`; produces `parsed-message-events`. (Remove direct-controller produce to end double ingress — message-flow §2b.)
- **DB ownership:** all `bsp_*` collections.
- **Dependencies:** Tenant (workspace↔app), File (media), providers (Gupshup/Meta/RBM).
- **Scaling:** adapter pool per channel; per-provider circuit breakers; consumer HPA on lag.

## 10. Dispatch Worker 🔵 (extracted from Core/Campaign sync sends)

- **Responsibility:** the **only** outbound sender. Consumes `outbound-requested`, applies per-workspace rate-limit + idempotency + retry/backoff, calls Channel Svc, records dispatch, emits status. (Replaces sync `POST /internal/v1/bsp/messages/send` calls in `chat-service` and the campaign worker's inline send.)
- **APIs:** none public (queue consumer).
- **Events:** consumes `outbound-requested`; produces `message-dispatched`, `message-status`.
- **DB ownership:** none (Channel owns dispatch record) — or co-owns `bsp_message_dispatches`.
- **Dependencies:** Channel, Billing (usage check), Redis (rate-limit/idempotency).
- **Scaling:** HPA on queue depth; concurrency tuned per provider TPS; backpressure protects providers.

## 11. Webhook Service 🟢 (`webhook-ingestor`)

- **Responsibility:** single inbound webhook edge; HMAC verify; instant-200; produce `raw-channel-events`; dead-letter + replay. (Today `webhook-ingestor`.)
- **APIs:** `POST /webhooks/:provider`, `GET /webhooks` (verify-token handshake), `POST /internal/v1/webhooks/replay`.
- **Events:** produces `raw-channel-events`.
- **DB ownership:** `webhook_dead_letters`.
- **Dependencies:** Kafka; Channel (downstream).
- **Scaling:** stateless Fastify, HPA on RPS; the most spiky surface — keep it thin (it already is).

## 12. Analytics Service 🔵

- **Responsibility:** consume event streams → rollups + warehouse; serve dashboards/metrics (today computed live off OLTP in chat — `supportController.ts`, `control-plane-service.ts`).
- **APIs:** `/api/v1/analytics/*`, `/api/v1/metrics/*` (moved off chat-service).
- **Events:** consumes `analytics-stream`, `message-status`, `campaign-events`, `billing-events`.
- **DB ownership:** rollup collections + warehouse tables (read-only mirror of others).
- **Dependencies:** Kafka, warehouse.
- **Scaling:** consumer + query layer scale independently; OLAP isolated from OLTP.

## 13. Billing Service 🟢

- **Responsibility:** wallet/ledger, budget reserve/settle saga, invoices, subscriptions, plans (**single Plan owner** — resolve the auth/billing duplication), Razorpay, commerce (consolidate the chat/billing split). (Today `billing-service`.)
- **APIs:** `/api/v1/billing/*`, `/workspace/billing`, `/pricing`, `/commerce/*`, `/api/webhooks/razorpay`, `/api/billing/wallets/admin/stats`.
- **Events:** produces `billing-events`; consumes campaign saga events; consumes `message-status`/`chat-realtime-sync` for usage.
- **DB ownership:** `wallets`, `wallettransactions`, `invoices`, `subscriptions`, `plans`, `razorpayorders`, `orders`, commerce.
- **Dependencies:** Tenant (plan limits), Campaign (saga), Razorpay.
- **Scaling:** ledger writes need consistency — keep single-writer; HPA on API; saga via durable BullMQ.

## 14. Notification Service 🟡

- **Responsibility:** in-app notifications and transactional authentication email. (Today `auth-service` Notification + MailService.)
- **APIs:** `/api/v1/notifications/*`, `/internal/v1/notify`.
- **Events:** consumes `user.*`, `billing-events`, `campaign-events` to generate notifications.
- **DB ownership:** `notifications`.
- **Dependencies:** SMTP/Twilio; WS Gateway (push).
- **Scaling:** queue-backed senders; provider failover.

## 15. File Service 🔵

- **Responsibility:** media upload, virus/type scan, CDN (Cloudinary today in `service-provider/src/common/cloudinary.ts`), signed URLs, retention.
- **APIs:** `/api/v1/files/*`, `/api/v1/upload`.
- **Events:** `file.uploaded`.
- **DB ownership:** media asset metadata.
- **Dependencies:** Cloudinary/object storage.
- **Scaling:** stateless; offload to CDN; scan async.

## 16. Audit Service 🟡

- **Responsibility:** consume `audit-events` → immutable `auditlogs` (WORM export before TTL); webhook policy. (Today auth-service consumer `services/kafkaService.ts:112` + `AuditLog` model + WebhookPolicy.)
- **APIs:** `/api/v1/audit-logs` (read), admin-only.
- **Events:** consumes `audit-events`.
- **DB ownership:** `auditlogs`, `webhookpolicies`.
- **Dependencies:** Kafka, object storage (WORM).
- **Scaling:** consumer HPA; append-only.

---

## 17. Cross-Cutting Standards

| Concern | Standard |
|---|---|
| Auth | Stateless JWT verified via JWKS at gateway; services trust signed context headers gated by mTLS (mesh) — replaces shared `x-internal-service-secret` literal |
| Tenancy | Framework guard refuses un-`workspace`-scoped queries on tenant collections |
| Events | Versioned envelope, schema-registry validated, `workspaceId` partition key, per-topic DLQ + drain consumer |
| Idempotency | `idempotencyKey` mandatory on `outbound-requested` and provider sends (`contracts/bsp.ts:90` make required) |
| Resilience | Circuit breakers on provider calls; retries with backoff; bulkheads per provider |
| Config | Secrets from Key Vault; fail-fast on missing; no hardcoded fallbacks |
| Observability | OTel traces/metrics/logs with `correlationId`+`workspaceId`; consumer-lag + DLQ-depth SLOs |
| Contracts | `@connectsphere/contracts` remains the single type source; gateway/ingestor/ws-gateway must depend on it (today they don't — current-state §3) |

---

## 18. Service Dependency Matrix (sync calls / event subscriptions)

| Caller ↓ / Callee → | Auth | Tenant | User | Core | Contact | Camp | Auto | Channel | Dispatch | Billing | Notif | File | Analytics | Audit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gateway | JWKS | | | | | | | | | | | | | |
| Core | | | mem✓ | — | resolve | | trig(ev) | | enqueue | usage(ev) | | media | stream(ev) | |
| Campaign | | plan | | | bulk | — | | tmpl | enqueue | saga | | | (ev) | |
| Automation | | | | ctx | vars | | — | form | enqueue | | | | | |
| Channel | | app | | | | | | — | | | | media | | |
| Dispatch | | | | | | | | send | — | usage | | | | |
| Billing | | plan(ev) | | usage(ev) | | saga(ev) | | | | — | | | | |
| Admin Portal | | read | read | read | read | read | read | read | | read | | | read | read |

(✓mem = membership cache; ev = event-driven; "—" = self)
