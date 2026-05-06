/**
 * Bulk Operations Service
 * Handles large-scale contact and messaging operations with BullMQ
 * Provides progress tracking and real-time updates via Socket.io
 */

import { Queue, Job, Worker } from 'bullmq';
import redis from '../redis';
import { realTimeEventService } from './real-time-event-service';
import { Contact, Conversation, Message } from '../models';

export type BulkOperationType =
  | 'create_contacts'
  | 'update_contacts'
  | 'delete_contacts'
  | 'tag_contacts'
  | 'send_messages'
  | 'export_contacts';

export interface BulkOperationData {
  workspaceId: string;
  userId: string;
  operationType: BulkOperationType;
  itemIds?: string[];
  items?: Record<string, any>[];
  payload?: Record<string, any>;
  totalCount: number;
}

export interface BulkOperationProgress {
  jobId: string;
  operationType: BulkOperationType;
  status: 'started' | 'in-progress' | 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  percentComplete: number;
  errors: Array<{ index: number; error: string }>;
  startedAt: Date;
  completedAt?: Date;
  speed: number;
  estimatedTimeRemaining: number;
}

const BATCH_SIZE = 50;

export class BulkOperationsService {
  private bulkQueue: Queue;
  private progressMap: Map<string, BulkOperationProgress>;

