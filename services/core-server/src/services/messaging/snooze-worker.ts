import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Conversation } from "@/models";
import dbConnect from "@/db-connect";
import { getIO } from "../socket-bridge";
import { getConnectionForWorker } from '../../utils/ioredis';
import { QUEUE_NAMES } from '@wapi/contracts';

const connection = getConnectionForWorker('client');

/**
 * SNOOZE WORKER
 * 
 * Periodically checks for snoozed conversations that need to be reopened.
 */
export class SnoozeWorker {
  private worker: Worker;
  private interval: NodeJS.Timeout | null = null;

  constructor() {
    // We use a regular BullMQ worker structure, but we also initiate a local timer
    // to periodically "pulse" the check if we aren't using a separate scheduler.
    this.worker = new Worker(QUEUE_NAMES.SNOOZE, this.processJob.bind(this), {
      connection: connection as any,
    });

    console.log('[SnoozeWorker] 🚀 Snooze monitor started');
    
    // Start pulse every 60 seconds
    this.startPulse();
  }

  private startPulse() {
    this.interval = setInterval(async () => {
        try {
            await this.checkExpiredSnoozes();
        } catch (err: any) {
            console.error('[SnoozeWorker] Pulse error:', err.message);
        }
    }, 60000); // Check every minute
  }

  private async processJob(job: Job) {
    if (job.name === 'check-snoozes') {
        return await this.checkExpiredSnoozes();
    }
  }

  public async checkExpiredSnoozes() {
    await dbConnect();
    const now = new Date();

    // Find conversations snoozed and expired
    const expired = await Conversation.find({
      status: 'snoozed',
      snoozedUntil: { $lte: now }
    });

    if (expired.length === 0) return;

    console.log(`[SnoozeWorker] ⏰ Found ${expired.length} expired snoozes. Reopening...`);

    const io = getIO();

    for (const conv of expired) {
      conv.status = 'open';
      conv.snoozedUntil = undefined;
      await conv.save();

      // Broadcast reopening via socket
      if (io) {
        const payload = {
          conversationId: conv._id,
          action: 'unsnooze',
          conversation: conv.toObject()
        };

        io.to(`workspace:${conv.workspace}`).emit('inbox:conversation_updated', payload);
        
        io.to(`workspace:${conv.workspace}`).emit('inbox:reopened', {
          conversationId: conv._id,
          reason: 'snooze_expired'
        });
      }
    }

    return { reopened: expired.length };
  }

  public stop() {
    if (this.interval) clearInterval(this.interval);
    this.worker.close();
  }
}
