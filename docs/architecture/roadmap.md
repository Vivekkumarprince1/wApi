# ConnectSphere — Implementation Roadmap

> A phased migration from the current laptop-deployed, partially-coupled microservices toward an enterprise multi-tenant SaaS. Each item lists **Priority** (P0 critical → P3 nice-to-have), **Effort** (S ≤ 1wk, M 1–3wk, L 1–2mo, XL > 2mo), **Risk** (Low/Med/High of regression), and **Dependencies**. Timeline assumes a small team; adjust to capacity. Every item traces back to a finding in the analysis docs.

**Sequencing logic:** stop the bleeding (secrets) → make it deployable (containers/CI) → make it safe to scale (isolation, async, observability) → extract clean services → enterprise/compliance → multi-region.

---

## Phase 1 — Immediate Fixes (Weeks 0–4) · "Make it safe & deployable"

Goal: close Critical/High security gaps and reconcile the defects that block any real deployment.

| # | Item | Priority | Effort | Risk | Depends on | Source |
|---|---|---|---|---|---|---|
| 1.1 | Remove **all** hardcoded secret fallbacks (JWT, internal-secret, KEK); add zod boot-time env validation + fail-fast per service | P0 | S | Low | — | security JWT-1, SEC-1/2/4 |
| 1.2 | Fix automation-service broken `dev` script + reconcile port (3001 vs 3005) across gateway/chat/CLAUDE | P0 | S | Low | — | current-state §1 |
| 1.3 | Lock CORS allow-lists (auth, websocket) + verify `auth_token` cookie flags (`httpOnly/Secure/SameSite`) | P0 | S | Low | — | security COR-1/2, TOK-1 |
| 1.4 | Constant-time HMAC compare + require webhook verify-token env | P1 | S | Low | — | security WH-2/3 |
| 1.5 | Add missing hot-path index `contacts(workspace,phone)` unique + `messages(workspace,createdAt)` | P0 | S | Med (dup contacts may exist — dedupe first) | data backfill | database Q1/Q2 |
| 1.6 | Collapse double webhook ingress → ingestor-only; service-provider consumes Kafka only | P1 | M | Med | Kafka reliable | message-flow §2b, M1 |
| 1.7 | **Containerize** every service (multi-stage Dockerfiles) + `docker-compose` for full local stack (Mongo/Redis/Kafka) | P0 | M | Low | — | infrastructure §1 |
| 1.8 | **CI pipeline**: per-service build + typecheck + lint + image push + image scan | P0 | M | Low | 1.7 | infrastructure §1 |
| 1.9 | Redis-backed, fail-closed edge rate limiter | P1 | M | Med | Redis | security RL-1/2 |
| 1.10 | DLQ drain+alert consumer (generalize ingestor replay) | P1 | M | Low | Kafka | message-flow M4 |

**Exit criteria:** no default secrets in any prod path; one-command local stack via compose; green CI producing scanned images; single webhook ingress; critical indexes live.

---

## Phase 2 — Scalability Improvements (Weeks 4–12) · "Make it scale safely"

Goal: remove the hot-path bottlenecks and the systemic isolation risk without splitting services yet.