  constructor() {
    this.bulkQueue = new Queue('bulk-operations', {
      connection: redis,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 7200, // Keep for 2 hours
        },
      },
    });

    this.progressMap = new Map();
    this.initializeWorker();
  }

  /**
   * Queue a bulk operation
   */
  async queueOperation(data: BulkOperationData): Promise<string> {
    const job = await this.bulkQueue.add(`bulk-${Date.now()}`, data);

    // Initialize progress
    const progress: BulkOperationProgress = {
      jobId: job.id!,
      operationType: data.operationType,
      status: 'started',
      totalItems: data.totalCount,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      percentComplete: 0,
      errors: [],
      startedAt: new Date(),
      speed: 0,
      estimatedTimeRemaining: 0,
    };

    this.progressMap.set(job.id!, progress);
    await redis.setex(
      `bulk-op:${job.id}`,
      7200,
      JSON.stringify(progress)
    );

    return job.id!;
  }

  /**
   * Get operation progress
   */
  async getProgress(jobId: string): Promise<BulkOperationProgress | null> {
    if (this.progressMap.has(jobId)) {
      return this.progressMap.get(jobId) || null;
    }

    const cached = await redis.get(`bulk-op:${jobId}`);
    if (cached) {
      const progress = JSON.parse(cached) as BulkOperationProgress;
      this.progressMap.set(jobId, progress);
      return progress;
    }

    return null;
  }

  /**
   * Initialize BullMQ worker
   */
  private initializeWorker() {
    const worker = new Worker(
      'bulk-operations',
      async (job: Job) => {
        const { workspaceId, operationType, items, itemIds, payload, totalCount } = job.data;
        const progress = this.progressMap.get(job.id!)!;
        progress.status = 'in-progress';

        const startTime = Date.now();

        try {
          switch (operationType) {
            case 'create_contacts':
              await this.bulkCreateContacts(workspaceId, items || [], progress, job);
              break;

            case 'update_contacts':
              await this.bulkUpdateContacts(workspaceId, items || [], progress, job);
              break;

            case 'delete_contacts':
              await this.bulkDeleteContacts(workspaceId, itemIds || [], progress, job);
              break;

            case 'tag_contacts':
              await this.bulkTagContacts(
                workspaceId,
                itemIds || [],
                payload?.tags || [],
                progress,
                job
              );
              break;

            case 'send_messages':
              await this.bulkSendMessages(
                workspaceId,
                items || [],
                payload || {},
                progress,
                job
              );
              break;

            default:
              throw new Error(`Unknown operation type: ${operationType}`);
          }

          progress.status = 'completed';
          progress.completedAt = new Date();
        } catch (error) {
          progress.status = 'failed';
          progress.errors.push({
            index: 0,
            error: (error as Error).message,
          });
          throw error;
        }

        await this.updateAndEmitProgress(workspaceId, progress);

        return {
          successful: progress.successfulItems,
          failed: progress.failedItems,
          total: progress.totalItems,
        };
      },
      {
        connection: redis,
        concurrency: 3,
      }
    );
  }

  /**
   * Bulk create contacts
   */
  private async bulkCreateContacts(
    workspaceId: string,
    contacts: Record<string, any>[],
    progress: BulkOperationProgress,
    job: Job
  ) {
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((contact) =>
          Contact.create({
            ...contact,
            workspaceId,
            source: 'bulk-import',
          })
        )
      );

      results.forEach((result) => {
        progress.processedItems++;
        if (result.status === 'fulfilled') {
          progress.successfulItems++;
        } else {
          progress.failedItems++;
          if (progress.errors.length < 10) {
            progress.errors.push({
              index: progress.processedItems,
              error: (result.reason as Error).message,
            });
          }
        }
      });

      await this.updateAndEmitProgress(workspaceId, progress);
    }
  }

  /**
   * Bulk update contacts
   */
  private async bulkUpdateContacts(
    workspaceId: string,
    updates: Array<{ id: string; data: Record<string, any> }>,
    progress: BulkOperationProgress,
    job: Job
  ) {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(({ id, data }) =>
          Contact.findByIdAndUpdate(id, data, { new: true })
        )
      );

      results.forEach((result) => {
        progress.processedItems++;
        if (result.status === 'fulfilled') {
          progress.successfulItems++;
        } else {
          progress.failedItems++;
        }
      });

      await this.updateAndEmitProgress(workspaceId, progress);
    }
  }

  /**
   * Bulk delete contacts
   */
  private async bulkDeleteContacts(
    workspaceId: string,
    contactIds: string[],
    progress: BulkOperationProgress,
    job: Job
  ) {
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batch = contactIds.slice(i, i + BATCH_SIZE);

      // Delete conversations and messages too
      const conversationIds = await Conversation.find({
        contact: { $in: batch },
        workspaceId,
      }).select('_id');

      await Message.deleteMany({
        conversation: { $in: conversationIds },
      });

      const results = await Promise.allSettled(
        batch.map((id) => Contact.findByIdAndDelete(id))
      );

      results.forEach((result) => {
        progress.processedItems++;
        if (result.status === 'fulfilled') {
          progress.successfulItems++;
        } else {
          progress.failedItems++;
        }
      });

      await this.updateAndEmitProgress(workspaceId, progress);
    }
  }

  /**
   * Bulk tag contacts
   */
  private async bulkTagContacts(
    workspaceId: string,
    contactIds: string[],
    tags: string[],
    progress: BulkOperationProgress,
    job: Job
  ) {
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batch = contactIds.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((id) =>
          Contact.findByIdAndUpdate(
            id,
            { $addToSet: { tags: { $each: tags } } },
            { new: true }
          )
        )
      );

      results.forEach((result) => {
        progress.processedItems++;
        if (result.status === 'fulfilled') {
          progress.successfulItems++;
        } else {
          progress.failedItems++;
        }
      });

      await this.updateAndEmitProgress(workspaceId, progress);
    }
  }

  /**
   * Bulk send messages
   */
  private async bulkSendMessages(
    workspaceId: string,
    items: Array<{ conversationId: string; text: string }>,
    payload: Record<string, any>,
    progress: BulkOperationProgress,
    job: Job
  ) {
    // This is a placeholder - actual implementation depends on your messaging service
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async ({ conversationId, text }) => {
          // Call your messaging service
          // await messagingService.sendMessage(conversationId, text, payload)
          return { conversationId, status: 'sent' };
        })
      );

      results.forEach((result) => {
        progress.processedItems++;
        if (result.status === 'fulfilled') {
          progress.successfulItems++;
        } else {
          progress.failedItems++;
        }
      });

      await this.updateAndEmitProgress(workspaceId, progress);
    }
  }

  /**
   * Update progress and emit Socket event
   */
  private async updateAndEmitProgress(
    workspaceId: string,
    progress: BulkOperationProgress
  ) {
    // Calculate metrics
    const elapsed = (Date.now() - progress.startedAt.getTime()) / 1000;
    progress.speed = progress.processedItems / elapsed;
    progress.percentComplete = Math.round(
      (progress.processedItems / progress.totalItems) * 100
    );
    progress.estimatedTimeRemaining =
      (progress.totalItems - progress.processedItems) / progress.speed;

    // Update cache
    this.progressMap.set(progress.jobId, progress);
    await redis.setex(
      `bulk-op:${progress.jobId}`,
      7200,
      JSON.stringify(progress)
    );

    // Emit Socket event
    await realTimeEventService.emitBulkOperationProgress(
      workspaceId,
      progress.jobId,
      progress.percentComplete,
      progress.totalItems,
      progress.processedItems,
      progress.status
    );
  }
}

export const bulkOperationsService = new BulkOperationsService();
