# ConnectSphere — Domain Analysis

> Reverse-engineered from the Mongoose schemas, controllers, routes, and Kafka event contracts in the repository. Bounded contexts are inferred from **which service owns the write path** and **which collections it mutates**, not from naming alone.

---

## 1. Bounded Contexts

The platform decomposes into these contexts. "Owner service" = the service that holds the authoritative write path for the context's aggregate(s).

| # | Bounded Context | Owner service | Core aggregates | Source |
|---|---|---|---|---|
| BC1 | **Identity & Access** | auth-service | User, Permission, Role, Team, WorkspaceInvitation | `auth-service/src/models/index.ts` |
| BC2 | **Tenant / Workspace** | auth-service | Workspace, Business, Plan (ref), SystemSettings, BusinessVerificationPolicy | `auth-service/src/models/index.ts:39-61,177-212,515-523` |
| BC3 | **Contacts & CRM** | contact-service | Contact, Deal, Pipeline, Task, Tag, QuickReply, ImportJob | `contact-service/src/controllers/{contactController,crmController,bulkController}.ts` |
| BC4 | **Conversations & Inbox** | chat-service | Conversation, Message, SupportTicket, Macro | `contracts/models.ts` (Message/Conversation), `chat-service/src/controllers/*` |
| BC5 | **BSP / Channel Provider** | service-provider (NestJS) | ProviderApp, ProviderMessageDispatch, ProviderWebhookEvent, ProviderTemplateMirror, ProviderToken, ProviderCredential, ProviderOnboardingSession, ProviderProfile, ProviderSubscription, ProviderHealthSnapshot, ProviderMediaAsset, ProviderTemplateRule | `service-provider/src/models/*.schema.ts` (collections `bsp_*`) |
| BC6 | **Templates** | service-provider (mirror) + campaign (snapshot) | ProviderTemplateMirror, Template, ProviderTemplateRule | `service-provider/.../provider-template-mirror.schema.ts`, `campaign-service/src/models/Template.ts` |
| BC7 | **Campaigns / Broadcast** | campaign-service | Campaign, CampaignBatch, CampaignMessage, CampaignSummary, Segment, WhatsAppAd | `campaign-service/src/models/*` |
| BC8 | **Automation / Workflow** | automation-service | AutomationRule, WorkflowExecution, AutomationExecution, AutoReply, AnswerBotSettings/Source, AiIntentMatchLog, FAQ, InstagramQuickflow, InteraktiveList, WhatsAppForm/Flow/FormResponse, Integration, WidgetConfig | `automation-service/src/models/*` |
| BC9 | **Billing & Wallet** | billing-service | Wallet, WalletTransaction, Invoice, InvoiceSequence, Subscription, Plan, RazorpayOrder | `billing-service/src/models/*` |
| BC10 | **Commerce / Catalog** | billing-service + chat-service (split) | Product, Order, CommerceSettings, CheckoutCart | `billing-service/src/models/{Product,Order,CommerceSettings}.ts`, `chat-service/src/models/{Product,CommerceSettings,CheckoutCart}.ts` |
| BC11 | **Webhook Ingestion** | webhook-ingestor + service-provider | (stateless edge) webhook_dead_letters, bsp_webhook_events | `webhook-ingestor/src/index.ts`, `service-provider/.../provider-webhook-event.schema.ts` |
| BC12 | **Realtime Delivery** | websocket-gateway | (stateless) socket rooms | `websocket-gateway/src/index.ts` |
| BC13 | **Notifications** | auth-service | Notification | `auth-service/src/models/index.ts:282-300` |
| BC14 | **Audit & Compliance** | auth-service (consumer) | AuditLog, WebhookPolicy | `auth-service/src/models/index.ts:417-472,361-415`, audit consumer `services/kafkaService.ts` |
| BC15 | **Platform Administration** | admin-portal | (no own aggregate — reads/writes others) | `apps/admin-portal/src/server/*` |
| BC16 | **Analytics** | chat-service (routes) | derived from Message/Conversation | gateway maps `/api/v1/analytics`→chat (`api-gateway/src/index.ts:341`) |

### Context map (relationship patterns)

