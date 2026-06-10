# wApi — Database Analysis

> Derived from Mongoose schemas across all services, the native-driver usage in webhook-ingestor, and the multi-DB admin-portal connector. All indexes cited are the ones **declared in code** (`schema.index(...)` or `index:true`). Indexes that *should* exist but do not are listed in §5.

---

## 1. Storage Topology (the central finding)

wApi uses **MongoDB** (Mongoose 8 across services; native `mongodb` driver in webhook-ingestor — `webhook-ingestor/src/index.ts:5`) and **Redis** (ioredis; BullMQ queues; socket.io redis-adapter).

The MongoDB topology is **inconsistent between code defaults**:

| Service | Default DB in code | Source |
|---|---|---|
| auth, chat, contact, websocket-gateway, ingestor | `wapi` | `chat-service/src/config/db.ts:28`, `webhook-ingestor:19`, etc. |
| billing-service | `wapi_billing` | `billing-service/src/config/index.ts:17` |
| campaign-service | `wa_campaigns` | `campaign-service/src/config.ts` |
| automation-service | `wapi_automation` | `automation-service/src/config.ts` |
| service-provider | `wapi_bsp` | `service-provider/src/config.ts:17` |
| admin-portal | expects **4** URIs: `MONGODB_URI` (core), `_BILLING`, `_CAMPAIGN`, `_AUTOMATION` | `apps/admin-portal/src/server/db.ts:14-21` |

> **Implication.** In code, the platform *looks* database-per-service. But every `MONGO_URI`/`MONGODB_URI` is env-overridable, so in a real deployment all services can be (and per the memory notes, in the `test`/`wapi` DB **are**) pointed at one shared database. The admin-portal hardcodes a 4-DB assumption. This is an **unresolved data-ownership decision** — the system is neither cleanly database-per-service nor cleanly shared-DB. The biggest consequence: **cross-service entities are redefined locally in every service** (next section).

### Redefined (shared-kernel) collections

The same logical collection is modeled independently by multiple services:

| Collection | Defined in | Risk |
|---|---|---|
| `workspaces` | auth (full), campaign (`Workspace.ts`), billing (`MinimalWorkspaceSchema`), automation (`Workspace.ts`), websocket (Permission ref) | Schema drift; no owner enforces shape |
| `contacts` | contact-service (authoritative, `IContactDocument`), chat-service (reads), websocket (reads), `contracts/models.ts` ContactSchema | Three definitions of the same doc |
| `messages` | chat-service / `contracts/models.ts` | Read by control-plane via raw `db.collection('messages')` (`control-plane-service.ts:54`) |
| `plans` | auth-service **and** billing-service | Double ownership |
| `products`,`commercesettings` | billing-service **and** chat-service | Split commerce |

---

## 2. Collection Inventory (by owning service)

### auth-service (`core` / `wapi`) — `auth-service/src/models/index.ts`
`users`, `plans`, `workspaces`, `permissions`, `systemsettings`, `otps`, `businesses`, `workspaceinvitations`, `teams`, `roles`, `notifications`, `otpchallenges`, `signupotps`, `webhookpolicies`, `auditlogs`, `businessappmaps`, `bsphealths`, `businessverificationpolicies`.

### contact-service (`wapi`) — `contact-service/src/models/index.ts`
`contacts`, `tags`, `quickreplies`, `formsubmissions`, `pipelines`, `deals`, `tasks`, `importjobs`, `contactevents`.

### chat-service (`wapi`) — `chat-service/src/models/index.ts` + `contracts/models.ts`
`conversations`, `messages`, `conversationledgers`, `supporttickets`, `macros`, `checkoutcarts`, `products`, `commercesettings`.

### campaign-service (`wa_campaigns`) — `campaign-service/src/models/*`
`campaigns`, `campaignbatches`, `campaignmessages`, `campaignsummaries`, `segments`, `templates`, `whatsappads`, `workspaces`(local).

### billing-service (`wapi_billing`) — `billing-service/src/models/*`
`wallets`, `wallettransactions`, `invoices`, `invoicesequences`, `subscriptions`, `plans`, `razorpayorders`, `products`, `orders`, `commercesettings`, `workspaces`(minimal).

### automation-service (`wapi_automation`) — `automation-service/src/models/*`
`automationrules`, `automationexecutions`, `workflowexecutions`, `autoreplies`, `autoreplylogs`, `automationauditlogs`, `answerbotsettings`, `answerbotsources`, `aiintentmatchlogs`, `faqs`, `instagramquickflows`, `instagramquickflowlogs`, `interaktivelists`, `whatsappforms`, `whatsappflows`, `whatsappformresponses`, `integrations`, `widgetconfigs`, `workspaces`(local).

