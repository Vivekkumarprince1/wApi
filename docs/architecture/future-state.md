# wApi — Target Enterprise Architecture (Future State)

> Designed as an evolution of the **existing** codebase, not a rewrite. The current event-driven messaging seam, `@wapi/contracts`, the BSP abstraction, and the separate admin realm are kept and hardened. New elements address the gaps surfaced in the current-state, infrastructure, and security analyses.

**Target product scope:** Multi-tenant SaaS · WhatsApp Business API · Instagram Messaging · RCS · Omnichannel Inbox · Campaigns · Automation Builder · Template Management · Analytics · Billing · Team Management · Super-Admin Portal.

**Guiding principles**
1. Keep the clean seams (inbound Kafka pipeline, campaign saga, BSP dispatch); fix the coupled ones (shared DB, god-auth-service, sync outbound).
2. Channel-agnostic core: `ProviderApp` + `ParsedMessageEvent` already abstract the channel — generalize to WhatsApp/Instagram/RCS.
3. One writer per aggregate; cross-service reads via API or CDC read-models, never shared schemas.
4. Async by default for provider I/O; sync only for user-blocking reads.
5. Zero hardcoded secrets; tenant isolation enforced at the framework layer.

---

## 1. C4 Level 1 — System Context

```mermaid
graph TB
    subgraph Actors
      CU[Workspace User<br/>owner/admin/manager/agent/viewer]
      SA[Platform Super-Admin]
      EU[End Customer<br/>WhatsApp / Instagram / RCS]
      DEV[Integrator / Developer<br/>API + webhooks]
    end

    WAPI((wApi Enterprise Platform))

    subgraph External
      META[Meta Cloud API<br/>WhatsApp / Instagram]
      RCSP[RCS Provider / Google RBM]
      GS[Gupshup BSP]
      RZP[Razorpay]
      GAUTH[Google OAuth]
      SMTP[Email/SMS<br/>SMTP / Twilio]
      CDN[Media CDN / Cloudinary]
    end

    CU -->|HTTPS| WAPI
    SA -->|HTTPS admin| WAPI
    DEV -->|REST + webhooks| WAPI
    EU <-->|messages| META
    EU <-->|messages| RCSP
    META <-->|BSP| GS
    WAPI <-->|send / templates / onboarding| GS
    WAPI <-->|RCS send| RCSP
    WAPI -->|payments| RZP
    WAPI -->|OAuth| GAUTH
    WAPI -->|notify| SMTP
    WAPI -->|media| CDN
    GS -->|webhooks| WAPI
    RCSP -->|webhooks| WAPI
    RZP -->|webhooks| WAPI
```

---

## 2. C4 Level 2 — Container Diagram

```mermaid
graph TB
    subgraph Edge
      ING[Ingress + WAF + TLS<br/>App Gateway/ALB]
      APIGW[API Gateway<br/>routing + edge rate-limit]
      WHEDGE[Webhook Ingestor<br/>Fastify · HMAC · instant-200]
    end

    subgraph Frontends
      FE[Customer App<br/>Next.js]
      ADM[Super-Admin Portal<br/>Next.js]
    end

    subgraph Core_Services
      AUTH[Auth Service]
      TEN[Tenant Service]
      USR[User Service]
      CONV[Conversation Service]
      CONT[Contact Service]
      CAMP[Campaign Service]
      AUTO[Automation Service]
      BILL[Billing Service]
      NOTIF[Notification Service]
      FILE[File Service]
      AUD[Audit Service]
      ANA[Analytics Service]
    end

    subgraph Channel_Layer
      CHAN[Channel/BSP Service<br/>WhatsApp · Instagram · RCS adapters]
      DISP[Outbound Dispatch Worker]
    end

    subgraph Realtime
      WSGW[WebSocket Gateway<br/>socket.io + Redis adapter]
    end

    subgraph Data_Plane
      MONGO[(MongoDB<br/>per-context DBs)]
      REDIS[(Redis<br/>cache + BullMQ + pubsub)]
      KAFKA[[Kafka<br/>event backbone + schema registry]]
      OLAP[(Analytics Store<br/>warehouse/rollups)]
    end

    FE --> ING --> APIGW
    ADM --> ING
    APIGW --> AUTH & TEN & USR & CONV & CONT & CAMP & AUTO & BILL & NOTIF & FILE & CHAN
    APIGW -. verify session (cached JWKS) .-> AUTH
    WHEDGE --> KAFKA
    KAFKA --> CHAN
    CHAN --> KAFKA
    KAFKA --> CONV --> KAFKA
    CONV --> DISP --> CHAN
    CAMP --> DISP
    KAFKA --> WSGW --> FE
    KAFKA --> ANA --> OLAP
    AUD --> KAFKA
    Core_Services --> MONGO
    Core_Services --> REDIS
    Channel_Layer --> MONGO
    ADM -. read replicas/CDC .-> OLAP
```

