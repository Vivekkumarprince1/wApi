# Background Workers & Queues

wApi uses **BullMQ** (powered by Redis) to handle long-running or asynchronous tasks. This ensures that the web server remains responsive and can handle high-volume events like bulk broadcasts and webhooks.

## 1. Overview

Workers are centralized in `src/lib/services/worker-registry.ts` and are initialized by the custom server process. Each worker listens to a specific Redis queue and executes jobs sequentially or in parallel.

## 2. Core Workers

### Webhook Processor (`whatsapp-webhooks`)
- **Responsibility**: Processes incoming message and status events from providers.
- **Key Logic**: `src/lib/services/messaging/webhook-processor.ts`
- **Why Background?**: Webhooks must respond with a 200 OK within seconds. Complex processing (parsing, DB upserts, socket emissions, bot triggers) is offloaded to this worker.

### Campaign Engine (`marketing-campaigns`)
- **Responsibility**: Handles high-volume message broadcasts to thousands of contacts.
- **Key Logic**: `src/lib/services/marketing/campaign-worker.ts`
- **Features**: Includes rate-limiting to comply with WhatsApp's Tier system and credit parking to prevent overspending.

### Billing & Autopay (`billing-tasks`)
- **Responsibility**: Processes subscription renewals, generates invoices, and handles autopay failures.
- **Key Logic**: `src/lib/services/billing/billing-worker.ts`
- **Maintenance**: Runs a daily `renewalCycle` to check for expiring subscriptions.

### Snooze Monitor (`conversation-snooze`)
- **Responsibility**: Automatically re-opens conversations that were "snoozed" by an agent.
- **Key Logic**: `src/lib/services/messaging/snooze-worker.ts`

### Integration Sync (`external-sync`)
- **Responsibility**: Periodically synchronizes data from external sources like Google Sheets or Zapier.
- **Key Logic**: `src/lib/services/integrations/integration-sync-worker.ts`

## 3. Monitoring & Management

- **Redis**: All job states (waiting, active, completed, failed) are stored in Redis.
- **Retries**: Most workers are configured with exponential backoff for failed jobs.
- **Cleanup**: Completed jobs are automatically pruned after a set period to save memory.

## 4. Local Development

If `SKIP_REDIS=true` is set in the environment, the application will attempt to bypass these queues for development simplicity, though some features like bulk campaigns may not function correctly.