| # | Item | Priority | Effort | Risk | Depends on | Source |
|---|---|---|---|---|---|---|
| 2.1 | **Async outbound**: introduce `outbound-requested` queue + Dispatch Worker (retry, idempotency, per-workspace rate); stop sync BSP calls in chat & campaign | P0 | L | Med | 1.7, Redis | message-flow M2, microservices §10 |
| 2.2 | **Tenant-isolation guard** (Mongoose plugin refusing un-`workspace`-scoped queries) + isolation integration tests | P0 | L | Med | — | security ISO-1 |
| 2.3 | Stateless **JWKS** auth verify at gateway; remove per-request HTTP fan-out to auth | P0 | L | High (auth is hot path) | RS256 keys | current-state B1, security JWT-2/3 |
| 2.4 | **Kubernetes** deploy (AKS): Deployments + HPA + probes + Key Vault CSI; gateway behind App Gateway/WAF/TLS | P0 | L | Med | 1.7/1.8 | infrastructure §10 |
| 2.5 | **Observability**: OpenTelemetry (traces/metrics/logs) across HTTP+Kafka+BullMQ; Grafana stack; consumer-lag & DLQ-depth alerts | P0 | L | Low | 2.4 | infrastructure §8 |
| 2.6 | Remove DB lookups on websocket fan-out (trust enriched sync payload) | P1 | S | Low | — | database Q3, message-flow M3-adjacent |
| 2.7 | Campaign throughput: distributed token-bucket rate-limit + **bulk** contact read API (kill N+1) | P1 | M | Med | 2.1 | message-flow M6, campaign §7 |
| 2.8 | Shared Redis split: durable (BullMQ) vs ephemeral (cache); managed Redis with failover | P1 | M | Low | 2.4 | infrastructure §4 |
| 2.9 | Event envelope + schema registry + versioning; make gateway/ingestor/ws-gateway depend on `@connectsphere/contracts` | P1 | M | Med | Kafka | future-state §6, current-state §3 |
| 2.10 | Analytics rollups: tee event stream → rollup collections; move `/analytics` off chat-service live queries | P1 | L | Low | 2.5 | database Q6, message-flow §5 |

**Exit criteria:** outbound fully async; isolation guard enforced + tested; auth off the request hot path; running on K8s with HPA + tracing; campaign throughput no longer single-process bound.

---

## Phase 3 — Microservice Extraction (Weeks 12–24) · "Clean the seams"

Goal: split the god-services, enforce single-writer ownership, end shared-schema coupling.

| # | Item | Priority | Effort | Risk | Depends on | Source |
|---|---|---|---|---|---|---|
| 3.1 | Split **auth-service** → Auth / Tenant / User / Notification / Audit (strangler pattern, route-by-route) | P1 | XL | High | 2.3, 2.9 | domain §7, microservices §2–4,14,16 |
| 3.2 | Single **Plan** owner (Billing); auth/tenant reference by id; remove duplicate model | P1 | M | Med | 3.1 | domain §2, database §1 |
| 3.3 | Consolidate **Commerce** under one owner (resolve billing/chat split) | P2 | M | Med | — | domain §2 |
| 3.4 | DB-per-context: stop redefining Workspace/Contact locally; expose via owner API or CDC read-models | P1 | XL | High | 3.1, 3.2 | database §7 Phase C, security ISO-2 |
| 3.5 | Extract **File Service** (media/CDN/scan) from service-provider | P2 | M | Low | — | microservices §15 |
| 3.6 | Extract **Analytics Service** + warehouse feed | P2 | L | Low | 2.10 | microservices §12 |
| 3.7 | **mTLS service mesh** (Linkerd/Istio); replace shared internal-secret trust | P1 | L | Med | 2.4 | security RBAC-2, SEC-1 defense |
| 3.8 | Centralized policy/RBAC enforcement (capability checks on every mutating route) | P1 | L | Med | 3.1 | security RBAC-1 |

**Exit criteria:** no service redefines another's aggregate; one writer per collection; mesh mTLS internal; auth-service decomposed.

---

## Phase 4 — Enterprise Readiness (Weeks 24–40) · "Omnichannel + compliance + admin"

Goal: deliver the named product scope (Instagram, RCS) and enterprise/compliance features.

| # | Item | Priority | Effort | Risk | Depends on | Source |
|---|---|---|---|---|---|---|
| 4.1 | **Instagram** channel adapter (onboarding, inbound normalize → `parsed-message-events`, outbound) | P1 | L | Med | 3.x channel split | future-state §8 (empty `channels/insta`) |
| 4.2 | **RCS** channel adapter (RBM registration, rich cards, send/receive) | P1 | L | Med | 4.1 | future-state §8 (empty `channels/rcs`) |
| 4.3 | Omnichannel inbox: make `Conversation.channel` authoritative; unified timeline | P1 | M | Med | 4.1/4.2 | future-state §8 |
| 4.4 | **Admin MFA + separate signing key + time-boxed audited impersonation + maker-checker** | P0 | L | Med | 3.1 | super-admin §6, security |
| 4.5 | Revenue/analytics dashboards from warehouse (not OLTP); MRR/ARR/churn | P2 | M | Low | 3.6 | super-admin §4.2 |
| 4.6 | Compliance: WORM audit export, data-residency controls, PII redaction, DSAR/export tooling, retention/TTL on log collections | P1 | L | Med | 3.6 | database §8, super-admin §4.7 |
| 4.7 | Per-tenant quotas/entitlements enforced from Billing plan (noisy-neighbor) | P1 | M | Med | 3.2 | future-state §7 |
| 4.8 | MongoDB sharding on `workspace` for messages/conversations; hot/cold tiering + archival | P2 | L | Med | 3.4 | database §7/§8 |
| 4.9 | SOC2-oriented controls: access reviews, secret rotation automation, IaC for everything | P2 | L | Low | 2.4 | infrastructure §10 |

