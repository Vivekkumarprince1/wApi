/**
 * Queue Name & Payload Registry
 *
 * Single source of truth for every BullMQ queue name and the shape of the
 * jobs that flow through it. Today these names are string literals scattered
 * across services (e.g. 'campaign-engine' is duplicated in the monolith and
 * campaign-service with a comment that says "Must match name in monolith").
 *
 * Import from here instead. A typo'd queue name then becomes a TypeScript
 * compile error rather than a silently-dead job. This is the same philosophy
 * as worker-bridge.ts — kill the "match string in two places" class of bug.
 */

export const QUEUE_NAMES = {
  /** Mass/broadcast messaging (server: bulkMessageWorker). */
  BULK_MESSAGES: "bulk-messages",
  /** Campaign engine — start/batch/check/cleanup (campaign-service + monolith). */
  CAMPAIGN_ENGINE: "campaign-engine",
  /** Inbound provider webhooks (server: webhook-processor). */
  WEBHOOKS: "webhooks",
  /** Contact/CSV import (server: importWorker). */
  IMPORT: "import",
  /** Snooze / scheduled re-open (server: snooze-worker). */
  SNOOZE: "snooze",
  /** Third-party integration sync (server: integration-sync-worker). */
  INTEGRATION_SYNC: "integration-sync",
  /** Answerbot site crawl (automation-service). */
  ANSWERBOT_CRAWL: "answerbot-crawl",
  /**
   * WABA provisioning after Meta Embedded Signup (bsp-service).
   * Today this runs synchronously inside the onboarding `completeSignup`
   * request (Gupshup app create + phone registration + webhook + templates).
   * Moving it onto a queue makes the slow multi-call flow retryable and keeps
   * the HTTP request fast. See OnboardingState in the monolith for the steps.
   */
  WABA_PROVISION: "waba-provision",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Job type discriminators used within the campaign-engine queue. */
export const CAMPAIGN_JOB_TYPES = {
  CAMPAIGN_START: "campaign-start",
  BATCH_PROCESS: "batch-process",
  CAMPAIGN_CHECK: "campaign-check",
  SCHEDULED_START: "scheduled-start",
  CLEANUP: "cleanup",
} as const;

export type CampaignJobType =
  (typeof CAMPAIGN_JOB_TYPES)[keyof typeof CAMPAIGN_JOB_TYPES];

/**
 * WABA provisioning step machine. Mirrors `OnboardingPipelineStatus` /
 * `workspace.onboardingStatus` in the monolith's onboarding-orchestrator so
 * the queued job and the persisted state stay in lockstep as provisioning
 * logic is extracted into bsp-service (Phase 2 BSP migration). The pipeline
 * is idempotent and resumable: a job carries the step to (re)start from, and
 * the worker advances the status field exactly as the orchestrator does today.
 */
export const WABA_PROVISION_STEPS = {
  NOT_STARTED: "NOT_STARTED",
  PROVISIONING_STARTED: "PROVISIONING_STARTED",
  APP_ASSIGNED: "APP_ASSIGNED",
  TOKEN_RESOLVED: "TOKEN_RESOLVED",
  CONTACTS_SET: "CONTACTS_SET",
  WEBHOOKS_CONFIGURED: "WEBHOOKS_CONFIGURED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type WabaProvisionStep =
  (typeof WABA_PROVISION_STEPS)[keyof typeof WABA_PROVISION_STEPS];

/**
 * Payload shapes per queue. Add fields here as workers evolve so producers
 * and consumers stay in lockstep. Use `JobPayload<typeof QUEUE_NAMES.X>` at
 * call sites for end-to-end typing of `queue.add(...)` and the worker fn.
 */
export interface QueuePayloads {
  [QUEUE_NAMES.BULK_MESSAGES]: {
    workspaceId: string;
    contactIds: string[];
    message?: unknown;
    channel?: string;
    template?: unknown;
    createdBy?: string;
  };
  [QUEUE_NAMES.CAMPAIGN_ENGINE]: {
    type: CampaignJobType;
    campaignId: string;
    workspaceId: string;
    batchId?: string;
    batchIndex?: number;
    enqueuedAt?: string;
  };
  [QUEUE_NAMES.WEBHOOKS]: { workspaceId?: string; provider: string; raw: unknown };
  [QUEUE_NAMES.IMPORT]: { workspaceId: string; fileId: string; createdBy?: string };
  [QUEUE_NAMES.SNOOZE]: { workspaceId: string; conversationId: string; wakeAt: string };
  [QUEUE_NAMES.INTEGRATION_SYNC]: { workspaceId: string; integrationId: string };
  [QUEUE_NAMES.ANSWERBOT_CRAWL]: { workspaceId: string; botId: string; url: string };
  [QUEUE_NAMES.WABA_PROVISION]: {
    workspaceId: string;
    /** Step to (re)start provisioning from; enables resuming a failed run. */
    step: WabaProvisionStep;
    /** From the Meta Embedded Signup callback. */
    wabaId: string;
    phoneNumberId: string;
    accessToken: string;
    businessId?: string;
    initiatedBy?: string;
  };
}

export type JobPayload<Q extends QueueName> = Q extends keyof QueuePayloads
  ? QueuePayloads[Q]
  : unknown;
