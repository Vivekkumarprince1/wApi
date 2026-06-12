# Backup → Microservices Migration Parity Report — 2026-06-11

Deep comparison of `wApi-backup` (core-server monolith era) against this repo,
covering: full route-surface diff (375 monolith routes vs 419 new-service routes,
gateway rewrites applied), all 177 API paths the new customer-portal calls, and
line-level behavioural diff of the message pipeline (webhook-processor vs the
Kafka chain). Complements `MICROSERVICE_HEALTH_REPORT.md` (infra/inter-comm,
verified live 2026-06-11) — this report is about *feature/business-logic* parity.

## Fixed in this pass

### 1. Inbound message pipeline lost most of the monolith's lifecycle (chat-service)
`src/services/kafkaService.ts` only created the Message and bumped
`lastActivityAt`. Restored monolith `processInbound` parity:
- **Dedup** by `workspace + messageId` — Gupshup redeliveries / Kafka retries were
  creating duplicate chat messages.
- **Webhook timestamp** now drives `sentAt`, ordering and the session window
  (service-provider now forwards it; was processing-time before).
- **Conversation lifecycle on inbound**: `lastInboundAt`, `lastCustomerMessageAt`,
  `lastMessageAt`, `lastMessagePreview`, `lastMessageDirection`, `lastMessageType`,
  `messageCount`, reopen (`isOpen: true`, `status: 'open'`),
  **`windowExpiresAt` = inbound + 24h** and `incrementUnreadForAllAgents()`.
  Inbox list previews/unread badges were dead before this.
- **Auto-assignment**: ported the monolith `AutoAssignService`
  (`src/services/auto-assign-service.ts`) — ROUND_ROBIN / LEAST_ASSIGNED /
  LEAST_UNREAD with availability+capacity filters, driven by
  `workspace.inboxSettings.autoAssignmentEnabled`, team-strategy override intact.
- **Business-hours flag**: trigger-inbound now sends `isOutsideBusinessHours`
  (ported `isWithinBusinessHoursLegacy`) — `outside_business_hours` auto-replies
  and `businessHoursOnly` rule filters could never fire before.
- Contact `lastInboundAt` is stamped via contact-service resolve (new optional
  body field, monolith parity).

### 2. 24h session window was completely unenforced (chat-service)
`windowExpiresAt` was never written anywhere in the repo. Both send paths
(`sendMessageInternal`, `sendMessagePublic`) now enforce the customer-service
window for non-template messages with the monolith's self-heal recovery from the
latest inbound message (`src/services/conversation-lifecycle.ts`,
`isSessionWindowOpen`). Refusal contract: HTTP 400
`{ success:false, message:'SESSION_EXPIRED', code:'SESSION_EXPIRED' }`.

### 3. Outbound sends didn't update conversation metadata (chat-service)
Both send paths now apply `applyOutboundConversationUpdate`: preview fields,
`lastOutboundAt`, `messageCount`/`templateMessageCount`, `lastRepliedBy`,
`lastAgentReplyAt`, `firstResponseAt/By`. Internal notes still only bump
`lastActivityAt` (monolith behaviour).

### 4. Webhook edge re-streamed duplicates & dropped fields (service-provider)
`webhooks.service.ts`:
- Raw-event upsert now detects pre-existing `eventId` atomically
  (`new: false`) and **skips Kafka streaming for duplicate deliveries**.
- Parsed inbound events now carry `senderName` (WhatsApp profile name — contacts
  were being created with the phone number as the name) and `timestamp`
  (normalized to epoch seconds); status events carry `timestamp` too.
- **Template status webhooks** (`message_template_status_update` Meta-style and
  Gupshup `template-event`) now update `ProviderTemplateMirror.status` — template
  approvals previously required a manual `/templates/sync`.

### 5. `GET /api/v1/workspace/team/search` was never migrated (auth-service)
Called by the settings member panel (`lib/api/settings.ts`) → was 404.
Ported `searchTeamMemberByEmail` from the monolith workspaceController into
`memberController.ts` + routes (both `/team/search` and `/workspace/team/search`
mounts).

All four touched services (`chat-service`, `contact-service`, `auth-service`,
`service-provider`) pass `tsc --noEmit`. Live E2E not run in this session —
Mongo/Redis/Kafka and the stack were down (8GB machine constraint); see
verification checklist below.

## Second pass (same day) — remaining features ported

