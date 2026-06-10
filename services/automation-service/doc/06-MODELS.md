# Models — Data Schemas Overview

The service stores automation configuration, executions and logs in MongoDB. Main model exports are in `src/models/index.ts`.

Key collections and purpose

- `AutomationRule` — rule definitions. Fields typically include:
  - `workspaceId` — Workspace scope
  - `name`, `description`
  - `trigger` — type (message.inbound, schedule, event), trigger config
  - `conditions` — expression tree or filters
  - `actions` — ordered list of steps to execute
  - `enabled`, `priority`

- `AutomationExecution` — records each rule execution and its status
  - `ruleId`, `workspaceId`, `context`, `result`, `startedAt`, `finishedAt`

- `AutomationAuditLog` — human-friendly audit trail of actions performed by the engine

- `AiIntentMatchLog` — logs of AI intent detection attempts and matches

- Answer-bot related:
  - `AnswerBotSettings`, `AnswerBotSource`, `FAQ` — settings and FAQ content used by rule actions

- Interactive & Forms:
  - `InteraktiveList`, `InstagramQuickflow`, `WhatsAppForm`, `WhatsAppFormResponse` — store interactive list templates, IG quickflows and form responses

- `AutoReply`, `AutoReplyLog` — auto-reply templates and logs

Indexes & considerations
- Ensure `workspaceId` is indexed on large collections for efficient per-workspace queries.
- TTL or retention for logs and executions may be desired (not present by default).

Where to see the exact schema
- Each model file in `src/models/` defines the Mongoose schema. Inspect them for exact field names and validation.
