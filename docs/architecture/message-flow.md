# ConnectSphere — Message Flow Analysis

> Traced end-to-end from source. Sequence diagrams use Mermaid. Every step cites the file/line that implements it. Two inbound paths exist and both are documented; the duplication is flagged.

---

## 1. Topic & Queue Map

| Channel | Name | Transport | Producer(s) | Consumer(s) |
|---|---|---|---|---|
| Kafka | `raw-webhook-events` | kafkajs | webhook-ingestor (`index.ts:199`), service-provider `channel.service.ts:97,122` | service-provider `ProviderKafkaConsumerService` (`provider-kafka-consumer.service.ts:32`) |
| Kafka | `parsed-message-events` | kafkajs | service-provider `webhooks.service.ts:105,137` | chat-service (`kafkaService.ts:25`) |
| Kafka | `chat-realtime-sync` | kafkajs | chat-service (`kafkaService.ts:115,230`) | websocket-gateway (`index.ts:289`), billing-service (`EventBus.ts:109`) |
| Kafka | `campaign-events` | kafkajs | chat-service (status, `kafkaService.ts:135`), campaign-service | campaign-service `EventBus.ts:240`, websocket-gateway |
| Kafka | `billing-events` | kafkajs | billing-service | billing-service consumer, websocket-gateway |
| Kafka | `contact-events` | kafkajs | contact-service | websocket-gateway |
| Kafka | `automation-events` | kafkajs | automation-service | websocket-gateway |
| Kafka | `audit-events` | kafkajs | admin/auth actions | auth-service consumer → `auditlogs` |
| BullMQ | `campaign-engine` | Redis | campaign-service (`campaign-queue.ts`) | `CampaignWorker` (`workers/CampaignWorker.ts:21`) |
| BullMQ | billing saga queue (`billingEventsQueue`) | Redis | campaign worker (`CampaignWorker.ts:117,239`) | billing-service saga handler |
| Redis pub/sub | socket.io redis-adapter | Redis | websocket-gateway | websocket-gateway (multi-instance fan-out, `index.ts:368`) |
| HTTP (sync) | `/internal/v1/bsp/messages/send` | fetch/axios | chat-service, campaign worker | service-provider `MessagesService` |
| HTTP (sync) | `/internal/v1/contacts/resolve` | fetch | chat-service | contact-service |
| HTTP (sync) | `/api/automation/engine/trigger-inbound` | fetch (fire-and-forget) | chat-service | automation-service |

**Resilience:** every Kafka consumer does 3 attempts w/ exponential backoff then publishes to `{topic}-dlq` (`chat/kafkaService.ts:32-72`, `websocket/index.ts:298-344`, `provider-kafka-consumer.service.ts:39-86`). The ingestor instead persists to Mongo `webhook_dead_letters` with a `/internal/v1/webhooks/replay` endpoint (`webhook-ingestor/src/index.ts:73-92,217-248`).

---

## 2. Inbound Message Lifecycle

### 2a. Canonical path (current production-intended)

```mermaid
sequenceDiagram
    autonumber
    participant Meta as Meta/WhatsApp
    participant GS as Gupshup (BSP)
    participant ING as webhook-ingestor (Fastify 3013)
    participant K as Kafka
    participant SP as service-provider (NestJS 3004)
    participant CS as chat-service (3008)
    participant CON as contact-service (3007)
    participant AU as automation-service
    participant WS as websocket-gateway (3009)
    participant UI as Agent Inbox (frontend)

    Meta->>GS: message received
    GS->>ING: POST /webhooks (raw JSON, x-gupshup-signature)
    ING->>ING: HMAC-SHA256 verify (index.ts:114-129)
    ING->>K: produce raw-webhook-events {eventId,provider,rawPayload} (index.ts:199)
    ING-->>GS: 200 OK instantly (index.ts:206)
    Note over ING: on Kafka fail → webhook_dead_letters (index.ts:202)

    K-->>SP: consume raw-webhook-events (provider-kafka-consumer.service.ts:32)
    SP->>SP: receiveGupshup() re-validates, resolves workspaceId by appId/phoneNumberId (webhooks.service.ts:32-50)
    SP->>SP: upsert bsp_webhook_events (idempotent on eventId) (webhooks.service.ts:57)
    alt status update
        SP->>K: produce parsed-message-events {type:status_update,messageId,status} (webhooks.service.ts:105)
    else inbound message
        SP->>K: produce parsed-message-events {direction:inbound,senderPhone,text,...} (webhooks.service.ts:137)
    end

    K-->>CS: consume parsed-message-events (kafkaService.ts:25)
    CS->>CON: POST /internal/v1/contacts/resolve {workspaceId,phone} (kafkaService.ts:158)
    CON-->>CS: contactId
    CS->>CS: upsert Conversation (unique workspace+contact) (kafkaService.ts:185-198)
    CS->>CS: create Message (status=delivered) (kafkaService.ts:201)
    CS->>K: produce chat-realtime-sync {type:message_created,payload,contact} (kafkaService.ts:230)
    CS->>AU: POST /api/automation/engine/trigger-inbound (fire-and-forget) (kafkaService.ts:243)

    K-->>WS: consume chat-realtime-sync (index.ts:289)
    WS->>WS: build inbox:message_new payload (+contact lookup if absent) (index.ts:176-220)
    WS->>UI: socket emit inbox:message_new → room workspace:{id} & conversation:{id} (index.ts:219-220)
    AU-->>CS: (async) may dispatch auto-reply via outbound path
```