**Key container changes vs today**
- **Auth split** into Auth (sessions/JWT/JWKS), Tenant (workspaces/plans/policy), User (profiles/teams/RBAC). Auth verification uses **stateless JWKS-verified JWTs** at the gateway (no per-request HTTP fan-out; revocation via short TTL + Redis denylist).
- **Outbound Dispatch Worker** added — all sends become async jobs with retry + idempotency; agent UI is no longer blocked on the BSP.
- **Channel/BSP Service** generalizes today's `service-provider` into a multi-channel adapter (WhatsApp/Instagram/RCS), preserving `ProviderApp`/`ParsedMessageEvent`.
- **Analytics Service + warehouse** consume the event stream; dashboards stop hitting OLTP.
- **Audit Service** owns `audit-events` (moved out of auth).
- **File Service** owns media upload/scan/CDN (today scattered in service-provider/Cloudinary).

---

## 3. C4 Level 3 — Component Diagram (Conversation Service, representative)

```mermaid
graph TB
    subgraph Conversation_Service
      API[REST API<br/>inbox, conversations, messages]
      ACL[Auth Context Middleware<br/>workspace-scoped guard]
      INGEST[parsed-message-events Consumer]
      CONVD[Conversation Domain<br/>window/status state machine]
      MSGD[Message Domain<br/>idempotent persist]
      OUTQ[Outbound Enqueuer → BullMQ]
      SYNC[chat-realtime-sync Producer]
      AUTOH[Automation Trigger Producer]
      REPO[(Messaging DB)]
    end
    API --> ACL --> CONVD & MSGD
    INGEST --> CONVD --> MSGD --> REPO
    MSGD --> SYNC
    MSGD --> AUTOH
    API --> OUTQ
    CONVD --> REPO
```

Mirrors today's chat-service responsibilities (`chat-service/src/services/kafkaService.ts`, `controllers/chatController.ts`) but replaces the **sync** outbound call with `OUTQ` (BullMQ) and keeps the inbound consumer + realtime producer.

---

## 4. C4 Level 4 — Deployment Diagram (Kubernetes / Azure target)

```mermaid
graph TB
    subgraph Internet
      U[Users / Webhooks]
    end
    subgraph Azure_Region_Primary
      AGW[App Gateway + WAF + TLS]
      subgraph AKS[AKS Cluster]
        subgraph ns_edge[ns: edge]
          PGW[api-gateway Deploy + HPA]
          PWH[webhook-ingestor Deploy + HPA]
          PWS[websocket-gateway Deploy + HPA]
        end
        subgraph ns_core[ns: core]
          direction LR
          C1[auth] --- C2[tenant] --- C3[user] --- C4[conversation]
          C5[contact] --- C6[campaign] --- C7[automation] --- C8[billing]
          C9[channel/bsp] --- C10[dispatch-worker] --- C11[analytics] --- C12[notification/file/audit]
        end
        MESH[Service Mesh mTLS<br/>Linkerd/Istio]
      end
      KV[Azure Key Vault + CSI]
      subgraph Managed_Data
        MDB[(MongoDB Atlas<br/>replica set / sharded)]
        MRD[(Managed Redis)]
        MK[[Managed Kafka<br/>MSK/Confluent]]
        WH[(Synapse/Warehouse)]
      end
    end
    subgraph Azure_Region_Secondary[Secondary Region - DR]
      MDB2[(Mongo replica)]
      MK2[[Kafka mirror]]
    end
    U --> AGW --> PGW & PWH & PWS
    AKS --> KV
    ns_core --> MDB & MRD & MK
    C11 --> WH
    MDB -. async repl .-> MDB2
    MK -. mirrormaker .-> MK2
```