### service-provider (`wapi_bsp`) — `service-provider/src/models/*.schema.ts` (explicit `collection:` names)
`bsp_providers`, `bsp_apps`, `bsp_credentials`, `bsp_tokens`, `bsp_subscriptions`, `bsp_profiles`, `bsp_onboarding_sessions`, `bsp_webhook_events`, `bsp_health_snapshots`, `bsp_media_assets`, `bsp_template_mirrors`, `bsp_template_rules`, `bsp_message_dispatches`.

### webhook-ingestor (native driver)
`webhook_dead_letters` (only) — `webhook-ingestor/src/index.ts:20`.

---

## 3. ER Diagrams

### 3a. Messaging core (chat-service)
```
Workspace 1───* Conversation 1───* Message
                   │                   │
                   * Contact           ├─ template{ id→Template, name, category, language, variables }
                   │                   ├─ media{ id, url, mimeType, filename, caption }
                   * assignedTo→User   └─ campaign{ id→Campaign, name, batchId }
                   * team→Team
ConversationLedger *───1 Conversation   (billing window record: category, billable, expiresAt, billingPeriod)
```
Unique key: `Conversation (workspace, contact)` — one conversation per contact per workspace (`contracts/models.ts:163`). `Message.messageId` unique+sparse for provider idempotency (`models.ts:298`).

### 3b. Identity / Tenant (auth-service)
```
User *───* Workspace  (via Permission: role + permissions JSON)
User 1───* Workspace (owner)
Workspace 1───1 Business ;  Workspace *───1 Plan
Workspace 1───* Team (members: User[]) ;  Workspace 1───* Role (custom) ;  Workspace 1───* WorkspaceInvitation
Business 1───1 GupshupApp  (via BusinessAppMap, active-unique)
```

### 3c. Campaign (campaign-service)
```
Campaign 1───* CampaignBatch 1───* CampaignMessage *───1 Contact
Campaign *───1 Segment (recipientFilter) ;  Campaign *───1 Template (snapshot embedded)
CampaignSummary  (per workspace per day, unique)
```
Unique keys: `CampaignBatch(campaign,batchIndex)`, `CampaignMessage(campaign,contact)`, `CampaignSummary(workspace,date)`.

### 3d. Billing (billing-service)
```
Workspace 1───1 Wallet 1───* WalletTransaction
Workspace 1───1 Subscription *───1 Plan
Workspace 1───* Invoice (number via InvoiceSequence) ;  RazorpayOrder
Workspace 1───* Order *───1 Product  (commerce)
```
Unique keys: `Wallet.workspaceId`, `Order.orderNumber`, `Invoice.invoiceNumber` (sparse), `InvoiceSequence.prefix`, `Plan.slug`, `RazorpayOrder.orderId`.

### 3e. BSP (service-provider)
```
ProviderApp(bsp_apps) 1───* ProviderMessageDispatch ;  1───* ProviderWebhookEvent
ProviderApp *───1 ProviderToken / ProviderCredential (encrypted) ;  ProviderProfile ; ProviderSubscription
ProviderTemplateMirror (synced from Meta) ;  ProviderTemplateRule ;  ProviderHealthSnapshot ;  ProviderMediaAsset
```

---

## 4. Declared Indexes (complete, cited)