### 2b. Direct path (also present — duplication)

`service-provider` also exposes a **direct HTTP webhook controller** (`webhooks.controller.ts`) that calls the *same* `receiveGupshup()`. So a Gupshup webhook can reach the parser **either** via the ingestor→Kafka hop **or** directly. (Source: `provider-kafka-consumer.service.ts:56` and the controller both invoke `webhooksService.receiveGupshup`.) Idempotency on `bsp_webhook_events.eventId` (`webhooks.service.ts:57`) prevents double-persist, but **`parsed-message-events` can still be produced twice** if both paths fire for the same delivery, since the produce step is unconditional after the upsert. **→ Flagged: collapse to one canonical ingress.**

### 2c. Status-update sub-flow (delivery receipts)

```mermaid
sequenceDiagram
    autonumber
    participant SP as service-provider
    participant K as Kafka
    participant CS as chat-service
    participant CMP as campaign-service
    participant WS as websocket-gateway
    SP->>K: parsed-message-events {type:status_update, messageId, status} (webhooks.service.ts:105)
    K-->>CS: consume (kafkaService.ts:88)
    CS->>CS: Message.findOne({workspace,messageId}); updateStatus(status) (kafkaService.ts:91-97)
    CS->>K: chat-realtime-sync {type:message_status_updated} (kafkaService.ts:115)
    alt message belongs to a campaign
        CS->>K: campaign-events {MessageStatusUpdateEvent} (kafkaService.ts:135)
        K-->>CMP: update CampaignMessage status / totals
    end
    K-->>WS: chat-realtime-sync → inbox:message_status (index.ts:226-236)
    WS->>WS: emit inbox:message_status to workspace+conversation rooms
```

Status mapping (`webhooks.service.ts:213-231`): `enqueued|accepted|sent→sent`, `delivered→delivered`, `read|seen→read`, `failed|deleted→failed`.

---

## 3. Outbound Message Lifecycle

### 3a. Agent-initiated send (inbox)

```mermaid
sequenceDiagram
    autonumber
    participant UI as Agent Inbox
    participant GW as api-gateway (5001)
    participant AUTH as auth-service
    participant CS as chat-service (3008)
    participant SP as service-provider (3004)
    participant GS as Gupshup
    participant K as Kafka
    participant WS as websocket-gateway

    UI->>GW: POST /api/v1/inbox/conversations/:id/messages (auth_token cookie)
    GW->>AUTH: POST /internal/v1/auth/verify-session {token} (index.ts:76)
    AUTH-->>GW: {user,workspace,role,permissions}
    GW->>GW: inject x-user-id/x-workspace-id/x-internal-service-secret (index.ts:94-106)
    GW->>CS: proxy → sendMessagePublic (chatController.ts:515)
    CS->>CS: persist outbound Message (status=queued/sent)
    CS->>SP: POST /internal/v1/bsp/messages/send (SYNC) (chatController.ts:441/622)
    SP->>GS: GupshupClientService.sendMessage (messages.service.ts:15)
    GS-->>SP: {messageId, envelopeId}
    SP->>SP: persist ProviderMessageDispatch (status=sent) (messages.service.ts:20)
    SP-->>CS: {providerMessageId, status:sent}
    CS->>CS: update Message.messageId = providerMessageId
    CS->>K: chat-realtime-sync {message_created / sent} (kafkaService producer)
    K-->>WS: emit inbox:message_sent / inbox:message_new
    Note over GS,WS: delivery/read receipts arrive later via INBOUND status path (§2c)
```

**Key property:** the agent's request **blocks on the Gupshup round-trip** (`chatController.ts:438-441`). There is no outbound queue — burst load and provider latency propagate straight to the agent UI (bottleneck B2 in current-state).

### 3b. Campaign broadcast (saga)

