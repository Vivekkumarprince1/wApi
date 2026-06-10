# Frontend ↔ Backend Contract Report — 2026-06-10

Method: every endpoint string in `apps/customer-portal/src/lib/api/*` and component-level `api.*` calls traced through Next rewrites + gateway to a concrete controller; payload/response shapes compared.

## Contract breaks found & fixed
| Endpoint | Break | Fix |
|---|---|---|
| `POST /contacts/import` (ContactImportModal) | wrong path AND wrong payload (multipart FormData; backend `uploadCSV` wants JSON `{csvContent, fileName}`) | modal now reads file text, posts JSON to `/bulk/contacts/csv-import/upload`; toast reads `response.message` (axios interceptor already unwraps `.data`) |
| `POST /contacts/import` (lib `importContacts`) | path doesn't exist | → `/bulk/contacts/import` (`bulkCreateContacts`) |
| `GET /automation/engine/logs` | route didn't exist | backend alias added |
| `POST /automation/engine/rules/:id/execute` | route+controller missing | implemented |
| `PATCH /automation/engine/instagram-quickflows/:id/toggle` | route+controller missing | implemented (body `{enabled}` optional) |
| `GET /integrations/google/spreadsheets/:id/{sheets,columns}` | backend used different shapes (`/google/sheets`, `/google/columns/:id`) | aliases added; `columns` handler already reads `:id` + `?sheetName` ✓ |
| `POST /upload/media` | only `/upload` and `/api/v1/upload` existed | `api/v1/upload/media` added (same handler, returns `{success,url,filename,mimeType}` which both call-sites consume) |
| forms responses export URL | missing `/engine` segment | frontend fixed |
| All `/onboarding/bsp/*`, `/onboarding/status|complete` | gateway prefix drift → 404 | gateway fixed |
| All `/workspace/waba|profile|webhooks|phone-numbers|connection-status|whatsapp/health` | gateway prefix drift → 404 | gateway fixed |

## Response-shape conventions (verified compatible)
- customer-portal axios interceptor returns `response.data` directly; lib files defensively `unwrap()` `{data}` envelopes — compatible with both `{success,data}` (automation/contact/billing) and bare-object (auth) styles.
- 401s are not toasted client-side (interceptor) and the Next proxy middleware redirects to login on dead sessions — coherent.
- `/auth/session` returns `{authenticated:false}` with 200 when anonymous; proxy middleware treats non-OK as logout — verified live: anonymous session returns 200 + authenticated:false, middleware relies on `nextStep`/`accessRestriction` fields when authenticated.

## Notes
- `/onboarding/business-info` and `/onboarding/verify-mobile` are **page routes**, not API calls (business API correctly posts `/business/info`, `/business/verify`).
- Several chat/contact routes are triple-registered (`/api/v1/x`, `/x`, bare) for proxy-strip resilience — harmless, but consolidate eventually.