| Collection | Index | Source |
|---|---|---|
| conversations | `(workspace,contact)` **unique** | `contracts/models.ts:163` |
| conversations | `(workspace,status,lastActivityAt-1)`, `(workspace,assignedTo,status)`, `(workspace,assignedTo,lastMessageAt-1)`, `(workspace,team,status)`, `(workspace,priority,lastActivityAt-1)`, `(workspace,lastActivityAt-1)`, `(workspace,conversationStartedAt,isBillable)` | `models.ts:164-171` |
| conversations | partial `(workspace,assignedTo,status,lastActivityAt-1)` where `assignedTo:null` (unassigned queue) | `models.ts:168` |
| messages | `messageId` **unique sparse**; `whatsappMessageId`; `(conversation,sentAt)`; `(workspace,'campaign.id')`; plus single-field indexes on workspace/conversation/contact/direction/type/status/isInternalNote | `models.ts:298-333` |
| contacts | workspace index; (others minimal) | `contact-service/models/index.ts:47` |
| tags | `(workspace,normalizedName)` **unique**, `(workspace,createdAt-1)`, `(workspace,'usageCount.total'-1)` | `contact-service/models/index.ts:111` / chat copy `442-444` |
| quickreplies | `(workspace,name,scope,owner)` **unique**, `(workspace,scope,owner)`, `(workspace,shortcut)` | `136-137` / `525-527` |
| pipelines | `(workspace,name)` **unique**, `(workspace,isDefault)` | `168-169` |
| deals | `(workspace,contact)`, `(workspace,stage)`, `(workspace,status)`, `(pipeline,stage)` | `229-232` |
| tasks | `(workspace,assignee)`, `(workspace,status)`, `(workspace,dueDate)`, `relatedDeal`, `relatedContact` | `273-277` |
| importjobs | `jobId` **unique**, workspace | `283-284` |
| contactevents | `(workspace,contact,createdAt-1)` | `558` |
| conversationledgers | `(workspace,contact,category,isActive,expiresAt)`, `(workspace,billingPeriod,category,billable)`, `(workspace,startedAt,category)` | `chat-service/models/index.ts:651-653` |
| checkoutcarts | `(workspaceId,contactId)` **unique**, `(workspaceId,state,lastInteractionAt-1)` | `chat/CheckoutCart.ts:149-150` |
| campaigns | `(workspace,status)`, `(workspace,createdAt-1)`, `(workspace,scheduledAt,status)`, `(status,scheduledAt)` | `campaign/models` |
| campaignbatches | `(campaign,batchIndex)` **unique**, `(campaign,status)` | |
| campaignmessages | `(campaign,contact)` **unique**, `(campaign,status)`, `whatsappMessageId` sparse, `(workspace,createdAt-1)` | |
| campaignsummaries | `(workspace,date)` **unique** | |
| wallets | `workspaceId` **unique** | `billing/models` |
| orders | `orderNumber` **unique**, `(workspaceId,status,createdAt-1)`, `(workspaceId,contactId,createdAt-1)` | |
| invoices/sequences/plans/razorpayorders | `invoiceNumber` unique sparse, `prefix` unique, `slug` unique, `orderId` unique | |
| **TTL indexes** | otps/otpchallenges/signupotps (`expireAfterSeconds:0` on expiresAt); notifications (30d); auditlogs (90d) | `auth/models/index.ts:173,313,337,298,432` |
| businessappmaps | partial-unique on `(business,active)`, `(app,active)`, `(gupshupAppId,active)` where `active:true` | `auth/models:486-497` |
| webhookpolicies | partial-unique per scope (global/workspace/app) | `auth/models:408-413` |
| webhook_dead_letters | `eventId` unique, `(status,createdAt)` | `webhook-ingestor:31-32` |

---

## 5. Query Patterns & Bottlenecks

### Observed query patterns
- **Inbox list:** filter by `workspace`, `status`, `assignedTo`/`team`, sort by `lastActivityAt`/`lastMessageAt`. Well-covered by the compound conversation indexes (`models.ts:164-170`). ✅
- **Message timeline:** `(conversation,sentAt)` covered (`models.ts:332`). ✅
- **Status update by provider id:** `Message.findOne({workspace, messageId})` — covered by unique `messageId` (`chat/kafkaService.ts:91`). ✅
- **Contact resolve on inbound:** contact-service `/resolve` by `(workspace,phone)`. ⚠️ **No `(workspace,phone)` unique/compound index declared on contacts** — this is on the hottest inbound path and likely does a non-indexed scan or relies on the single-field workspace index only.
- **Campaign batch send:** worker reads contacts one-by-one via HTTP (`CampaignWorker.ts:153`) — N round-trips, not a bulk query. ⚠️
- **Super-admin snapshot:** `Workspace.aggregate` plan distribution + raw `messages.countDocuments({createdAt≥30d})` (`control-plane-service.ts:54-83`). ⚠️ The 30-day message count has **no `createdAt` index** declared → full collection scan that grows linearly with all messages ever sent. This will be the first query to fall over at scale.

### Bottleneck table

| # | Query / pattern | Problem | Fix (see §6/§7) |
|---|---|---|---|
| Q1 | `contacts` lookup by `(workspace, phone)` | No compound index ⇒ scan on inbound hot path | Add `(workspace,phone)` **unique** index |
| Q2 | `messages.countDocuments({createdAt≥30d})` for admin dashboard | No `createdAt` index; scans entire (largest) collection | Add `(createdAt)` or precomputed daily rollups |
| Q3 | websocket fan-out does `conversations.findOne` + `contacts.findOne` per `message_created` | DB hit per realtime event | Embed contact summary in the sync payload (already partially done in chat — `kafkaService.ts:223`); make websocket trust it |
| Q4 | campaign send fetches contacts via HTTP per recipient | Network N+1 | Batch contact fetch; or replicate read model |
| Q5 | `messages` unbounded growth, indexed on many single fields | Write amplification (8+ single-field indexes) + storage | Drop low-selectivity single-field indexes; rely on compounds; archive (§8) |
| Q6 | analytics computed live off `messages`/`conversations` | Aggregations over hot OLTP collections | Move to read replicas / rollup collections / OLAP |