```mermaid
sequenceDiagram
    autonumber
    participant API as campaign-service API
    participant Q as BullMQ campaign-engine
    participant W as CampaignWorker
    participant B as billing-service (saga)
    participant CON as contact-service
    participant SP as service-provider/BSP
    participant K as Kafka

    API->>Q: enqueue CAMPAIGN_START {campaignId,workspaceId} (campaign-queue.ts)
    Q-->>W: process CAMPAIGN_START (CampaignWorker.ts:54)
    W->>W: preflight validate (template+balance) (CampaignWorker.ts:60)
    alt preflight fails
        W->>W: Campaign.status=PAUSED + audit (CampaignWorker.ts:62-67)
        W->>K/socket: campaign:status_update PAUSED
    else ok
        W->>B: billingEventsQueue.add(CampaignCreatedEvent) (CampaignWorker.ts:117)
        B->>B: reserve budget on Wallet
        alt funds ok
            B->>W: BudgetReservedEvent (contracts/billing-events.ts)
            W->>Q: enqueue BATCH_PROCESS per batch
            Q-->>W: process BATCH_PROCESS (CampaignWorker.ts:131)
            loop each recipient (chunk=10, paced by MPM)
                W->>CON: getContact(workspaceId,contactId) (CampaignWorker.ts:153)
                W->>SP: sendTemplate(...) bridge (CampaignWorker.ts:169)
                SP-->>W: {messageId|error}
                W->>W: update CampaignMessage + batch recipient status (CampaignWorker.ts:185-199)
            end
            W->>K/socket: campaign:batch_completed (CampaignWorker.ts:224)
            opt last batch
                W->>B: billingEventsQueue.add(CampaignCompletedEvent {actualSpend}) (CampaignWorker.ts:239)
                B->>B: settle wallet (reserved→actual)
                W->>K/socket: campaign:status_update COMPLETED (CampaignWorker.ts:246)
            end
        else funds short
            B->>W: BudgetReservationFailedEvent → Campaign PAUSED (compensation)
        end
    end
    Note over SP,K: per-message delivery status flows back via inbound status path (§2c),<br/>which re-emits campaign-events MessageStatusUpdateEvent to update totals
```

Pacing: `agentMessagesPerMinute/60` messages/sec, chunked at concurrency 10, `setTimeout` between chunks (`CampaignWorker.ts:144-208`). Worker concurrency is 5 (`CampaignWorker.ts:23`).

---

## 4. Realtime Fan-out Detail

`websocket-gateway` authenticates the socket by verifying the `auth_token` JWT itself (`index.ts:63-91`), then checks workspace membership against the `permissions` collection before joining `workspace:{id}` / `conversation:{id}` rooms (`index.ts:101-139`). It consumes 5 Kafka topics and maps them to socket events (`index.ts:253-274`). A Redis adapter (`@socket.io/redis-adapter`) lets multiple gateway instances share rooms (`index.ts:360-373`). Multi-name emits (e.g. both `inbox:message_new` and legacy `message:created`) provide frontend back-compat (`index.ts:219-223`).

---

## 5. Analytics Path

Analytics is **not a separate pipeline today**. The gateway routes `/api/v1/analytics` and `/api/v1/metrics` to **chat-service** (`api-gateway/src/index.ts:341-342`), which computes them live from `messages`/`conversations` (`chat-service/src/controllers/supportController.ts` `getMessageTrends`). The super-admin snapshot aggregates counts directly (`control-plane-service.ts`). There is **no event-sourced analytics store, no rollups, no warehouse**. The `audit-events` topic is the closest thing to an analytics stream and only feeds `auditlogs`.

---

## 6. Failure Modes & Gaps (message layer)

| # | Gap | Evidence | Consequence |
|---|---|---|---|
| M1 | Two inbound ingress paths can double-produce `parsed-message-events` | §2b | Possible duplicate inbound messages if both fire (mitigated only by downstream `messageId` unique on persist) |
| M2 | Outbound send is synchronous, no queue | `chatController.ts:438` | Agent latency = provider latency; no burst absorption; no retry on transient BSP failure |
| M3 | Kafka optional in non-prod | `kafkaService.ts:77-83` etc. | Locally the whole realtime/inbound pipeline can be silently dead |
| M4 | DLQs exist but no DLQ consumer/alerting | grep: `{topic}-dlq` produced, no subscriber | Dead letters accumulate unmonitored |
| M5 | Status event reshaped at each hop; field-name tolerance | `websocket/index.ts:228` | Brittle; a shape change breaks status display silently |
| M6 | Campaign per-recipient contact fetch over HTTP | `CampaignWorker.ts:153` | Network N+1; throughput ceiling |
| M7 | No idempotency key enforced end-to-end on outbound | `BspSendMessageRequest.idempotencyKey` optional (`contracts/bsp.ts:90`) | Retries could double-send |
| M8 | No global ordering / partition key discipline documented | producers key by messageId/conversationId variably | Out-of-order status vs create possible |

---

## 7. Recommended Target Message Flow (preview — see future-state.md)

1. **Single ingress:** ingestor is the *only* webhook edge → `raw-webhook-events`; service-provider consumes Kafka **only** (remove the direct controller produce). One canonical normalizer.
2. **Outbound queue:** chat/campaign enqueue an `outbound-messages` job; a dispatch worker calls BSP with retry + idempotency key; agent UI gets optimistic ack + async status. Decouples agent latency from provider.
3. **DLQ pipeline:** a dedicated consumer drains `{topic}-dlq` → Mongo + alert, with replay tooling (generalize the ingestor's existing replay).
4. **Event envelope + schema registry:** version every event; validate on consume; partition by `workspaceId` for ordering.
5. **Analytics stream:** tee `parsed-message-events` + `chat-realtime-sync` into a rollup/warehouse so dashboards never touch OLTP.
