# API Reference — Automation Service

Base path: `http://{host}:{port}` (default port `3001`)

Swagger UI: `/docs` (raw spec at `/docs/openapi.json`)

Authentication
- User APIs: `authenticate` middleware accepts either gateway headers (`x-user-id`, `x-workspace-id`, `x-user-role`) OR a JWT bearer token signed with `JWT_SECRET`.
- Internal APIs: require header `x-internal-service-secret` matching `INTERNAL_SERVICE_SECRET`.

Important endpoints

- Health
  - GET `/health` — service liveness and DB status.

- Engine (Management + Triggers)
  - GET `/api/automation/engine/rules` — list rules (authenticated)
  - GET `/api/automation/engine/rules/:id` — get rule (authenticated)
  - POST `/api/automation/engine/rules` — create rule (authenticated)
  - PATCH/PUT `/api/automation/engine/rules/:id` — update rule
  - PATCH `/api/automation/engine/rules/:id/toggle` — enable/disable rule
  - DELETE `/api/automation/engine/rules/:id` — delete rule
  - GET `/api/automation/engine/stats` — engine stats
  - GET `/api/automation/engine/executions` — execution logs
  - GET `/api/automation/engine/hub/summary` — automation hub summary

  - Internal triggers (internal service secret):
    - POST `/api/automation/engine/trigger-inbound` — trigger inbound event handling
    - POST `/api/automation/engine/trigger-event` — trigger generic event
    - DELETE `/api/automation/engine/internal/purge/:workspaceId` — purge workspace data

- AI Intent
  - GET `/api/automation/engine/ai-intent`
  - GET `/api/automation/engine/ai-intent/:id`
  - POST `/api/automation/engine/ai-intent`
  - PATCH/PUT `/api/automation/engine/ai-intent/:id`
  - DELETE `/api/automation/engine/ai-intent/:id`

- Answer Bot & FAQ
  - GET `/api/automation/engine/answerbot/settings`
  - PATCH `/api/automation/engine/answerbot/settings`
  - GET `/api/automation/engine/answerbot/sources`
  - POST `/api/automation/engine/answerbot/sources`
  - GET `/api/automation/engine/answerbot/faqs`
  - POST `/api/automation/engine/answerbot/faqs`
  - POST `/api/automation/engine/answerbot/faqs/approve`
  - POST `/api/automation/engine/answerbot/faqs/generate`
  - PATCH `/api/automation/engine/answerbot/faqs/:id`
  - DELETE `/api/automation/engine/answerbot/faqs/:id`

- WhatsApp Forms
  - GET `/api/automation/engine/whatsapp-forms`
  - GET `/api/automation/engine/whatsapp-forms/:id`
  - POST `/api/automation/engine/whatsapp-forms`
  - PUT/PATCH `/api/automation/engine/whatsapp-forms/:id`
  - DELETE `/api/automation/engine/whatsapp-forms/:id`
  - POST `/api/automation/engine/whatsapp-forms/:id/publish`
  - POST `/api/automation/engine/whatsapp-forms/:id/unpublish`
  - POST `/api/automation/engine/whatsapp-forms/:id/sync`
  - GET `/api/automation/engine/whatsapp-forms/:id/responses`

- Interactive Lists
  - GET `/api/automation/engine/interaktive-list`
  - GET `/api/automation/engine/interaktive-list/:id`
  - POST `/api/automation/engine/interaktive-list`
  - PATCH/PUT `/api/automation/engine/interaktive-list/:id`
  - DELETE `/api/automation/engine/interaktive-list/:id`

OpenAPI
- See `src/openapi.ts` — the service uses `zod-to-openapi` and `@wapi/contracts` to generate the OpenAPI spec. The document includes a manual entry for `/api/automation/engine/execute` (internal execution endpoint).
