"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WABA_PROVISION_STEPS = exports.CAMPAIGN_JOB_TYPES = exports.QUEUE_NAMES = void 0;
exports.QUEUE_NAMES = {
    /** Mass/broadcast messaging (server: bulkMessageWorker). */
    BULK_MESSAGES: "bulk-messages",
    /** Campaign engine — start/batch/check/cleanup (campaign-service + monolith). */
    CAMPAIGN_ENGINE: "campaign-engine",
    /** Inbound provider webhooks (server: webhook-processor). */
    WEBHOOKS: "whatsapp-webhooks",
    /** JSON-based contact import (server: importWorker). */
    IMPORT_JSON: "contact-imports",
    /** CSV-based contact import (server: contact-import-service). */
    IMPORT_CSV: "contact-import",
    /** Snooze / scheduled re-open (server: snooze-worker). */
    SNOOZE: "snooze-monitor",
    /** Third-party integration sync (server: integration-sync-worker). */
    INTEGRATION_SYNC: "integration-sync-queue",
    /** Answerbot site crawl (automation-service). */
    ANSWERBOT_CRAWL: "answerbot-crawl",
    /** Shared campaign events queue. */
    CAMPAIGN_EVENTS: "CampaignEventsQueue",
    /** Shared billing events queue. */
    BILLING_EVENTS: "BillingEventsQueue",
    /**
     * WABA provisioning after Meta Embedded Signup (bsp-service).
     * Today this runs synchronously inside the onboarding `completeSignup`
     * request (Gupshup app create + phone registration + webhook + templates).
     * Moving it onto a queue makes the slow multi-call flow retryable and keeps
     * the HTTP request fast. See OnboardingState in the monolith for the steps.
     */
    WABA_PROVISION: "waba-provision",
};
/** Job type discriminators used within the campaign-engine queue. */
exports.CAMPAIGN_JOB_TYPES = {
    CAMPAIGN_START: "campaign-start",
    BATCH_PROCESS: "batch-process",
    CAMPAIGN_CHECK: "campaign-check",
    SCHEDULED_START: "scheduled-start",
    CLEANUP: "cleanup",
};
/**
 * WABA provisioning step machine. Mirrors `OnboardingPipelineStatus` /
 * `workspace.onboardingStatus` in the monolith's onboarding-orchestrator so
 * the queued job and the persisted state stay in lockstep as provisioning
 * logic is extracted into bsp-service (Phase 2 BSP migration). The pipeline
 * is idempotent and resumable: a job carries the step to (re)start from, and
 * the worker advances the status field exactly as the orchestrator does today.
 */
exports.WABA_PROVISION_STEPS = {
    NOT_STARTED: "NOT_STARTED",
    PROVISIONING_STARTED: "PROVISIONING_STARTED",
    APP_ASSIGNED: "APP_ASSIGNED",
    TOKEN_RESOLVED: "TOKEN_RESOLVED",
    CONTACTS_SET: "CONTACTS_SET",
    WEBHOOKS_CONFIGURED: "WEBHOOKS_CONFIGURED",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
};
