import { Worker, Job } from 'bullmq';
import { Contact, Message, Conversation, Workspace } from '../models';
import { InboxService } from '../services/messaging/inbox-service';
import { getConnectionForWorker } from '../utils/ioredis';
import { logger } from '../utils/logger';

/**
 * Bulk Message Worker
 *
 * Processes 'bulk-messages' queue for mass messaging campaigns.
 *
 * Previous version sent each recipient sequentially inside a single job
 * with no per-job concurrency, so a 10k-recipient send blocked for the
 * full duration. This version:
 *   - Processes recipients in chunks of `CHUNK_SIZE` concurrently.
 *   - Respects the workspace's `inboxSettings.agentMessagesPerMinute`
 *     throttle (with sane defaults).
 *   - Allows the BullMQ Worker itself to run several jobs in parallel via
 *     the `WORKER_CONCURRENCY` env var.
 *   - Adds per-job attempts with exponential backoff so transient
 *     provider errors don't drop the whole job.
 */

const WORKER_CONCURRENCY = Number(process.env.BULK_MESSAGE_WORKER_CONCURRENCY || 2);
const CHUNK_SIZE = Number(process.env.BULK_MESSAGE_CHUNK_SIZE || 25);
const DEFAULT_MPS = 10; // messages per second when workspace setting is missing

async function chunkPause(messagesInChunk: number, mps: number) {
  const seconds = messagesInChunk / Math.max(1, mps);
  const ms = Math.max(50, Math.round(seconds * 1000));
  await new Promise((r) => setTimeout(r, ms));
}

export const initBulkMessageWorker = () => {
  const worker = new Worker(
    'bulk-messages',
    async (job: Job) => {
      const { workspaceId, contactIds, message, channel, template, createdBy } = job.data;
      const total = Array.isArray(contactIds) ? contactIds.length : 0;
      logger.info('bulk-message job started', {
        jobId: job.id,
        workspaceId,
        total,
        channel,
      });

      // Throttle from workspace settings; fall back to a conservative
      // default so we don't burst against provider limits.
      const ws: any = await Workspace.findById(workspaceId)
        .select('inboxSettings')
        .lean();
      const mpm = ws?.inboxSettings?.agentMessagesPerMinute as number | undefined;
      const mps = mpm && mpm > 0 ? mpm / 60 : DEFAULT_MPS;

      let processed = 0;
      let failed = 0;

      const sendOne = async (contactId: string) => {
        try {
          const contact = await Contact.findOne({ _id: contactId, workspace: workspaceId });
          if (!contact) {
            failed++;
            return;
          }

          let conversation = await Conversation.findOne({
            workspace: workspaceId,
            contact: contactId,
            channel: channel || 'whatsapp',
          });

          if (!conversation) {
            conversation = await Conversation.create({
              workspace: workspaceId,
              contact: contactId,
              channel: channel || 'whatsapp',
              status: 'open',
              lastMessageDirection: 'outbound',
            });
          }

          if (template) {
            await InboxService.sendTemplateMessage({
              workspaceId,
              conversationId: conversation._id,
              agentId: createdBy,
              templateName: typeof template === 'string' ? template : template.name,
              languageCode: template.language?.code || 'en',
              variables: template.components || [],
            });
          } else if (channel === 'sms') {
            await InboxService.sendSmsMessage({
              workspaceId,
              conversationId: conversation._id,
              agentId: createdBy,
              text: message,
            });
          } else if (channel === 'email') {
            await InboxService.sendEmailMessage({
              workspaceId,
              conversationId: conversation._id,
              agentId: createdBy,
              subject: job.data.subject || 'Message from wApi',
              html: message,
            });
          } else {
            await InboxService.sendTextMessage({
              workspaceId,
              conversationId: conversation._id,
              agentId: createdBy,
              text: message,
            });
          }

          processed++;
        } catch (err: any) {
          failed++;
          logger.error('bulk-message recipient failed', {
            jobId: job.id,
            contactId,
            error: err?.message,
          });
        }
      };

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = contactIds.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map((id: string) => sendOne(id)));
        await job.updateProgress(Math.round(((processed + failed) / Math.max(1, total)) * 100));
        if (i + CHUNK_SIZE < total) {
          await chunkPause(chunk.length, mps);
        }
      }

      logger.info('bulk-message job completed', {
        jobId: job.id,
        workspaceId,
        processed,
        failed,
        total,
      });
      return { processed, failed, total };
    },
    {
      connection: getConnectionForWorker('bulkMessageWorker'),
      concurrency: WORKER_CONCURRENCY,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error('bulk-message job failed', {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: err?.message,
    });
  });

  return worker;
};
