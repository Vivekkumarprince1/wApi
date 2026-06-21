# Final System Status — 2026-06-10

## Verdict: ✅ Stable for development; all discovered route/auth/contract breaks fixed and retested live.

## Topology (verified)
```
customer-portal (Next 16, :3000) ─┐  rewrites /api/v1/* ─┐
admin-portal   (Next 16, :3100) ──┤  writes w/ secret ───┤
                                  ▼                      ▼
                         api-gateway (:5001) — session verify via auth-service
        ┌──────────┬─────────┬────────┬──────────┬──────────┬──────────┬────────────┐
        ▼          ▼         ▼        ▼          ▼          ▼          ▼            ▼
   auth :3006  contact   chat     billing   campaign   automation  service-     websocket-
               :3007     :3008    :3003     :3002      :3001       provider     gateway :3009
                                                                   (Nest):3004  (socket.io)
   webhook-ingestor :3013 (Fastify, BSP webhooks → Kafka)
   MongoDB :27017 (db: wapi) · Redis :6379 · Kafka :9092 (KAFKA_BROKER/KAFKA_BROKERS both honored)
```

## What was broken → now fixed (headline items)
1. **Entire service-provider surface unreachable through the gateway** (`/provider/v1/*` vs `/bsp/v1/*` prefix drift after the Phase-2 BSP migration): WABA settings, profile, webhooks, phone numbers, connection status, BSP onboarding, templates-adjacent admin ops.
2. **All automation routes 502** (gateway env pointed at :3005; service runs on :3001).
3. **All admin-portal writes 401** (gateway stripped the very headers the admin portal authenticates with; plus placeholder secret in `.env.local`). Now: timing-safe trusted-caller pass-through.
4. **Super-admin operations misrouted** to auth-service (which has no such routes) instead of service-provider/billing.
5. Eight single-endpoint contract breaks (automation logs/execute/quickflow-toggle, Google Sheets aliases, media upload, CSV import payload+path, forms export URL).
6. Invalid tokens returned 502 instead of 401.

## Production-readiness notes (pre-existing, unchanged but flagged)
- Helmet, CORS allowlist, per-scope rate limits (auth/api/bulk), correlation IDs, zod env validation, graceful proxy error handling: present in gateway.
- Secrets in committed `.env` files (Gupshup partner secret, Razorpay key, Google client secret) — move to a secret manager before any production deploy; rotate the exposed ones.
- `JWT_SECRET`/`INTERNAL_SERVICE_SECRET` are dev defaults; ws-gateway and billing enforce non-default secrets in production (`NODE_ENV=production` guards) — keep that pattern.
- websocket-gateway `.env` lacks `INTERNAL_SERVICE_SECRET` (it doesn't currently need it — JWT-only handshake).
- `super-admin/billing/reconcile` has no backend implementation (admin UI button will 404 cleanly through the new routing).
- Customer portal paths should use `apps/customer-portal`; older `apps/frontend` references were stale.

## Reports in this audit
ROUTE_MISMATCH_REPORT.md · FRONTEND_BACKEND_CONTRACT_REPORT.md · API_AUDIT_REPORT.md · MICROSERVICE_HEALTH_REPORT.md · WEBSOCKET_REPORT.md · ERROR_REPORT.md · FIXES_APPLIED.md · TEST_REPORT.md
