import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Contact } from '../models';
import { normalizePhoneNumber } from '../utils/phone-utils';
import { UsageTracker } from '../services/workspace/usage-tracker';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

/**
 * Import Worker
 * 
 * Processes 'contact-imports' queue for large bulk uploads.
 */
export const initImportWorker = () => {
  const worker = new Worker('contact-imports', async (job: Job) => {
    const { contacts, workspaceId } = job.data;
    console.log(`[ImportWorker] Importing ${contacts.length} contacts for workspace ${workspaceId}`);

    const bulkOps = contacts.map((c: any) => ({
      updateOne: {
        filter: { workspace: workspaceId, phone: normalizePhoneNumber(c.phone) },
        update: {
          $setOnInsert: {
            workspace: workspaceId,
            name: c.name || "Valued Customer",
            phone: normalizePhoneNumber(c.phone),
            metadata: { email: c.email, ...c.metadata },
            tags: ['imported', ...(c.tags || [])],
            leadStatus: 'new',
            createdAt: new Date()
          }
        },
        upsert: true
      }
    }));

    const result = await Contact.bulkWrite(bulkOps);
    const imported = result.upsertedCount;

    if (imported > 0) {
      await UsageTracker.increment(workspaceId, 'contacts', imported);
    }

    return { imported, total: contacts.length };
  }, { connection });

  return worker;
};