### 6. Assignment notifications (chat-service + websocket-gateway)
Ported the monolith NotificationService: assigning a conversation now persists a
notification (shared `notifications` collection, served by auth-service
`GET /auth/notifications`; its type enum was widened to accept the monolith
types) and pushes a realtime toast. New plumbing: chat publishes
`type:'notification'` on `chat-realtime-sync`; ws-gateway now joins every socket
to a personal `user:<id>` room and emits `workspace:notification` (the event the
frontend socket-hub already listens for) only to the recipient — with domain
types like `assignment` mapped to `info` so the toast call doesn't crash.

### 7. ActivityLog audit trail (chat/contact/auth + dashboard)
Monolith's `ActivityLog` model + `logActivity` ported (same schema, 90-day TTL,
shared `activitylogs` collection). Wired at the monolith call sites: message
send + conversation actions (chat-service), contact create/update/delete
(contact-service), workspace settings/business-info updates (auth-service).
**Dashboard fix:** `getDashboardOverview` recent-activity now reads
workspace-scoped ActivityLog with the monolith title formatting — it previously
read the super-admin `auditlogs` collection with NO workspace filter (tenant
leak, and always irrelevant entries).

### 8. Legacy route aliases restored
- auth: `/signup/send-otp`, `/signup/verify-otp`, `/resend-signup-otp`,
  `/mobile/send-otp`, `/mobile/verify-otp`, `GET /logout`,
  `GET /google/auth-url`, `/password/reset-request`, `/password/reset`,
  `POST /workspace/switch`, `GET /workspace/team`,
  `GET/PATCH /workspace/team/permissions` (PATCH = the monolith's 501).
- contact: `/api/v1/contacts/export|import|csv-import/*` → bulk handlers
  (registered before `/:id`).
- chat: `POST /api/v1/inbox/:id/read`, `GET /api/v1/inbox/:contactId/messages`
  (registered last so specific routes win).
- service-provider: onboarding `verification-status`/`stage1-status` status
  aliases; workspace `waba/subscriptions/status`, `whatsapp/subscriptions/status`,
  `whatsapp/profile*` aliases; templates `GET /library/stats` (monolith mock).
- gateway: `/api/v1/workspace/whatsapp/*` (broadened from `/whatsapp/health`)
  and `/api/v1/workspace/settings/waba*` now route to service-provider.

### Verified dead in the backup too (NOT ported — parity requires absence)
- `post-onboarding-service` / `template-seeding-service`: **zero callers in the
  monolith** — dead code there as well. Removed from the gap list.
- `ConversationLedger`: model existed in both repos, no writers in either.

## Known remaining gaps (not fixed here, intentional or low-frequency)

| Gap | Backup behaviour | Status |
|---|---|---|
| `GET/POST /workspace/whatsapp/subscriptions` (list/create) | Listed/created Gupshup webhook subscriptions | Status alias ported; list/create need new Gupshup partner logic and have no callers — dropped. |
| `GET /contacts/csv-import/list/active` | Listed active CSV import jobs | No handler, no callers — dropped. |
| `POST /inbox/:contactId/messages` (root alias) | Send any message by contact id | No generic by-contact send handler in chat-service (template-only exists); no callers — dropped. |
| `/api/health/{webhooks,tokens,signature-verification}` BSP debug routes | Ops debugging | Superseded by `/super-admin/gupshup/*` via admin-portal. |
| Activity logging from automation executions | monolith proxyController logged rule executes | automation-service does not write ActivityLog — port if the activity feed needs automation entries. |
| Permission `isOnline` | Set false on member ops; nothing sets true (same in backup) | Auto-assign availability semantics identical to backup (requires isOnline=true). If assignment "never happens", this is why — in both repos. |

## How to verify live (when stack is up)
1. Send a Gupshup webhook twice with the same payload through the gateway →
   exactly one chat message; second returns `status: 'duplicate'`.
2. Inbound message → conversation shows preview/unread badge in inbox list;
   `windowExpiresAt` stamped (+24h); contact gets WhatsApp profile name.
3. With `inboxSettings.autoAssignmentEnabled` and an agent with
   `isOnline/isAvailable/isActive` true → conversation auto-assigns.
4. Text send into a conversation with no inbound in 24h → 400 `SESSION_EXPIRED`;
   template send succeeds.
5. Settings → Team → invite panel email lookup → 200 from
   `/api/v1/workspace/team/search?email=…`.
6. Template approval webhook → mirror status flips without manual sync.