---

## 6. Recommended Indexes (additive, safe)

```js
// contacts (contact-service) — close the inbound-resolve gap
db.contacts.createIndex({ workspace: 1, phone: 1 }, { unique: true });
db.contacts.createIndex({ workspace: 1, leadStatus: 1, updatedAt: -1 });
db.contacts.createIndex({ workspace: 1, assignedAgentId: 1 });
db.contacts.createIndex({ workspace: 1, "optOut.status": 1 });

// messages — analytics + campaign correlation
db.messages.createIndex({ workspace: 1, createdAt: -1 });          // dashboards
db.messages.createIndex({ workspace: 1, direction: 1, createdAt: -1 });
// (keep messageId unique-sparse; consider dropping standalone type/status single-field indexes)

// conversations — SLA / first-response reporting
db.conversations.createIndex({ workspace: 1, firstResponseAt: 1 });

// bsp_message_dispatches — reconcile provider ids
db.bsp_message_dispatches.createIndex({ providerMessageId: 1 }, { sparse: true });
db.bsp_message_dispatches.createIndex({ workspaceId: 1, createdAt: -1 });
```

All are additive and non-breaking; create with `{ background: true }` in production.

---

## 7. Data Partitioning Strategy (target)

The natural partition key everywhere is **`workspace` (tenant id)** — every hot collection already leads its compound indexes with it. Recommended progression:

1. **Phase A — single cluster, tenant-prefixed indexes (now):** every query already filters by workspace; enforce it with a lint/guard. No sharding yet.
2. **Phase B — MongoDB sharding** on `{ workspace: "hashed" }` for the two unbounded collections (`messages`, `conversations`) and `campaignmessages`. Workspace is high-cardinality and present in every query → good shard key with minimal scatter-gather.
3. **Phase C — physical DB-per-bounded-context** (matching §1's intent): split into `wapi_core` (identity/tenant), `wapi_messaging` (conv/msg/ledger), `wapi_contacts`, `wapi_campaign`, `wapi_billing`, `wapi_automation`, `wapi_bsp`. Stop redefining `Workspace`/`Contact` locally; expose them via owner-service APIs or a read-replica/CDC stream.
4. **Phase D — hot/cold tiering:** route analytics/read-heavy queries to a secondary/analytics node or a CDC-fed warehouse so OLAP never touches OLTP.

> Note: today there is **no observed multi-document transaction usage** — searches for `session`/`startTransaction` find only Mongoose driver typings, not application calls. The campaign budget flow relies on the **saga/compensation pattern** instead of distributed transactions (`CampaignWorker.ts` + `billing-events.ts`), which is the correct choice for cross-service consistency.

---

## 8. Archival Strategy

| Collection | Growth driver | Retention recommendation |
|---|---|---|
| `messages` | every inbound+outbound message | Hot 90d in primary; archive older to `messages_archive` / object storage (Parquet) via CDC; keep `messageId` index hot for reconciliation |
| `conversations` | one per contact per workspace (bounded by contacts) | Keep hot; archive `closed` conversations untouched for >180d |
| `conversationledgers` | per billing window | Roll up into `campaignsummaries`-style monthly aggregates after invoicing; archive raw |
| `bsp_webhook_events` / `webhook_dead_letters` | every webhook | TTL 30–90d once processed (add TTL index); replay window only |
| `auditlogs` | already TTL 90d (`auth/models:432`) | Export to immutable WORM store before TTL purge for compliance |
| `notifications` | TTL 30d already (`auth/models:298`) | Fine as-is |
| `campaignmessages` | per recipient per campaign | Archive with parent campaign after completion + reporting window |
| `aiintentmatchlogs`,`autoreplylogs`,`instagramquickflowlogs` | per automation hit | TTL 30–60d (add TTL indexes — none declared) |

**Missing TTLs to add now:** `bsp_webhook_events`, automation `*log` collections, `conversationledgers` (post-settlement). These are unbounded today.

---

## 9. Summary of Data-Layer Findings

1. **Decide the storage model.** The half-database-per-service / half-shared state is the root data risk. Recommend Phase C DB-per-context with `Workspace`/`Contact` owned single-writer.
2. **Add the `contacts(workspace,phone)` unique index** — highest-impact, lowest-risk fix; closes both a correctness gap (duplicate contacts) and the inbound-scan bottleneck.
3. **Add `messages(workspace,createdAt)`** before any real traffic — the admin dashboard query is a scan today.
4. **Introduce rollup collections** for analytics so OLAP stops reading hot OLTP collections.
5. **Add TTLs** to unbounded log/webhook collections.
6. **Shard on `workspace`** when `messages` outgrows a single node.
