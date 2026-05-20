# Automation Service

Automation Service is the workflow and decision engine for the WAPI stack. It owns the workspace automation hub, message-triggered rules, FAQ and answer bot content, AI intent rules, interactive lists, Instagram quickflows, and WhatsApp forms.

The service is an Express + TypeScript API backed by MongoDB, Redis, and BullMQ.

## What This Service Does

At a high level, the service:

- Stores workspace-scoped automation rules and executions.
- Receives internal triggers from the monolith and evaluates matching rules.
- Traverses visual workflows and relays side effects back to the monolith.
- Manages answer bot settings, sources, and FAQ drafts.
- Manages AI intent rules.
- Manages interactive lists and Instagram quickflows.
- Manages WhatsApp forms, publishing, unpublishing, sync, and response export.
- Runs background crawling for answer bot sources.
- Runs a scheduler for scheduled automation rules.

## Runtime Architecture

```text
Client / Monolith / Internal Services
        |
        v
   Express API
        |
        +--> MongoDB  (rules, forms, quickflows, logs, executions)
        +--> Redis    (events, queues, scheduler, pub/sub)
        +--> BullMQ   (answerbot crawl jobs, schedule heartbeat jobs)
        +--> Monolith (internal action bridge)
```

### Startup Flow

1. Load environment variables.
2. Connect to MongoDB.
3. Start the HTTP server.
4. Start the automation scheduler.
5. Accept authenticated workspace traffic and internal secret traffic.

If MongoDB is unavailable at startup, the service exits rather than exposing a half-started API.

## Authentication Model

The service supports two access patterns:

### 1) Workspace user access

Protected routes use `authenticate`, which accepts either:

- Gateway headers:
  - `x-user-id`
  - `x-workspace-id`
  - `x-user-role`
- Or a JWT bearer token / auth cookie.

Role checks use `authorize([...])` where needed.

### 2) Internal service access

Internal monolith callbacks and triggers use `internalAuth`, which expects:

- `x-internal-service-secret`

If the secret is missing or invalid, the request is rejected with `401`.

## API Surface

All feature routes are mounted under:

`/api/automation/engine`

### Automation Engine

Routes in `src/routes/engineRoutes.ts`:

- `GET /rules` - list workspace rules, optionally filtered by category.
- `GET /rules/:id` - fetch a rule.
- `POST /rules` - create a rule.
- `PATCH /rules/:id` - update a rule.
- `PUT /rules/:id` - update a rule.
- `PATCH /rules/:id/toggle` - enable or disable a rule.
- `DELETE /rules/:id` - soft delete a rule.
- `GET /stats` - execution stats for the last N days.
- `GET /executions` - latest execution logs.
- `GET /hub/summary` - aggregated hub overview.
- `POST /trigger-inbound` - internal inbound message trigger.
- `POST /trigger-event` - internal custom event trigger.
- `DELETE /internal/purge/:workspaceId` - internal workspace purge.

### AI Intent

Routes in `src/routes/aiIntentRoutes.ts`:

- `GET /ai-intent`
- `GET /ai-intent/:id`
- `POST /ai-intent`
- `PATCH /ai-intent/:id`
- `PUT /ai-intent/:id`
- `DELETE /ai-intent/:id`

These are specialized `AutomationRule` records where `trigger.type === 'ai_intent'`.

### Answer Bot

Routes in `src/routes/answerBotRoutes.ts`:

- `GET /answerbot/settings`
- `PATCH /answerbot/settings`
- `GET /answerbot/sources`
- `POST /answerbot/sources`
- `GET /answerbot/faqs`
- `POST /answerbot/faqs`
- `POST /answerbot/faqs/approve`
- `POST /answerbot/faqs/generate`
- `PATCH /answerbot/faqs/:id`
- `DELETE /answerbot/faqs/:id`

### Interaktive Lists

Routes in `src/routes/interaktiveListRoutes.ts`:

- `GET /interaktive-list`
- `GET /interaktive-list/:id`
- `POST /interaktive-list`
- `PATCH /interaktive-list/:id`
- `PUT /interaktive-list/:id`
- `DELETE /interaktive-list/:id`

### Instagram Quickflows

Routes in `src/routes/instagramQuickflowRoutes.ts`:

- `GET /instagram-quickflows`
- `GET /instagram-quickflows/:id`
- `POST /instagram-quickflows`
- `PATCH /instagram-quickflows/:id`
- `PUT /instagram-quickflows/:id`
- `DELETE /instagram-quickflows/:id`

### WhatsApp Forms

Routes in `src/routes/whatsappFormRoutes.ts`:

- `GET /whatsapp-forms`
- `GET /whatsapp-forms/:id`
- `POST /whatsapp-forms`
- `PUT /whatsapp-forms/:id`
- `PATCH /whatsapp-forms/:id`
- `DELETE /whatsapp-forms/:id`
- `POST /whatsapp-forms/:id/publish`
- `POST /whatsapp-forms/:id/unpublish`
- `POST /whatsapp-forms/:id/sync`
- `GET /whatsapp-forms/:id/responses`

## Automation Execution Pipeline

The main execution path is implemented in `AutomationService` and `FlowExecutorService`.

### Inbound message order

