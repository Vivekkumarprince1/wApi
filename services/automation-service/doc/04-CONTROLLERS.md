# Controllers — Responsibilities & Endpoints

This file lists controllers present in `src/controllers/` and summarizes their responsibilities and the routes that call them.

- `AutomationEngineController` — `src/controllers/AutomationEngineController.ts`
  - Responsibilities: CRUD for `AutomationRule`, rule evaluation, execution logging, stats, purge workspace data, inbound/event triggers
  - Called by: `/api/automation/engine/*` (rules, stats, executions, trigger-inbound, trigger-event, purge)

- `AiIntentController` — `src/controllers/AiIntentController.ts`
  - Responsibilities: Manage AI intent rules used for intent detection and routing
  - Called by: `/api/automation/engine/ai-intent` routes

- `AnswerBotController` — `src/controllers/AnswerBotController.ts`
  - Responsibilities: Manage answer-bot settings and data sources
  - Called by: `/api/automation/engine/answerbot/*` (settings, sources)

- `FaqController` — `src/controllers/FaqController.ts`
  - Responsibilities: CRUD and workflow for FAQs (create, approve, generate)
  - Called by: `/api/automation/engine/answerbot/faqs` endpoints

- `WhatsAppFormController` — `src/controllers/WhatsAppFormController.ts`
  - Responsibilities: Create/publish/sync WhatsApp forms and collect responses
  - Called by: `/api/automation/engine/whatsapp-forms/*` endpoints

- `InstagramQuickflowController` — `src/controllers/InstagramQuickflowController.ts`
  - Responsibilities: CRUD for Instagram quickflows used to respond to Instagram events

- `InteraktiveListController` — `src/controllers/InteraktiveListController.ts`
  - Responsibilities: CRUD for interactive WhatsApp lists

Note: Each controller relies on services under `src/services/` for business logic. Controllers focus on request validation, auth checks and calling the service layer.
