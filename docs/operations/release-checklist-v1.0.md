# ConnectSphere v1.0 Production Release Checklist

## Release progression

### Private Alpha

- One production-like staging environment with isolated MongoDB, Redis, provider sandbox, Razorpay test account, OAuth callbacks, and Cloudinary folder/account.
- Limited internal tenants.
- Daily review of errors, queue/DLQ depth, provider reconciliation, and billing ledger.

### Closed Beta

- Invite-only external tenants.
- On-call rotation and tested incident escalation.
- Backup restore exercise completed.
- Provider and Razorpay live-mode staging validation completed with controlled accounts.
- Capacity and rate-limit tests completed.

### Public Production

- All closed-beta exit criteria met for at least two stable release cycles.
- Remaining critical/high runtime vulnerabilities accepted or remediated by owner and deadline.
- Public support, status communication, and billing reconciliation procedures active.

## Security

- [ ] No production mock/dummy flags or placeholder credentials
- [ ] Gateway CORS origins are explicit HTTPS origins
- [ ] CSRF origin/custom-header validation smoke-tested
- [ ] Internal identity issuer/audience/expiry tests pass
- [ ] Admin portal access restricted by identity-aware control/allowlist
- [ ] Key Vault access and secret rotation tested
- [ ] Runtime/container security scans reviewed

## Configuration

- [ ] Production image registry and immutable SHA tag configured
- [ ] Development, staging, and production use separate MongoDB databases
- [ ] Queue-bearing Redis namespaces/instances are isolated and use `noeviction`
- [ ] Razorpay test/live credentials cannot be mixed
- [ ] Provider sandbox/live app IDs cannot be mixed
- [ ] OAuth callbacks are environment-specific
- [ ] Optional feature flags remain disabled unless launch-approved

## Database

- [ ] Backup/PITR enabled
- [ ] Restore tested in staging
- [ ] New indexes created and replication impact reviewed
- [ ] Tenant-scope smoke queries pass
- [ ] Billing unique indexes verified in production

## Redis and queues

- [ ] AOF/managed persistence enabled for durability-required queues
- [ ] Campaign queue, deletion queue, and DLQ metrics visible
- [ ] Stalled-job and retry behavior tested
- [ ] Worker SIGTERM drain tested
- [ ] Pending reconciliation records reviewed before launch

## Provider integration

- [ ] Gupshup onboarding validated in staging
- [ ] Template create/submit/pending/approved/rejected lifecycle validated
- [ ] Provider 429/500/timeout behavior validated
- [ ] Message idempotency and uncertain-outcome reconciliation validated

## Billing

- [ ] Razorpay live webhook signature verified
- [ ] Duplicate webhook test credits exactly once
- [ ] Recharge order ownership and amount reconciliation verified
- [ ] Ledger/invoice reconciliation report reviewed

## Webhooks

- [ ] Unsigned and invalid signatures rejected
- [ ] Duplicate events are idempotent
- [ ] Dead-letter replay tested
- [ ] Inbound message reaches inbox and WebSocket

## TLS and networking

- [ ] Certificates valid and renewal tested
- [ ] Internal services are ClusterIP only
- [ ] MongoDB and Redis have no public exposure
- [ ] Ingress request-size, timeout, and rate-limit policy reviewed

## Monitoring

- [ ] JSON structured logs ingested
- [ ] Secret redaction verified
- [ ] `/metrics` scrape configured for instrumented services
- [ ] Alerts configured for readiness, 5xx, latency, queue failures, DLQ, webhook rejection, wallet failures, and WebSocket disconnect spikes
- [ ] Trace context visible across gateway/downstream/provider logs

## Backup and rollback

- [ ] Disaster recovery runbook reviewed
- [ ] Rollback GitOps commit tested in staging
- [ ] Previous immutable image tags retained
- [ ] Rollback caveats for deletion operations and message reconciliation acknowledged

## Smoke tests

- [ ] Signup/login/workspace/session
- [ ] WhatsApp onboarding and connection
- [ ] Contact CRUD
- [ ] Template provider lifecycle
- [ ] Campaign queue and delivery reconciliation
- [ ] Inbound webhook to inbox/WebSocket
- [ ] Razorpay recharge exactly once
- [ ] Cross-tenant access rejected
- [ ] Partial deletion and retry
