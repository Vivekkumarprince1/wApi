import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import mongoose from 'mongoose';
import { AutomationRule } from '../models';
import { FlowExecutorService } from '../services/flow-executor';

/**
 * Automation Scheduler
 *
 * Runs every minute and looks for enabled automation rules whose trigger
 * is time-based (e.g. `trigger.event === 'schedule'`). For each due rule
 * it enqueues a `run-rule` job that the engine consumes.
 *
 * The previous version of this service had no scheduler at all, so any
 * rule whose trigger was supposed to fire on a schedule never ran.
 *
 * Implementation notes:
 * - Uses BullMQ's repeatable jobs so the heartbeat survives restarts
 *   (Redis stores the next-run time).
 * - Idempotency: each due rule is enqueued with a job id derived from
 *   `{ruleId}:{HHMM}` so multiple scheduler instances don't duplicate.
 * - The actual run logic lives in `automationRuleWorker` (placeholder
 *   below) — wire it to your existing `WorkflowService.execute` once the
 *   shape stabilises.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const HEARTBEAT_QUEUE = 'automation-scheduler';
const RUN_QUEUE = 'automation-engine-runs';

const heartbeatConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const runConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const heartbeatQueue = new Queue(HEARTBEAT_QUEUE, { connection: heartbeatConnection });
const runQueue = new Queue(RUN_QUEUE, {
  connection: runConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 1000, age: 24 * 3600 },
    removeOnFail: { count: 1000, age: 7 * 24 * 3600 },
  },
});

function isDue(rule: any, now: Date): boolean {
  // Minimal due-check. Extend with real cron parsing if rules carry a
  // `trigger.config.cron` field. For now we recognise:
  //   - trigger.event === 'schedule' && trigger.config.intervalMinutes
  //   - trigger.event === 'schedule' && trigger.config.atMinute (0-59) for hourly
  if (rule.trigger?.event !== 'schedule') return false;
  const cfg = rule.trigger.config || {};
  if (typeof cfg.intervalMinutes === 'number' && cfg.intervalMinutes > 0) {
    return now.getUTCMinutes() % cfg.intervalMinutes === 0;
  }
  if (typeof cfg.atMinute === 'number') {
    return now.getUTCMinutes() === cfg.atMinute;
  }
  return false;
}

async function dispatchDueRules() {
  if (mongoose.connection.readyState !== 1) return;
  const now = new Date();

  const candidates = await AutomationRule.find({
    enabled: true,
    'trigger.event': 'schedule',
  }).lean();

  for (const rule of candidates) {
    if (!isDue(rule, now)) continue;
    const jobId = `rule:${rule._id}:${now.getUTCFullYear()}${now.getUTCMonth()}${now.getUTCDate()}${now.getUTCHours()}${now.getUTCMinutes()}`;
    await runQueue.add(
      'run-rule',
      {
        ruleId: String(rule._id),
        workspaceId: String(rule.workspace),
        scheduledAt: now.toISOString(),
      },
      { jobId }
    );
  }
}

let started = false;

/**
 * Start the scheduler. Idempotent — calling twice is a no-op.
 */
export async function startScheduler() {
  if (started) return;
  started = true;

  // Run a heartbeat every 60 seconds. BullMQ stores the next-run time so
  // the cadence survives restarts and is shared across instances.
  await heartbeatQueue.add(
    'tick',
    {},
    {
      repeat: { every: 60_000 },
      jobId: 'automation-scheduler-tick',
      removeOnComplete: true,
      removeOnFail: true,
    }
  );

  new Worker(
    HEARTBEAT_QUEUE,
    async (_job: Job) => {
      try {
        await dispatchDueRules();
      } catch (err: any) {
        console.error('[automation-scheduler] dispatchDueRules failed:', err?.message);
      }
    },
    { connection: new IORedis(REDIS_URL, { maxRetriesPerRequest: null }) }
  );

  // Real run worker. Executes the visual workflow graph when triggered by schedule.
  new Worker(
    RUN_QUEUE,
    async (job: Job) => {
      const { ruleId, workspaceId } = job.data || {};
      console.log(`[automation-scheduler] run-rule fired ruleId=${ruleId} workspaceId=${workspaceId}`);
      try {
        await FlowExecutorService.execute(ruleId, {
          eventType: 'schedule',
          workspaceId,
        });
      } catch (err: any) {
        console.error(`[automation-scheduler] Failed to execute scheduled rule ${ruleId}:`, err.message);
      }
    },
    { connection: new IORedis(REDIS_URL, { maxRetriesPerRequest: null }) }
  );

  console.log('[automation-scheduler] started — heartbeat every 60s');
}