Per-service: Deployment + HPA (CPU/mem + custom Kafka-lag metric for consumers/workers), PodDisruptionBudget, readiness/liveness probes (extend existing `/health`), resource requests/limits (today's `--max-old-space-size` caps map directly), and Key Vault CSI-mounted secrets.

---

## 5. Data Flow Diagram (target)

```mermaid
graph LR
    subgraph Inbound
      W[Provider Webhook] --> WI[Webhook Ingestor<br/>HMAC + 200]
      WI -->|raw-events| K1[[Kafka]]
      K1 --> CH[Channel Service<br/>normalize per channel]
      CH -->|parsed-message-events| K2[[Kafka]]
      K2 --> CV[Conversation Svc<br/>resolve contact + persist]
      CV -->|realtime-sync| K3[[Kafka]] --> WS[WS Gateway] --> AG[Agent Inbox]
      CV -->|automation-trigger| K4[[Kafka]] --> AU[Automation]
      CV -->|analytics-stream| K5[[Kafka]] --> AN[Analytics] --> DW[(Warehouse)]
    end
    subgraph Outbound
      AG2[Agent/API/Campaign] --> OQ[[Outbound Queue]]
      OQ --> DW2[Dispatch Worker<br/>retry + idempotency + rate]
      DW2 --> CH2[Channel Adapter] --> PV[Provider API]
      PV -->|status webhook| WI
    end
```

Single inbound ingress (ingestor only), async outbound queue, analytics tee — the three message-flow fixes.

---

## 6. Event Flow Diagram (target topics)

```mermaid
graph TB
    RAW[raw-channel-events] --> NORM[Channel Normalizer]
    NORM --> PARSED[parsed-message-events<br/>channel-tagged]
    PARSED --> CONVO[Conversation Svc]
    CONVO --> RT[realtime-sync]
    CONVO --> AUT[automation-events]
    CONVO --> ANALYTICS[analytics-stream]
    OUTREQ[outbound-requested] --> DISPATCH[Dispatch Worker]
    DISPATCH --> SENT[message-dispatched]
    SENT --> STATUS[message-status]
    STATUS --> CONVO
    STATUS --> CAMPAIGN[campaign-events]
    BILLINGEV[billing-events] --> WALLET[wallet/usage]
    AUDIT[audit-events] --> AUDITSVC[Audit Svc]
    DLQ{{per-topic DLQ}} --> DLQDRAIN[DLQ Drain + Alert]
```

**Envelope standard (new):** every event carries `{ eventId, eventType, eventVersion, occurredAt, workspaceId, correlationId, causationId, channel, payload }`; partition key = `workspaceId` for ordering; validated against a **schema registry** on consume. Extends today's `@wapi/contracts` shapes with version + envelope.

---

## 7. Multi-Tenancy Model (target)

- **Tenant = Workspace** (unchanged). Every request carries a verified `workspaceId`; every query is workspace-scoped via a **framework-level guard** (a shared middleware/Mongoose plugin that *refuses* un-scoped queries on tenant collections) rather than ad-hoc `.find({workspace})`.
- **Isolation tiers:** (1) shared cluster + row-level `workspace` filter (default), (2) dedicated DB for large/enterprise tenants, (3) dedicated namespace/cluster for regulated tenants — selectable per plan.
- **Noisy-neighbor controls:** per-workspace quotas/rate-limits enforced at gateway + dispatch worker (token bucket in Redis), plan-driven from Billing.

---

## 8. Channel Abstraction (omnichannel)

Generalize `ProviderApp`/`ParsedMessageEvent`/`ProviderMessageDispatch` (today WhatsApp-only) into a `Channel` interface with adapters:

| Capability | WhatsApp (exists) | Instagram (new) | RCS (new) |
|---|---|---|---|
| Onboarding | Gupshup partner flow (`onboarding.service.ts`) | Meta IG login + page link | RBM brand/agent registration |
| Inbound normalize | `extractV3Messages/Statuses` (`webhooks.service.ts`) | IG webhook → same `ParsedMessageEvent` | RBM webhook → same |
| Outbound | `GupshupClientService.sendMessage` | IG Send API | RBM send |
| Templates | `bsp_template_mirrors` | IG has none (free-form in window) | RCS rich cards/suggested replies |
| Session window | 24h | 24h (IG) | per-RCS rules |

The empty `channels/insta` and `channels/rcs` dirs become real adapters implementing the same port. `Conversation.channel` already exists (`contracts/models.ts:150`) — make it authoritative.

---

## 9. What Is Kept vs Changed

| Area | Keep | Change |
|---|---|---|
| Inbound pipeline | webhook→Kafka→normalize→conversation→realtime | collapse double ingress; add analytics tee |
| Outbound | BSP dispatch + ProviderMessageDispatch record | make async via queue + retry + idempotency |
| Campaign saga | budget reserve/settle pattern | distributed rate-limit; bulk contact read-model |
| Contracts | `@wapi/contracts` central types | add event envelope + versioning + runtime validation |
| Auth | separate admin realm, RBAC permission maps | split auth/tenant/user; stateless JWKS verify |
| Realtime | socket.io + Redis adapter | keep; remove DB lookups on fan-out |
| Data | per-context intent | enforce DB-per-context; single writer; CDC read-models |
| Infra | wapi-runner for dev | add containers + K8s + CI/CD + observability + secrets mgr |
| Channels | ProviderApp abstraction | implement Instagram + RCS adapters |
