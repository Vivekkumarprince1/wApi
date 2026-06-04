# Architecture — Automation Service

High-level components

- HTTP API (Express): exposes management endpoints and internal triggers.
- MongoDB: primary persistent store for rules, executions, logs and content.
- Redis + BullMQ: job queue for background work and schedulers.
- Scheduler worker: time-based triggers that kick off scheduled automation rules.
- Internal client + Monolith integration: forwards important state and receives system events.

Runtime Diagram (ASCII)

```
           ┌────────────┐        ┌──────────────┐        ┌──────────┐
           │   Client   │ <----> │  Automation  │ <----> │  MongoDB │
           │  (Main UI) │        │   Service    │        └──────────┘
           └────────────┘        │ (Express)    │
                                 └────┬─────────┘
                                      │
                             ┌────────▼─────────┐
                             │ BullMQ / Redis   │
                             │  (queues, jobs)  │
                             └────────┬─────────┘
                                      │
                             ┌────────▼─────────┐
                             │  Workers &       │
                             │  Scheduler       │
                             └──────────────────┘
```

Data flow summary
- Management calls (CRUD) update MongoDB models (AutomationRule, AnswerBotSettings, WhatsAppForm, etc.).
- Incoming events (webhooks / monolith triggers) call the `execute`/`trigger` endpoints which evaluate matching rules.
- Matching rules produce Executions which may enqueue jobs on BullMQ for background actions (message sends, API calls, crawls).
- Scheduled rules are launched by `workers/scheduler.ts` on startup and run as cron-like jobs.

Security
- User-facing routes: `authenticate` middleware — gateway headers or JWT.
- Admin operations: `authorize(['owner','admin'])` on select endpoints.
- Internal triggers: `internalAuth` middleware requiring `x-internal-service-secret`.