```
                 ┌──────────────────────────────────────────────────────────┐
                 │                Identity & Access (BC1)                    │
                 │                Tenant/Workspace (BC2)  ── auth-service    │
                 └───────▲──────────────▲───────────────────▲───────────────┘
                         │ verify-session (Conformist: every service trusts
                         │ gateway-injected workspaceId/role)
   ┌─────────────────────┼──────────────────┬──────────────────┬───────────────┐
   │                     │                  │                  │               │
 Contacts/CRM       Conversations/Inbox   Campaigns         Automation       Billing
   (BC3)                (BC4)               (BC7)             (BC8)            (BC9/10)
   contact-svc        chat-svc            campaign-svc      automation-svc   billing-svc
   │  ▲                  │  ▲                │  ▲               │                ▲
   │  │ resolve(ACL)     │  │ send(ACL)      │  │ saga          │ trigger        │ saga
   │  └──────────────────┘  └───────────────┤  └───────────────┘                │
   │                                         ▼                                   │
   │                           BSP/Channel Provider (BC5/6) ── service-provider  │
   │                                    ▲     │ dispatch                         │
   │  Webhook Ingestion (BC11) ─────────┘     ▼ parsed-message-events ──▶ chat ──┘
   └─ contact-events ─▶ Realtime Delivery (BC12) ◀─ chat-realtime-sync, *-events
```

**Relationship classification (DDD patterns):**
- **Conformist:** every downstream service conforms to the auth-service's session shape (workspaceId, role, permissions) injected by the gateway. No anti-corruption layer — services read `x-workspace-id` directly (`service-provider/.../workspace-auth.guard.ts:24-30`).
- **Customer/Supplier (sync ACL):** chat→contact (`/internal/v1/contacts/resolve`), chat→BSP (`/internal/v1/bsp/messages/send`), campaign→billing/contact/BSP. The caller depends on the supplier's uptime.
- **Published Language (events):** BC4↔BC7↔BC9 communicate via Kafka payloads defined in `@connectsphere/contracts` (`billing-events.ts`, `campaign-events.ts`, `kafka-events.ts`) — the cleanest seam.
- **Shared Kernel (problematic):** Workspace, Contact, Message, Plan are **redefined** in multiple services against a shared DB rather than accessed via one owner. This is an implicit shared kernel that DDD would flag as a coupling smell (see Database doc).

---

## 2. Domain Ownership Matrix

| Aggregate | Authoritative owner | Also reads it (and how) |
|---|---|---|
| User | auth-service | admin-portal (direct read), websocket-gateway (Permission only) |
| Workspace | auth-service | campaign, billing (`MinimalWorkspaceSchema`), automation, admin-portal — all redefine a local schema |
| Permission / Role / Team | auth-service | websocket-gateway (membership check), gateway (via verify-session) |
| Plan | **ambiguous** — defined in both auth-service (`index.ts:31-37`) and billing-service (`models/index.ts` PlanModel) | admin-portal reads plans |
| Contact | contact-service | chat-service (reads for inbox), campaign worker (reads for send), websocket-gateway (reads for fan-out) |
| Conversation / Message | chat-service | websocket-gateway (reads), analytics (chat routes), campaign (status correlation) |
| ProviderApp / Dispatch / Templates | service-provider | webhooks resolve workspace by app (`webhooks.service.ts:32-50`) |
| Campaign / Batch / Segment | campaign-service | admin-portal, billing (saga) |
| Wallet / Invoice / Subscription | billing-service | campaign (pricing/reserve), admin-portal, control-plane |
| Automation rules / executions | automation-service | chat (trigger-inbound) |
| AuditLog | auth-service (writes via Kafka consumer) | admin-portal (reads) |

> **Ownership conflicts found:** (1) **Plan** is modeled in two services. (2) **Commerce** (Product/Order/CommerceSettings) is split across billing-service *and* chat-service — both define `Product` and `CommerceSettings`. (3) **Template** exists as a BSP mirror *and* a campaign-local copy *and* embedded in `Message.template`. These need a single source of truth.

---

## 3. Entity Relationships (ER overview)

