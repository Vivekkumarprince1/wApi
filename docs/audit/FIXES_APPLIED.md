# Fixes Applied — 2026-06-10

All fixes verified by rebuild (tsc/nest clean) and live smoke tests through the running stack.

## services/api-gateway/src/index.ts
1. **BSP prefix migration**: all rewrites targeting service-provider changed from `/provider/v1/*` to `/bsp/v1/*` (workspace WABA/profile/webhooks/health/phone-numbers/connection-status, onboarding, legacy onboarding/provider). Root cause: Phase-2 BSP migration renamed the NestJS controller prefixes; the gateway was never updated.
2. **New mount** `/api/v1/onboarding/bsp/*` → `/bsp/v1/onboarding/*` (customer-portal's BSP onboarding API), registered before the generic onboarding mount.
3. `/api/internal/provider/*` → now rewrites to `/internal/v1/bsp/*` (was `/internal/v1/provider/*`, which matched nothing).
4. **Super-admin sub-routing** (was: everything → auth-service, which has no such routes):
   - `/api/v1/super-admin/gupshup/*` → service-provider `/internal/v1/bsp/admin/*` (with `sync-all-webhooks` → `sync-webhooks` alias for the admin-portal's action name)
   - `/api/v1/super-admin/plans/*` → billing `/api/billing/wallets/admin/plans/*`
   - `/api/v1/super-admin/billing/*` → billing `/api/billing/wallets/admin/*`
5. **Trusted internal caller pass-through**: requests presenting the correct `INTERNAL_SERVICE_SECRET` (timing-safe compare) keep their identity headers and skip session verification. Unblocks all admin-portal writes. All identity headers (now including `x-internal-service`) are still stripped from untrusted requests.
6. Gateway now injects `x-internal-service: api-gateway` alongside the secret after session verification — required by service-provider's NestJS guards (`InternalAuthGuard` / `WorkspaceAuthGuard` demand a service name).
7. Invalid/expired tokens now return **401** (was 502 "auth service offline") — only genuine verify-service failures return 502.
8. `SERVICES.serviceProvider` accepts `BSP_SERVICE_URL` as env alias (the .env used that name; code only read `SERVICE_PROVIDER_URL`).

## services/api-gateway/.env
9. `AUTOMATION_SERVICE_URL` corrected `:3005` → `:3001` (automation-service's actual port; previously every automation route 502'd).

## services/automation-service
10. `routes/engineRoutes.ts`: added `GET /logs` (alias of `/executions`) and `POST /rules/:id/execute`.
11. `controllers/AutomationEngineController.ts`: new `executeRuleNow` (manual rule execution via `FlowExecutorService`, workspace-scoped, 404 on foreign rule).
12. `controllers/InstagramQuickflowController.ts` + `routes/instagramQuickflowRoutes.ts`: new `PATCH /instagram-quickflows/:id/toggle` (`toggleQuickflow`, honors explicit `enabled` boolean or flips).
13. `routes/integrationRoutes.ts`: aliases `GET .../google/spreadsheets/:id/sheets` and `GET .../google/spreadsheets/:id/columns` mapped to existing handlers.

## services/service-provider
14. `channels/whatsapp/media/upload.controller.ts`: added `POST api/v1/upload/media` (same Cloudinary handler) — used by commerce image upload and inbox media upload.

## apps/customer-portal
15. `src/lib/api/automation.ts`: WhatsApp-form responses export URL fixed to `/api/v1/automation/engine/whatsapp-forms/...`.
16. `src/lib/api/contacts.ts`: `importContacts` → `POST /bulk/contacts/import`.
17. `src/components/dashboard/contacts/ContactImportModal.tsx`: CSV import now reads the file text and posts JSON `{csvContent, fileName}` to `/bulk/contacts/csv-import/upload` (matches `bulkController.uploadCSV`; previously multipart FormData to a nonexistent route).

## apps/admin-portal
18. `.env.local`: `INTERNAL_SERVICE_SECRET` aligned to the shared dev secret (was placeholder `your_internal_service_secret_here`, so even valid writes were rejected).

## Dependency hygiene
19. api-gateway: `zod` was declared but not installed (build failed with TS2307); installed.