When `POST /trigger-inbound` is called, the service evaluates the event in this order:

1. Outsourced checkout flow via the monolith, if `conversationId` exists.
2. Rule-based auto reply.
3. Workflow execution.
4. Answer bot FAQ matching.
5. AI intent processing.

That order matters. Earlier handlers can short-circuit later ones when they successfully handle the message.

### Rule matching

Rules are filtered by:

- workspace
- enabled state
- deleted state
- trigger event
- optional keyword filters

The service also handles special cases such as form replies (`interactiveReply.type === 'nfm_reply'`) by mapping them to `form_submitted`.

### Flow execution

`FlowExecutorService.execute()` performs graph traversal over `flowConfig.nodes` and `flowConfig.edges`.

Behavior:

- Creates an `AutomationExecution` record before running actions.
- Publishes `workflow_started` and `workflow_completed` events to Redis.
- Traverses nodes in graph order while preventing cycles with a visited set.
- Supports simple conditional branching through logic nodes.
- Relays side effects to the monolith through `/api/internal/actions`.
- Marks execution success or failure and persists action results.

### Side-effect bridge

Most action nodes do not directly mutate downstream business data inside this service. Instead, the service forwards action payloads to the monolith so shared business logic stays centralized.

Examples of bridged actions:

- send message
- send template
- interactive response actions
- tag assignment
- conversation assignment
- deal creation

## Background Jobs

### Answer bot crawl queue

Answer bot URL sources can be crawled asynchronously via BullMQ.

Pipeline:

1. `enqueueAnswerBotSourceCrawl(sourceId, workspaceId)` adds a job to the `answerbot-crawl` queue.
2. `AnswerBotCrawlWorker` consumes the job.
3. `AnswerBotCrawlerService.crawlSource()` fetches the source URL, extracts candidate FAQ pairs from headings and nearby paragraphs, and inserts draft FAQs.

The crawler:

- only processes URL sources
- times out network fetches after 12 seconds
- de-duplicates questions
- limits extraction to 40 draft FAQs
- updates crawl status on the source document

### Scheduler

`src/workers/scheduler.ts` runs a repeating heartbeat every 60 seconds.

It looks for enabled rules whose `trigger.event === 'schedule'` and enqueues `run-rule` jobs for due rules.

Important details:

- job IDs are derived from rule id + current UTC time slice for idempotency
- Redis stores the repeatable heartbeat metadata
- scheduled rule processing is isolated from the HTTP request path

## Data Model Map

### Core automation records

- `AutomationRule` - main rule definition, trigger, actions, flow graph, category, priority, soft-delete state.
- `AutomationExecution` - execution audit trail for graph traversal.
- `WorkflowExecution` - lightweight workflow execution history for the stateless workflow path.
- `AutomationAuditLog` - audit log for automation changes and important operational events.

### Reply and intent records

- `AutoReply` - keyword based auto reply configuration.
- `AutoReplyLog` - records auto reply outcomes.
- `AiIntentMatchLog` - records intent classification matches.

### Answer bot records

- `AnswerBotSettings` - global answer bot persona and enablement state per workspace.
- `AnswerBotSource` - source URLs or other knowledge inputs.
- `FAQ` - draft and approved FAQ content.

### Content experience records

- `InteraktiveList` - list-based interactive message definitions.
- `InstagramQuickflow` - Instagram quick response and quickflow definitions.
- `InstagramQuickflowLog` - execution or dispatch log for Instagram quickflows.
- `WhatsAppForm` - published or draft WhatsApp flow or form definition.
- `WhatsAppFormResponse` - responses captured from submitted forms.

## Operational Notes

- The service uses workspace scoping everywhere. Queries are always filtered by `workspace`.
- Soft deletes are used in several collections with `deletedAt` rather than hard removal.
- Some queries fall back to handling both string and ObjectId workspace values for compatibility.
- Cache-control headers are explicitly set on summary endpoints to avoid stale dashboard data.
- The service logs request duration with correlation IDs when available.

## Environment Variables

The code requires these variables at runtime:

- `PORT` - HTTP port, default `3001`
- `NODE_ENV` - runtime environment
- `MONGODB_URI_AUTOMATION` - MongoDB connection string
- `JWT_SECRET` - JWT verification secret for workspace-authenticated requests
- `INTERNAL_SERVICE_SECRET` - internal service auth secret
- `REDIS_URL` - Redis connection string
- `MONOLITH_INTERNAL_URL` - internal monolith base URL used by the bridge client

Optional / integration variables:

- `AI_GEMINI_KEY` - reserved for AI-backed features
- `BSP_SERVICE_URL` - external service URL used by some cross-service flows

## Local Development

1. Install dependencies.
2. Start MongoDB and Redis.
3. Configure `.env`.
4. Run the service in dev mode:

```bash
npm run dev
```

The service will:

- connect to MongoDB
- start the HTTP API
- start the scheduler

## Build And Run

```bash
npm run build
npm start
```

## Notes For Integrators

If you call this service from the monolith or another backend, prefer the internal routes and pass `x-internal-service-secret`.

If you are building UI against the workspace dashboard routes, use the authenticated route set and make sure the workspace context is present in the gateway headers or JWT.
