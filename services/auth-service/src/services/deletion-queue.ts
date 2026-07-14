import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import config from '../config/index.js';
import { DeletionOperation } from '../models/DeletionOperation.js';
import { DeletionOperationService } from './deletion-operation-service.js';

const queueName = 'workspace-deletion';
let queue: Queue | null = null;
let worker: Worker | null = null;

function connection() {
    return new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
}

export function getDeletionQueue() {
    if (!queue) {
        queue = new Queue(queueName, {
            connection: connection() as any,
            defaultJobOptions: {
                attempts: 8,
                backoff: { type: 'exponential', delay: 10_000 },
                removeOnComplete: { age: 30 * 24 * 3600, count: 5000 },
                removeOnFail: { age: 90 * 24 * 3600, count: 10000 },
            },
        });
    }
    return queue;
}

export async function enqueueDeletionOperation(operationId: string, runVersion = 1) {
    return getDeletionQueue().add(
        'delete-workspace',
        { operationId, runVersion },
        { jobId: `deletion:${operationId}:${runVersion}` },
    );
}

export async function startDeletionWorker() {
    await DeletionOperation.updateMany(
        { state: 'IN_PROGRESS', updatedAt: { $lt: new Date(Date.now() - 5 * 60_000) } },
        { $set: { state: 'RETRYING', nextRetryAt: new Date() } },
    );

    const recoverable = await DeletionOperation.find({
        state: { $in: ['REQUESTED', 'RETRYING', 'PARTIALLY_COMPLETED'] },
        $or: [{ nextRetryAt: { $exists: false } }, { nextRetryAt: { $lte: new Date() } }],
    }).select('operationId attempts').lean();
    for (const operation of recoverable) {
        await enqueueDeletionOperation(operation.operationId, Number(operation.attempts || 0) + 1);
    }

    worker = new Worker(queueName, async (job: Job) => {
        const operation = await DeletionOperationService.run(String(job.data.operationId));
        if (!operation) throw new Error('DELETION_OPERATION_NOT_FOUND');
        if (operation.state === 'PARTIALLY_COMPLETED' || operation.state === 'FAILED') {
            throw new Error(operation.lastError || 'DELETION_PARTIALLY_COMPLETED');
        }
        return { operationId: operation.operationId, state: operation.state };
    }, { connection: connection() as any, concurrency: 2 });

    worker.on('failed', (job, error) => {
        if (!job || job.attemptsMade < Number(job.opts.attempts || 1)) return;
        void DeletionOperation.updateOne(
            { operationId: job.data.operationId, state: { $ne: 'COMPLETED' } },
            { $set: { state: 'MANUAL_REVIEW', lastError: error.message } },
        );
    });
}

export async function stopDeletionQueue() {
    await worker?.close();
    await queue?.close();
}