```
User ──member-of──< Permission >── belongs-to ── Workspace ──has-one── Business
  │                     │                            │
  │ owns                │ role: owner|admin|         ├──< Team >── members(User)
  ▼                     │       manager|agent|viewer ├──< Role >  (custom RBAC)
Workspace               │                            ├──< WorkspaceInvitation
  │                     │                            ├── plan ── Plan
  ├──< Contact ─────────┼──< Conversation ──< Message
  │       │             │        │                │ template ▷ Template / ProviderTemplateMirror
  │       │ tags[]      │        │ assignedTo ▷ User
  │       ├──< Deal     │        │ team ▷ Team
  │       ├── activeDeal│        │ campaign ▷ Campaign
  │       └── optOut    │        └── status: open|pending|resolved|closed|snoozed|spam
  │                     │
  ├──< Campaign ──< CampaignBatch ──< CampaignMessage ▷ Contact
  │       └── recipientFilter ▷ Segment
  │
  ├──< Wallet ──< WalletTransaction ;  Subscription ;  Invoice
  │
  ├──< AutomationRule ──< AutomationExecution ;  WorkflowExecution
  │       AutoReply ; AnswerBotSettings ; FAQ ; WhatsAppForm ──< WhatsAppFormResponse
  │
  └──< ProviderApp (BSP) ──< ProviderMessageDispatch ; ProviderWebhookEvent ;
            ProviderToken ; ProviderCredential ; ProviderSubscription ; ProviderProfile
  BusinessAppMap: Business ──1:1(active)── GupshupApp  (auth-service:474-499)
```

Key relationship facts from schemas:
- **Contact** is workspace-scoped, phone is required, carries `optOut`, `leadStatus`, `assignedAgentId`, CRM pointers (`activeDealId`, `activePipelineId`) (`contracts/models.ts:69-100`).
- **Conversation** is the messaging-window aggregate: tracks `windowExpiresAt`, `isBillable`, `conversationType` (customer/business initiated), per-agent unread counts, SLA fields (`firstResponseAt`), bot metadata (`contracts/models.ts:147-186`).
- **Message** carries embedded `template`, `media`, and `campaign` sub-docs and a `unique sparse messageId` for idempotent provider correlation (`contracts/models.ts:104-145`).
- **ProviderApp** binds a workspace to a Gupshup app/phone; webhooks resolve `workspaceId` by matching `appId`/`phoneNumberId` against it (`webhooks.service.ts:32-50`).
- **BusinessAppMap** enforces 1 active app per business via partial unique indexes (`auth-service/models/index.ts:486-497`).

---

## 4. Aggregates (consistency boundaries)

| Aggregate root | Invariants enforced in code | Where |
|---|---|---|
| **Workspace** | owner set on creation; plan ref; verification policy gate | `account-service.ts`, `business-verification-*` |
| **Permission** | role → default permission map; one per (workspace,user) | `auth-service/models/index.ts:76-146` |
| **Conversation** | status state machine `open→pending→resolved→closed→snoozed→spam`; window/billable flags; unread counters | `contracts/models.ts:147-186`, snooze worker `chat-service/.../snooze-worker.ts` |
| **Message** | unique provider id; status ladder `queued→sending→sent→delivered→read→failed`; `updateStatus()` method | `contracts/models.ts:104-145`, `chat-service/.../kafkaService.ts:97` |
| **Campaign** | execution status machine; `totals` counters; audit entries; budget saga | `campaign-service/src/models/Campaign.ts`, `CampaignWorker.ts:63,214-219` |
| **Wallet** | ledger transactions, budget reserve/settle | `billing-service/src/services/LedgerService.ts`, `UsageTracker.ts` |
| **ProviderApp + Dispatch** | one dispatch per send; idempotencyKey carried; status from webhook | `messages.service.ts`, `provider-message-dispatch.schema.ts` |

**Cross-aggregate consistency is eventual**, mediated by Kafka + the billing saga. The campaign→budget flow is the only explicit **saga** (compensation: `BudgetReservationFailedEvent` pauses the campaign — `CampaignWorker.ts:60-76`).

---

## 5. Domain Events (catalog)

From `packages/contracts/src/kafka-events.ts`, `billing-events.ts`, `campaign-events.ts`, `socket-events.ts`, plus observed producers:

