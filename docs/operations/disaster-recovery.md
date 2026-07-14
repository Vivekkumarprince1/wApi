# ConnectSphere v1.0 Disaster Recovery Runbook

## Scope

This runbook covers the production MongoDB databases, Redis/BullMQ state, Kubernetes workloads, and provider reconciliation needed by the core WhatsApp product.

## Recovery objectives

These are launch targets, not contractual guarantees. They must be validated in staging before publication:

- MongoDB target RPO: 24 hours with daily snapshots; lower only after continuous backup/PITR is enabled and restore-tested.
- MongoDB target RTO: 4 hours for a controlled restore and application reconciliation.
- Redis/BullMQ target RPO: best effort. Durability-required jobs must use Redis persistence and Mongo domain records as source of truth.
- Application target RTO after infrastructure recovery: 2 hours, excluding third-party provider outages.

## MongoDB backup

1. Use managed MongoDB continuous backup/PITR where available; otherwise take encrypted daily snapshots.
2. Retain daily backups for 14 days, weekly backups for 8 weeks, and monthly backups for 6 months.
3. Keep backups in a separate account/project and restrict restore privileges.
4. Include all service databases: auth/core, contact/chat shared data, campaign, billing, automation, BSP, webhook receipts, and WebSocket membership data.
5. Record schema/application release (`v1.0.0` and Git SHA) with every backup.

## MongoDB restore procedure

1. Declare the incident and freeze writes by enabling gateway maintenance mode.
2. Select the newest verified recovery point within the accepted data-loss window.
3. Restore into new databases; never overwrite the only production copy in place.
4. Verify collection counts, required indexes, unique constraints, and representative tenant-scoped queries.
5. Point a staging deployment at the restored databases and run core smoke tests.
6. Update production secret references to the restored endpoints.
7. Deploy the matching application Git SHA.
8. Run reconciliation:
   - template status synchronization;
   - pending campaign/message reconciliation;
   - Razorpay payment reconciliation against unique payment references;
   - webhook receipt/dead-letter replay;
   - deletion operations not in terminal states.
9. Remove maintenance mode only after tenant-isolation and billing-integrity checks pass.

## Redis data classification

### EPHEMERAL

- API rate-limit windows
- service-control cache copies (Mongo `system_settings` remains source of truth)
- short-lived Gupshup token caches
- WebSocket presence and room membership
- distributed limiter buckets

These may be discarded and reconstructed.

### RECONSTRUCTABLE

- session cache entries (JWT/user records are authoritative)
- template/provider read caches
- UI invalidation events
- scheduler heartbeat entries where Mongo rule state is authoritative

Loss causes temporary degradation, not permanent business loss.

### DURABILITY_REQUIRED

- BullMQ campaign jobs and campaign DLQ
- BullMQ deletion operations
- scheduled automation execution jobs
- any future outbox queue bridging billing/provider events

Production Redis must enable AOF persistence (`appendfsync everysec` or managed equivalent), use a non-evicting policy for BullMQ databases, and have replication/failover. Redis `maxmemory-policy` must be `noeviction` for queue-bearing instances.

## Redis recovery

1. Restore the newest AOF/snapshot only if its consistency is known.
2. If queue state is lost, rebuild only from Mongo source-of-truth records:
   - campaigns in `QUEUED`, `SCHEDULED`, `PROCESSING`, or reconciliation states;
   - deletion operations in `REQUESTED`, `RETRYING`, `PARTIALLY_COMPLETED`, or stale `IN_PROGRESS`;
   - webhook receipts/dead letters in pending states.
3. Never blindly recreate a provider send when its dispatch state is `UNKNOWN` or `RECONCILIATION_REQUIRED`.
4. Reconcile provider message IDs before retrying uncertain sends.

## Restore validation

A quarterly staging restore exercise must verify:

- login/session and workspace membership;
- cross-tenant access rejection;
- contact and inbox timelines;
- approved template visibility;
- campaign queue recovery without duplicate logical sends;
- duplicate payment webhook does not double-credit;
- webhook receipt replay;
- partial deletion operation resumes.

Record duration, data loss, failed checks, and corrective actions after every exercise.