**Exit criteria:** WhatsApp + Instagram + RCS live in one inbox; admin hardened with MFA+impersonation audit; compliance/retention in place; tenant quotas enforced.

---

## Phase 5 — Multi-Region Deployment (Weeks 40+) · "Global scale & DR"

Goal: resilience, locality, and disaster recovery.

| # | Item | Priority | Effort | Risk | Depends on | Source |
|---|---|---|---|---|---|---|
| 5.1 | Active-passive **DR region**: Mongo replica, Kafka MirrorMaker, Redis replication, runbooks + drills | P1 | XL | High | Phase 4 | infrastructure §10, future-state §4 |
| 5.2 | Regionalized webhook ingestion (geo-DNS to nearest ingestor) + global event routing | P2 | L | Med | 5.1 | future-state §4 |
| 5.3 | Data residency by tenant region (EU/IN/US) — route writes to in-region DB-per-context | P2 | XL | High | 3.4, 4.6 | future-state §7 |
| 5.4 | Active-active for stateless edge (gateway/ingestor/ws) with global LB; sticky realtime via Redis | P3 | L | Med | 5.1 | future-state §4 |
| 5.5 | Chaos/load testing, capacity planning, autoscaling tuning per region | P2 | L | Low | 5.1 | infrastructure §8 |

**Exit criteria:** documented RTO/RPO met in DR drills; tenant data residency honored; survives single-region loss.

---

## Cross-Phase Dependency Graph

```mermaid
graph LR
    P1[Phase 1<br/>Secrets+Containers+CI]
    P2[Phase 2<br/>Async+Isolation+K8s+OTel]
    P3[Phase 3<br/>Service Split+DB-per-context+Mesh]
    P4[Phase 4<br/>Omnichannel+Compliance+Admin]
    P5[Phase 5<br/>Multi-Region+DR]
    P1 --> P2 --> P3 --> P4 --> P5
    P1 -. 1.7 containers .-> P2_4[K8s 2.4]
    P2_3[JWKS 2.3] -. enables .-> P3_1[Auth split 3.1]
    P3_4[DB-per-context 3.4] -. enables .-> P5_3[Residency 5.3]
```

---

## Risk-Weighted Priority Shortlist (do first)

1. **1.1 Remove default secrets** — Critical, S, Low risk, no deps. *Highest ROI.*
2. **1.5 Hot-path indexes** — Critical perf, S, fix-before-traffic.
3. **1.7/1.8 Containers + CI** — unblocks everything else.
4. **2.2 Tenant-isolation guard** — closes the systemic cross-tenant leak class.
5. **2.1 Async outbound** — removes the agent-latency/burst bottleneck.
6. **2.3 JWKS auth** — removes auth from the request hot path.

---

## Effort Summary by Phase

| Phase | Theme | Calendar (small team) | Dominant risk |
|---|---|---|---|
| 1 | Safe & deployable | ~4 weeks | Index backfill / contact dedupe |
| 2 | Scale safely | ~8 weeks | Auth hot-path migration |
| 3 | Clean seams | ~12 weeks | Strangler split of auth-service + DB-per-context |
| 4 | Enterprise + omnichannel | ~16 weeks | New channel integrations, compliance |
| 5 | Multi-region | open-ended | DR correctness, data residency |

> Each phase is independently shippable and leaves the platform in a better, releasable state — no big-bang cutover.