### Integration events (Kafka)
| Event / payload | Topic | Producer → Consumer | Source |
|---|---|---|---|
| `RawWebhookEvent` | `raw-webhook-events` | webhook-ingestor, channel.service → service-provider consumer | `webhook-ingestor:199`, `channel.service.ts:97`, `provider-kafka-consumer.service.ts:32` |
| `ParsedMessageEvent` (inbound + `status_update`) | `parsed-message-events` | service-provider webhooks → chat-service | `webhooks.service.ts:105,137` → `chat/kafkaService.ts:25` |
| `ChatRealtimeSyncEvent` (`message_created`, `message_status_updated`, `conversation_status_changed`) | `chat-realtime-sync` | chat-service → websocket-gateway, billing-service | `chat/kafkaService.ts:115,230` → `websocket-gateway:289`, `billing/EventBus.ts:109` |
| `BillingEventPayload` (`plan_purchased`,`order_paid`,`wallet_recharged`,`funds_deducted`,`budget_reserved`,`budget_settled`) | `billing-events` | billing-service → websocket-gateway | `billing/EventBus.ts`, `websocket-gateway:266-270` |
| `CampaignEvent` (`batch.ready`,`message.dispatched`,`status.changed`) + saga `MessageStatusUpdateEvent` | `campaign-events` | chat-service (status), campaign-service → campaign EventBus, websocket | `chat/kafkaService.ts:135`, `campaign/EventBus.ts:240` |
| `ContactEventPayload` (`contact_created/updated/deleted/imported`, `tag_*`, `quick_reply_*`) | `contact-events` | contact-service → websocket-gateway | `contact/services/eventBus.ts`, `websocket:260-262` |
| `AutomationEvent` (`message_received`,`status_changed`,`form_submitted`) | `automation-events` | automation-service → websocket-gateway | `kafka-events.ts:66`, `websocket:263-265` |
| `AuditEventPayload` (USER_*, PLAN_*, WORKSPACE_DELETE, SETTINGS_UPDATE, …) | `audit-events` | admin/auth actions → auth-service consumer (persists AuditLog) | `kafka-events.ts:99-138`, `auth/kafkaService.ts:112` |

### Billing saga events (BullMQ queue, not Kafka)
`CampaignCreatedEvent → BudgetReservedEvent | BudgetReservationFailedEvent → CampaignCompletedEvent`, plus `MessageStatusUpdateEvent`. (`packages/contracts/src/billing-events.ts`; queued via `billingEventsQueue.add(...)` in `CampaignWorker.ts:117,239`.)

### Realtime (socket.io) events
`workspace:*` (wallet_update, notification, campaign:*, inbox:*, agent:online/offline) and `conversation:*` (typing, user-joined/left). (`packages/contracts/src/socket-events.ts`.)

**Event-design observations:**
- Events are **JSON, schemaless on the wire** — no Avro/Protobuf/schema-registry. `@connectsphere/contracts` is the only enforcement and it is compile-time only, not validated at consume time.
- Several declared topics are **not fully wired**: `CAMPAIGN_LEDGER_OPS`, `CAMPAIGN_BUDGET_RESERVED` (declared in `kafka-events.ts:10-11`, no observed producer/consumer).
- The **status-update event crosses three contexts** (BSP→chat→campaign) and is re-shaped at each hop, which is why `websocket-gateway` tolerates multiple field names (`providerMessageId || messageId`, `index.ts:228`).

---

## 6. Ubiquitous Language (extracted terms)

| Term | Meaning in this codebase |
|---|---|
| Workspace | the tenant boundary; everything is workspace-scoped |
| Business | KYC/verification entity attached 1:1 to a workspace |
| BSP / Provider | Business Solution Provider (only Gupshup implemented) |
| App / ProviderApp | a connected WhatsApp number/app under a BSP |
| Dispatch | one outbound provider send record |
| Conversation window / billable | the 24h WhatsApp session that drives pricing |
| Budget reservation / settlement | campaign saga reserving wallet funds before send, settling on actuals |
| Template mirror | local copy of a Meta-approved template synced from the BSP |
| Impersonation | super-admin acting as a workspace (`x-impersonating` header) |
| Cold contact | a contact with no prior inbound (`isColdContact`) |

---

## 7. Domain-Level Findings

1. **Auth-service is overloaded across BC1, BC2, BC13, BC14** — four bounded contexts in one deploy unit. A clean decomposition would split Identity, Tenant, Notification, and Audit.
2. **No single Template authority** (BC6 spread across 3 representations) → drift between what Meta approved, what campaigns snapshot, and what messages embed.
3. **Commerce is split** between billing and chat — needs one owner.
4. **Plan is double-modeled** — pick billing-service as owner (it prices) and have auth reference by id only.
5. **The cleanest contexts** are BSP (BC5), Campaign (BC7), and Realtime (BC12) — well-bounded, event-driven, single-writer. These are the model to replicate.
6. **Instagram & RCS contexts do not exist yet** — empty `channels/insta`, `channels/rcs`. The `ParsedMessageEvent`/`ProviderApp` abstractions are *channel-agnostic enough* to extend, which is a good foundation for the omnichannel target.
