# Full Frontend And Service Audit

Generated: 2026-06-22

## Scope

- Customer portal: `http://localhost:3000`
- Admin portal: `http://localhost:3100`
- Backend services: API gateway, auth, contact, chat, campaign, billing, service-provider/BSP, automation, websocket gateway, webhook ingestor
- Excluded destructive or externally risky actions:
  - Delete account
  - BSP deregister/disconnect
  - Campaign final `Launch`
  - Real payment/recharge confirmation
  - Delete/remove records unless only opening a confirmation UI

## Service Status

All local service ports were listening and health checks returned OK.

| Service | Port | Check | Result |
| --- | ---: | --- | --- |
| customer-portal | 3000 | `/` | 200 |
| admin-portal | 3100 | `/` | 307 to `/login` when unauthenticated |
| api-gateway | 5001 | `/health` | 200 |
| auth-service | 3006 | `/health` | 200 |
| contact-service | 3007 | `/health` | 200 |
| chat-service | 3008 | `/health` | 200 |
| campaign-service | 3002 | `/health` | 200, DB connected |
| billing-service | 3003 | `/health` | 200, DB connected |
| service-provider | 3004 | `/health` | 200, DB connected |
| automation-service | 3001 | `/health` | 200, DB connected |
| websocket-gateway | 3009 | `/health` | 200 |
| webhook-ingestor | 3013 | `/health` | 200, Redis connected |

## Route Inventory

Route inventory was regenerated from `page.tsx` files.

| App | Page routes |
| --- | ---: |
| Customer portal | 69 |
| Admin portal | 16 |

Saved inventory:

- `reports/frontend-audit/route-inventory-fixed.json`

Existing browser-render audit artifacts:

- `reports/frontend-audit/customer-routes-audit.json`
- `reports/frontend-audit/customer-dynamic-routes-audit.json`
- `reports/frontend-audit/admin-routes-audit.json`
- `reports/frontend-audit/admin-dynamic-routes-audit.json`

Fresh post-fix browser/DOM audit artifacts:

- `reports/frontend-audit/customer-full-route-dom-audit-postfix.json`
- `reports/frontend-audit/customer-internal-link-audit-postfix.json`
- `reports/frontend-audit/customer-final-label-check.json`
- `reports/frontend-audit/admin-full-route-dom-audit-final.json`
- `reports/frontend-audit/admin-internal-link-audit.json`
- `reports/frontend-audit/customer-loaded-control-audit-final.json`
- `reports/frontend-audit/admin-loaded-control-audit-verified.json`
- `reports/frontend-audit/rendered-link-target-audit-final.json`
- `reports/frontend-audit/customer-behavior-workflow-audit-1.json`
- `reports/frontend-audit/frontend-safe-interaction-audit-2.json`
- `reports/frontend-audit/current-service-health-final.json`
- `reports/frontend-audit/completion-audit-final.json`

## Link And Button Coverage

Customer audit catalogued:

- 61 static customer route renders
- 4 customer dynamic route renders with real local DB ids
- 37 unique customer links
- 354 customer buttons/controls

Admin audit catalogued:

- 15 static admin route renders
- 2 admin dynamic workspace route renders
- 16 unique admin links
- 137 admin buttons/controls

Fresh post-fix coverage:

- Customer: 69 routes rendered, 37 unique internal link targets navigated, 1,414 visible links catalogued, 842 visible buttons/controls catalogued, 52 inputs catalogued
- Admin: 16 routes rendered, 14 unique internal link targets navigated, 229 visible links catalogued, 45 visible buttons/controls catalogued, 4 inputs catalogued
- Customer and admin internal link navigation finished with 0 bad links
- Focused label check on changed customer controls finished with 0 unlabeled visible buttons on `/automation/whatsapp-forms/create`
- Final loaded-state customer sweep: 69 routes rendered, 868 visible controls checked, 0 unlabeled visible controls, 0 crash signatures, 0 browser console errors
- Final loaded-state admin sweep: 16 routes rendered, 390 visible controls checked, 0 unlabeled visible controls, 0 crash signatures, 0 browser console errors
- Final rendered-link target audit: 37 customer internal targets and 16 admin internal targets matched known routes or dynamic route patterns, 0 unknown targets

Safe controls exercised manually:

- Sidebar expand/collapse groups
- Theme toggle
- Command/search launcher
- Dashboard support link
- Customer `/support` module links
- Template create and submit flow
- Campaign create flow through review
- Campaign audience select all
- Campaign template selection
- Campaign schedule continue flow
- Billing and plan modal entry points, without payment finalization
- Admin navigation and workspace detail routes

