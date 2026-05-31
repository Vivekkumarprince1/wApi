import { Worker, Job } from 'bullmq';
import { Contact } from '../models';
import { normalizePhoneNumber } from '../utils/phone-utils';
import { UsageTracker } from '../services/workspace/usage-tracker';
import { getConnectionForWorker } from '../utils/ioredis';
import { logger } from '../utils/logger';

/**
 * Import Worker
 *
 * Processes 'contact-imports' queue for large bulk uploads.
 *
 * Previous version sent the whole array to a single `bulkWrite` call,
 * which risked hitting MongoDB's 16MB BSON limit on large CSVs and
 * blocking the worker for the entire write. We now chunk into batches of
 * `IMPORT_BATCH_SIZE` (default 1000) and report progress per chunk.
 */

const IMPORT_BATCH_SIZE = Number(process.env.IMPORT_BATCH_SIZE || 1000);
const IMPORT_WORKER_CONCURRENCY = Number(process.env.IMPORT_WORKER_CONCURRENCY || 1);

export const initImportWorker = () => {
  const worker = new Worker(
    'contact-imports',
    async (job: Job) => {
      const { contacts, workspaceId } = job.data;
      const total = Array.isArray(contacts) ? contacts.length : 0;
      logger.info('contact-import job started', { jobId: job.id, workspaceId, total });

      let imported = 0;
      let processed = 0;

      for (let i = 0; i < total; i += IMPORT_BATCH_SIZE) {
        const slice = contacts.slice(i, i + IMPORT_BATCH_SIZE);
        const bulkOps = slice.map((c: any) => ({
          updateOne: {
            filter: { workspace: workspaceId, phone: normalizePhoneNumber(c.phone) },
            update: {
              $setOnInsert: {
                workspace: workspaceId,
                name: c.name || 'Valued Customer',
                phone: normalizePhoneNumber(c.phone),
                metadata: { email: c.email, ...c.metadata },
                tags: ['imported', ...(c.tags || [])],
                leadStatus: 'new',
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        }));

        try {
          const result = await Contact.bulkWrite(bulkOps, { ordered: false });
          imported += result.upsertedCount || 0;
        } catch (err: any) {
          // Continue on per-batch errors so a single bad row doesn't fail
          // the whole import; log details for follow-up.
          logger.error('contact-import batch failed', {
            jobId: job.id,
            workspaceId,
            batchStart: i,
            batchSize: slice.length,
            error: err?.message,
          });
        }

        processed += slice.length;
        await job.updateProgress(Math.round((processed / Math.max(1, total)) * 100));
      }

      if (imported > 0) {
        await UsageTracker.increment(workspaceId, 'contacts', imported);
      }

      logger.info('contact-import job completed', {
        jobId: job.id,
        workspaceId,
        imported,
        total,
      });
      return { imported, total };
    },
    {
      connection: getConnectionForWorker('importWorker') as any,
      concurrency: IMPORT_WORKER_CONCURRENCY,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('contact-import job failed', {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: err?.message,
    });
  });

  return worker;
};
