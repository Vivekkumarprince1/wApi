import { Worker, Queue, QueueEvents } from 'bullmq';
import { getSharedConnection } from '../../utils/ioredis';
import { Integration } from '../../models/integration/Integration';
import { GoogleSheetsService } from './google-sheets-service';
import { PetpoojaService } from './petpooja-service';
import dbConnect from '../../db-connect';

const SYNC_QUEUE_NAME = 'integration-sync-queue';

export class IntegrationSyncWorker {
  private worker: Worker;
  private queue: Queue;

  constructor() {
    this.queue = new Queue(SYNC_QUEUE_NAME, { connection: getSharedConnection() as any });
    
    this.worker = new Worker(
      SYNC_QUEUE_NAME,
      async (job) => {
        await dbConnect();
        const { type } = job.data;
        console.log(`[IntegrationSyncWorker] 🔄 Running sync for all ${type} integrations...`);
        
        const activeIntegrations = await Integration.find({ 
          type, 
          status: 'connected' 
        });

        for (const integration of activeIntegrations) {
          try {
            if (type === 'google_sheets') {
              await GoogleSheetsService.syncRows(integration.workspace.toString());
            } else if (type === 'petpooja') {
              await PetpoojaService.syncOrders(integration.workspace.toString());
            }
          } catch (err: any) {
            console.error(`[IntegrationSyncWorker] Failed for ${integration._id}:`, err.message);
          }
        }
      },
      { connection: getSharedConnection() as any, concurrency: 1 }
    );

    this.setupRepeatableJobs();
  }

  private async setupRepeatableJobs() {
    // Sync Google Sheets every 15 minutes
    await this.queue.add(
      'sync-google-sheets', 
      { type: 'google_sheets' }, 
      { 
        repeat: { pattern: '*/15 * * * *' }, // Cron: Every 15 mins
        jobId: 'repeatable-gs-sync'
      }
    );

    // Sync Petpooja every 5 minutes
    await this.queue.add(
      'sync-petpooja', 
      { type: 'petpooja' }, 
      { 
        repeat: { pattern: '*/5 * * * *' }, // Cron: Every 5 mins
        jobId: 'repeatable-petpooja-sync'
      }
    );

    console.log('[IntegrationSyncWorker] 📅 Repeatable sync jobs scheduled.');
  }

  async stop() {
    await this.worker.close();
  }
}
