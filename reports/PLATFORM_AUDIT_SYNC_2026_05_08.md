# Platform audit sync — May 8, 2026

This document **reconciles** prior audit reports ([`MICROSERVICES_AUDIT_REPORT.md`](../MICROSERVICES_AUDIT_REPORT.md), [`AUDIT_REPORT_2026_05_06.md`](AUDIT_REPORT_2026_05_06.md)) with the **current codebase** after commerce alignment **and** pass 4 (tracing, inbox search, FormSubmission UI). The **Cursor canvas** audit view lives next to the IDE: `~/.cursor/projects/Users-vivekkumar-devlopment-wApi/canvases/wApi-platform-audit.canvas.tsx` — keep it aligned with this doc when you change findings.

---

## 1. Changes now reflected in the repo

| Area | Prior audit risk | Current behavior (verified in code) |
|------|------------------|--------------------------------------|
| WhatsApp checkout orders | Orders written only on the **monolith** MongoDB; billing payment links expected billing `Order` rows | `CheckoutBotService.finalizeOrder` creates orders via **`POST /api/billing/commerce/wallets/:workspaceId/orders`** (`server/src/services/commerce/checkout-bot-service.ts`) |
| Commerce pay / status | Billing routes used **`authenticate` only**; monolith bot calls with **internal secret** could 401 | **`authenticateOrInternal`** on pay + status (`billing-service/src/routes/commerceRoutes.ts`) |
| Fetch order by ID | Monolith **logistics** called **`GET /api/billing/commerce/orders/:orderId`** with no matching route | **`GET /orders/:orderId`** added on commerce router + **`getOrderById`** (`billing-service`; requires `x-workspace-id`) |
| Worker bridge gaps | No list-orders bridge for internal callers | **`list-orders`** in **`internalController.workerBridge`** forwards to billing list API |
| Billing create (migrations) | Always regenerated **`orderNumber`**; hard to import legacy rows | Internal callers (`system` role) may pass **`orderNumber`** and **`_id`**; duplicate → **409** |
| Legacy wallet drift | Session sync relied on ad hoc merge | One-shot **`npm run migrate:legacy-wallets`** (`server/src/scripts/migrate-legacy-wallets.ts`) plus existing **`POST /wallets/:id/sync`** |
| Historical monolith orders | Two DBs of truth | One-shot **`npm run migrate:orders-to-billing`** (`server/src/scripts/migrate-orders-to-billing.ts`) |

---

## 2. Updated dependency / integration picture

- **server → billing (commerce):** Checkout bot, payment link helper, and logistics order fetch are aligned on **billing-owned** `Order` documents for new bot flows.
- **Monolith `Order` model:** Still present for **legacy data and migration**; safe removal only after migration + verification in each environment.

---

## 3. Severity adjustments (directional)

These **narrow** earlier findings; they do not re-audit the whole codebase.

| Topic | Earlier snapshot | May 8 sync |
|-------|------------------|------------|
| Billing commerce “incomplete / broken pay path” | High / medium | **Mitigated** for internal + gateway flows on pay/status and order fetch |
| Dual write checkout orders | High (data split) | **Mitigated** for **new** WhatsApp checkout orders |
| Missing commerce GET order | Effectively broken reference | **Resolved** |
| Wallet single source of truth | Split | **Billing authoritative** for balance; legacy fields on `Workspace` still exist until you run migration / optional clear |

**Unchanged** (still open per older reports): dependency `npm audit` items, invoice PDF depth, optional real-time campaign/automation events, analytics enhancements, `.env` discipline in deployments, broader auth standardization documentation.

---

## 4. Pass 4 — tracing, inbox, contact UI (same day)

| Area | Implementation |
|------|----------------|
| `x-correlation-id` on monolith → microservice proxy | `buildProxyHeaders` uses `getCorrelationId()` from ALS when the caller did not pass `correlationId` (`server/src/controllers/proxyController.ts`). |
| Billing axios from `internalController` | `correlationHeaders()` merged on pricing / reserve / settle / list-orders (`server/src/controllers/internalController.ts`). |
| Campaign / automation → monolith | Axios request interceptors set `x-correlation-id` (`randomUUID()` when unset) on `campaign-service/src/lib/monolith-worker-client.ts` and `automation-service/src/lib/internal-client.ts`. |
| Inbox search | Workspace-scoped **`$text`** on `Message.body` and `Contact.name` with regex fallback (`server/src/controllers/conversationController.ts`); indexes on those paths (`Message.ts`, `Contact.ts`). Env **`INBOX_TEXT_SEARCH=0`** disables `$text`. |
| FormSubmission UX | **`GET /api/v1/contacts/:id/form-submissions`** (`contactRoutes`, `contactController`); contact profile timeline (`frontend/src/app/contacts/[id]/page.tsx`). |
| Worker-bridge billing settle contract | `monolithWorkerBridge.billingSettle` now sends **`reservedAmount` / `actualSpend`** (matches monolith bridge). |

---

## 5. Operational follow-ups

1. Run **`migrate:legacy-wallets`** (dry-run first) where monolith wallet fields still hold paise.
2. Run **`migrate:orders-to-billing`** after backup; idempotent skips on **409**.
3. Confirm **billing** `CommerceSettings` / Razorpay config exists per workspace for live payment links.
4. Optionally remove or soft-deprecate monolith **`Order`** reads/writes after cutover validation.

---

## 6. How to use this doc with older reports

- **`MICROSERVICES_AUDIT_REPORT.md`** — May 6 issue tables are a **historical snapshot**; use **this sync** for commerce, billing routes, checkout, and worker-bridge rows.
- **`ACTIVE_TASKS.md`** — Optimization items (real-time campaign/workflow UI, analytics, widget) remain; add migration tasks to your runbook if not already tracked.

*Sync written: May 8, 2026 — updated through pass 4 (commerce + trace + inbox + FormSubmission UI + canvas).*
