# Services — Business Logic and Background Workers

Services directory: `src/services/`

Core services and responsibilities

- `automation-service.ts`
  - Core execution engine: evaluates `AutomationRule` conditions and creates `AutomationExecution` records. Orchestrates actions and enqueues jobs where required.

- `flow-executor.ts`
  - Runs a flow for an execution, resolves variables and steps, calls action executors (HTTP calls, message sends, db updates).

- `ai-intent-service.ts`
  - Intent detection and model integration wrappers used by AI-driven rules.

- `answer-bot-service.ts`
  - Handles rule matching for the answer bot, integrates FAQ sources and training/generation operations.

- `simple-action-executor.ts`
  - Executes simple, synchronous actions (reply, http-forward) for workflow steps.

- `variable-service.ts`
  - Resolves variables and templates used in flows and outgoing messages.

- `workflow-service.ts`
  - Higher level helpers around creating and managing workflow executions.

- `answerbot-crawler-service.ts` & queue workers
  - Periodic crawling and indexing of sources for answer-bot FAQ generation; integrated with dedicated queues (`answerbot-crawl-queue` & `answerbot-crawl-worker`).

Background workers
- `workers/scheduler.ts` — starts on boot and schedules cron-like rules (trigger.event === 'schedule').
- BullMQ workers process asynchronous jobs that the services enqueue.

Extensibility points
- `services/external/index.ts` contains adapter hooks for integrating third-party APIs (AI providers, HTTP targets).