## Fixes Made

1. Added a resilient API body unwrap helper.

   File: `apps/customer-portal/src/lib/api/client.ts`

   The Axios client already returns the JSON body. Some endpoints return plain data, while others return `{ success, data }`. `unwrapData()` now safely supports both shapes.

2. Fixed customer API helpers that were returning the wrong shape.

   Files:

   - `apps/customer-portal/src/lib/api/ads.ts`
   - `apps/customer-portal/src/lib/api/analytics.ts`
   - `apps/customer-portal/src/lib/api/automation.ts`
   - `apps/customer-portal/src/lib/api/commerce.ts`
   - `apps/customer-portal/src/lib/api/crm.ts`
   - `apps/customer-portal/src/lib/api/support.ts`

   This prevents pages like `/ads`, automation pages, CRM pages, commerce stats, analytics, and support macros from seeing `undefined` or wrapper objects where arrays/data are expected.

3. Added the missing customer support landing page.

   File: `apps/customer-portal/src/app/support/page.tsx`

   Dashboard and account-support links now land on a real page instead of a missing route.

4. Fixed dynamic breadcrumb links.

   File: `apps/customer-portal/src/components/layout/dashboard-header.tsx`

   Raw object-id breadcrumb segments are now displayed as labels, not clickable links to non-existent routes such as `/automation/whatsapp-forms/{id}`.

5. Kept public legal routes available without authentication.

   File: `apps/customer-portal/src/lib/public-routes.ts`

   `/privacy` and `/terms` remain in the public route set.

6. Fixed the developer webhooks page response-shape crash.

   File: `apps/customer-portal/src/app/settings/developer/webhooks/page.tsx`

   The page now normalizes wrapped gateway/service responses such as `{ data: { webhooks: [...] } }`, direct arrays, and Mongo-style `_id` / `callbackUrl` fields before rendering and before edit/delete actions.

7. Removed the broken customer `/analytics` breadcrumb link.

   File: `apps/customer-portal/src/components/layout/dashboard-header.tsx`

   Non-routable breadcrumb segments such as `/analytics` and `/automation/workflows/builder` are now labels instead of dead links.

8. Added labels to icon-only customer controls found by the button audit.

   Files:

   - `apps/customer-portal/src/components/layout/dashboard-header.tsx`
   - `apps/customer-portal/src/components/layout/notification-panel.tsx`
   - `apps/customer-portal/src/app/settings/developer/keys/page.tsx`
   - `apps/customer-portal/src/app/support/macros/page.tsx`
   - `apps/customer-portal/src/app/automation/instagram-quickflows/create/page.tsx`
   - `apps/customer-portal/src/app/automation/whatsapp-forms/create/page.tsx`
   - `apps/customer-portal/src/components/automation/whatsapp-form-visual-editor.tsx`
   - `apps/customer-portal/src/app/automation/workflows/builder/[id]/page.tsx`
   - `apps/customer-portal/src/app/automation/workflows/builder/[id]/workflow-builder-client.tsx`

9. Added loaded-state labels for row actions, selectors, charts, and icon controls discovered only after API data rendered.

   Files:

   - `apps/customer-portal/src/app/contacts/page.tsx`
   - `apps/customer-portal/src/app/contacts/[id]/page.tsx`
   - `apps/customer-portal/src/app/templates/page.tsx`
   - `apps/customer-portal/src/app/campaign/page.tsx`
   - `apps/customer-portal/src/app/campaign/new/page.tsx`
   - `apps/customer-portal/src/app/campaign/[id]/page.tsx`
   - `apps/customer-portal/src/app/settings/page.tsx`
   - `apps/customer-portal/src/app/settings/tags/page.tsx`
   - `apps/customer-portal/src/components/dashboard/settings/members-tab.tsx`
   - `apps/customer-portal/src/components/dashboard/settings/teams-tab.tsx`
   - `apps/customer-portal/src/app/automation/whatsapp-forms/page.tsx`
   - `apps/customer-portal/src/app/automation/whatsapp-forms/create/page.tsx`
   - `apps/customer-portal/src/app/automation/whatsapp-forms/[id]/responses/page.tsx`
   - `apps/customer-portal/src/app/commerce/catalog/page.tsx`
   - `apps/customer-portal/src/app/commerce/orders/page.tsx`
   - `apps/customer-portal/src/app/commerce/settings/page.tsx`
   - `apps/customer-portal/src/app/analytics/advanced/page.tsx`
   - `apps/customer-portal/src/app/crm/reports/page.tsx`
   - `apps/customer-portal/src/components/dashboard/crm/DealCard.tsx`
   - `apps/customer-portal/src/components/dashboard/crm/PipelineColumn.tsx`
   - `apps/customer-portal/src/components/dashboard/crm/PipelineListView.tsx`
   - `apps/customer-portal/src/app/integrations/page.tsx`
   - `apps/customer-portal/src/app/support/chat-assignment/page.tsx`

