# Customer Live Service Terminal Audit

Generated: 2026-06-22

## Scope

- Customer portal only.
- Backend terminals were restarted into one monitored stream with prefixed logs for:
  - api-gateway
  - auth-service
  - contact-service
  - chat-service
  - billing-service
  - campaign-service
  - automation-service
  - service-provider
  - websocket-gateway
  - webhook-ingestor
- Forbidden actions were not executed: account deletion, BSP disconnect/deregister, final campaign launch, final payment/recharge, destructive deletes.

## Findings

- Previous audit did not watch every backend terminal stream at the same time. This pass did.
- No frontend-driven `429` responses were observed during the monitored customer route pass.
- Route pass rendered 61 customer static routes: 60 passed immediately; `/crm` first timed out because the dev server was compiling that route for 23.5s, then loaded successfully after compilation.
- Browser console showed stale Recharts container-size warnings from the earlier analytics load; no new crash signatures were observed in the targeted post-fix checks.
- The customer app was making repeated `/api/v1/auth/session` calls across route changes. Fixed with a one-minute authenticated session cache in the Zustand auth store while preserving forced refresh for login, recharge, and explicit auth-change events.
- The AI Intent page was sending React Query internals as query params (`client=[object Object]&queryKey[]=...`). Fixed by wrapping the query function so it calls `fetchAiIntents()` with no QueryFunctionContext argument.
- The service-provider was attempting automatic webhook subscription sync on boot and producing provider-side 400s. Fixed by making boot sync opt-in with `AUTO_SYNC_WEBHOOKS_ON_BOOT=true`.
- The service-provider event bus logs printed the Redis URI. Fixed to log connection intent without the URI.
- The API gateway internal health endpoint created a new proxy per health request and produced a listener leak warning during repeated checks. Fixed with cached health proxies and added `service-provider` health alias support.

## Verification

- `apps/customer-portal`: `npm run build` passed.
- `apps/customer-portal`: `npm run lint` passed with existing warnings only.
- `services/api-gateway`: `npm run build` passed.
- `services/service-provider`: `npm run build` passed.
- Repeated `GET /api/internal/health/service-provider` returned `200` without the previous listener warning.
- Post-fix AI Intent route produced clean backend URL:
  - `GET /api/v1/automation/engine/ai-intent`
  - no `client=[object Object]` or `queryKey[]` params.
- Post-fix service-provider boot logged:
  - `Automatic webhook subscription sync is disabled. Set AUTO_SYNC_WEBHOOKS_ON_BOOT=true to enable it.`

## Notes

- Gateway still logs a Node deprecation warning from `http-proxy-middleware` internals: `util._extend` is deprecated. This is not from app code and did not break requests.
- Redis eviction policy warnings are still emitted by Redis clients. They are infrastructure/config warnings, not frontend-triggered route errors.
