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

---

# Wave 2 — Dead UI wiring (2026-06-11)

A sweep found ~120 buttons/menu items with no click handler. ~35 were false positives
(Radix `*Trigger asChild` wrappers, `<Link>`-wrapped buttons, rows whose parent div owns the onClick).
The rest were wired. Verified by `tsc --noEmit` (clean) and live smoke tests of new backend routes.

## Real data hookups (were mock/dead, now hit the backend)
- **Developer API keys page** ([keys/page.tsx](apps/customer-portal/src/app/settings/developer/keys/page.tsx)) ran on hardcoded mock keys — now loads `GET /developer/keys`, Generate → `POST` (full key copied once), Revoke → `DELETE /developer/keys/:id`, curl-snippet Copy works.
- **Widget hub**: built a real config editor dialog (phone, theme color, welcome message) wired to `GET/POST /widget/config`; Design/Edit/Configure buttons all open it.
- **Instagram QuickFlows `create` page did not exist** (preset cards 404'd) — implemented `create/page.tsx` with preset/edit support against `POST/PATCH /automation/engine/instagram-quickflows`.
- **Contacts page**: Export → `GET /bulk/contacts/export` (CSV download); Bulk Tagging → `POST /bulk/contacts/tag`; Delete Selected → `POST /bulk/contacts/delete`; Sync → query refetch; Prev/Next pagination implemented (25/page).
- **Commerce orders**: Export Manifest → client CSV; "Destruct Order" → cancel via `PATCH /commerce/orders` status.
- **CRM**: DealDetailSidebar "Move Stage" is now a stage dropdown (`PATCH /crm/deals/:id/stage`), Mark Won/Lost move to final stages, Archive deletes; list-view Mark-as-Won wired; WhatsApp/Call/analytics icons on deal cards + task rows wired (wa.me / tel: / reports); Create Master Task opens TaskDialog; pipeline empty-state + Create Stage open PipelineDialog.
- **AnswerBot**: Remove Source → new backend `DELETE /answerbot/sources/:id` (added controller+route); Resync re-posts the source; FAQ "Add Button" appends an interactive button via `PATCH /answerbot/faqs/:id`.
- **Inbox**: chat-input Quick Replies inserts the `/` shortcut, sticker picker inserts emoji; contact sidebar Send Email (mailto), Block Contact (`PATCH /contacts/:id` optOut), Manage in Pipeline; received-message template URL/phone buttons, contact-card Message/Call, payment CTA all act.
- **Webhooks page**: Send Test Trigger → `POST /workspace/waba/test`; View Signing Secret opens the endpoint editor; Debug Payload copies a sample payload.
- **Quick replies**: Duplicate creates a copy via existing save mutation.

## Navigation/UX wiring (no backend existed; routed to the owning page or made honest)
- channels Connect/Manage → onboarding/profile/widget/inbox per channel (Coming-Soon disabled); campaign list Export (client CSV) + Reset Filters (Date-Range stub removed); various "Filters" stubs → working reset actions (tasks, pipeline, members, quick-replies); ads page buttons → integrations/analytics; support chat-assignment Create-Rule → rules tab / workflow builder, Manage → settings (dead kebab removed); dashboard View Logs, billing View-Detailed-Logs (scrolls to transactions) & Deactivate (account settings), stats-grid Upgrade → /billing; analytics View All Agents; docs buttons open Meta developer docs; commerce settings "Upgrade Logic" marked disabled Coming Soon (feature text says next release); checkout-bot New Flow → settings, Debugger → inbox; crm reports Export (JSON download), Historical Data, View Profile; segments View List; instagram quickflow Edit/Analytics/Logs/Start-Designing; workflows Open AI Builder → builder.
- Deleted unused duplicate `app/analytics/advanced/analytics-advanced-client.tsx`; removed dead kebab button in PipelineColumn.

## Verification
- `tsc --noEmit` clean on customer-portal; automation-service `tsc` clean.
- Runtime smoke (automation-service): `GET …/logs` 200, `POST …/rules/:id/execute`, `PATCH …/instagram-quickflows/:id/toggle`, `DELETE …/answerbot/sources/:id` route-match (404 only for nonexistent test ids), Google Sheets alias 200.