10. Added labels to admin row action menus discovered by the admin loaded-state audit.

   Files:

   - `apps/admin-portal/src/app/(dashboard)/users/page.tsx`
   - `apps/admin-portal/src/app/(dashboard)/workspaces/page.tsx`

## Workflow Results

Template flow:

- Opened `/templates`
- Created `audit_template_0622`
- Filled body text
- Submitted successfully
- Template appeared in the approved template list
- Re-ran the template workflow through the browser and created `audit_browser_790127`
- Filled template name, body, required variable example, review step, and clicked `Save & Submit`
- Browser showed `Template submitted for approval`, `Template created successfully`, and `Templates 3 Total`

Campaign flow:

- Opened `/campaign/new`
- Filled campaign name and description
- Selected all 10 contacts
- Selected approved template `audit_template_0622`
- Continued through schedule
- Reached final `Review & Launch`
- Stopped before clicking `Launch` because that can queue/send outbound messages
- Re-ran campaign creation from the newly submitted `audit_browser_790127` template
- Chose bulk campaign delivery, filled `audit campaign 887376`, selected all 10 contacts, continued template selection and schedule
- Reached final review with `VERIFIED AUDIENCE 10 Contacts` and `LAUNCH` visible; stopped before the launch side effect

Contacts:

- Dashboard and contacts list both showed 10 contacts in prior verification.
- Dynamic contact detail route rendered with a real local contact id.
- Opened the add contact panel and a contact row action surface without saving/removing records.

Additional safe interaction checks:

- Dashboard global controls: command/search, notifications, quick settings, account menu.
- Billing: billing page loaded and change-plan modal opened; real recharge/payment finalization was not executed.
- Developer settings: API keys and webhooks pages loaded; add-webhook endpoint modal opened without saving.
- Support: macros and chat assignment pages loaded; chat assignment refresh was exercised.
- Automation: WhatsApp Form builder loaded and displayed visual builder controls.
- CRM: pipeline and tasks loaded; new deal and new task dialogs opened without saving.
- Commerce: catalog and orders loaded; new product and manual order dialogs opened without saving.
- Admin: dashboard, users, workspaces, workspace detail, and analytics loaded; invite user dialog and workspace action menu opened without destructive actions.

## Verification

Passed:

- `npm run build` in `apps/customer-portal`
- `npm run build` in `apps/admin-portal`
- All service health checks listed above
- Current service health artifact on 2026-06-22: 12/12 checks OK, including both portals and 10 backend services
- Browser verification for `/ads` after the API unwrap fix
- Browser verification for new `/support` page
- Browser verification of template and campaign safe workflows
- Fresh browser verification of all 69 customer routes after fixes
- Fresh browser navigation verification of all 37 customer internal link targets after fixes
- Fresh browser verification of all 16 admin routes
- Fresh browser navigation verification of all 14 admin internal link targets
- Focused browser verification for `/settings/developer/webhooks`, `/analytics/advanced`, and `/automation/whatsapp-forms/create` after the latest patches
- Final loaded-state browser control verification for all 69 customer routes: 0 unlabeled visible controls, 0 crash signatures, 0 console errors
- Final loaded-state browser control verification for all 16 admin routes: 0 unlabeled visible controls, 0 crash signatures, 0 console errors
- Final rendered-link target audit for customer and admin: 0 unknown internal targets
- Browser behavior artifact for requested template and campaign workflow: `reports/frontend-audit/customer-behavior-workflow-audit-1.json`
- Browser behavior artifact for additional safe customer/admin interactions: `reports/frontend-audit/frontend-safe-interaction-audit-2.json`
- Completion audit artifact: `reports/frontend-audit/completion-audit-final.json`

Notes:

- Large sequential browser passes can crash the in-app browser tab, so route inventory and prior browser audit artifacts were preserved rather than repeatedly hammering every page in one tab.
- A fresh throwaway browser tab crashed once during continuation, so the follow-up behavior pass reused the existing healthy tab and kept interactions in smaller batches.
- Recharts still emits a non-fatal chart size warning on some dashboard/admin chart surfaces.
- The final campaign launch, real payment/recharge confirmation, record deletion, account deletion, and BSP deregister/disconnect flows were not executed.
