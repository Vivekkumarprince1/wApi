import { Queue, Worker, Job } from 'bullmq';
import { LedgerService } from '../services/LedgerService';
import { redisClient } from '../lib/redis';
import { QUEUE_NAMES } from '@wapi/contracts';

// Queues
export const billingEventsQueue = new Queue(QUEUE_NAMES.BILLING_EVENTS, { connection: redisClient as any });
export const campaignEventsQueue = new Queue(QUEUE_NAMES.CAMPAIGN_EVENTS, { connection: redisClient as any }); // To send events to campaign service

const ledgerService = new LedgerService();

// Handlers
const handleCampaignCreated = async (data: any) => {
  console.log(`[EventBus] Handling CampaignCreated for ${data.campaignId}`);
  try {
    // 1. Reserve budget
    await ledgerService.reserveCampaignBudget(data.workspaceId, data.estimatedCost, data.campaignId);
    
    // 2. Emit Success Event
    await campaignEventsQueue.add('BudgetReservedEvent', {
      campaignId: data.campaignId,
      workspaceId: data.workspaceId,
      totalReservation: data.estimatedCost,
      contacts: data.contacts,
      templateId: data.templateId,
      templateSnapshot: data.templateSnapshot,
      variableMapping: data.variableMapping,
    });
    console.log(`[EventBus] Budget reserved for ${data.campaignId}`);
  } catch (error: any) {
    console.error(`[EventBus] Failed to reserve budget for ${data.campaignId}: ${error.message}`);
    // 3. Emit Failure Event (Compensation)
    await campaignEventsQueue.add('BudgetReservationFailedEvent', {
      campaignId: data.campaignId,
      workspaceId: data.workspaceId,
      reason: error.message
    });
  }
};

const handleCampaignCompleted = async (data: any) => {
  console.log(`[EventBus] Handling CampaignCompleted for ${data.campaignId}`);
  try {
    await ledgerService.settleCampaignBudget(
      data.workspaceId, 
      data.campaignId, 
      data.reservedAmount, 
      data.actualSpend
    );
    console.log(`[EventBus] Campaign ${data.campaignId} budget settled`);
  } catch (error: any) {
    console.error(`[EventBus] Failed to settle budget for ${data.campaignId}: ${error.message}`);
    // Will be automatically retried by BullMQ
    throw error;
  }
};

// Worker
export const billingEventWorker = new Worker(QUEUE_NAMES.BILLING_EVENTS, async (job: Job) => {
  switch (job.name) {
    case 'CampaignCreatedEvent':
      await handleCampaignCreated(job.data);
      break;
    case 'CampaignCompletedEvent':
      await handleCampaignCompleted(job.data);
      break;
    default:
      console.warn(`[EventBus] Unknown event type: ${job.name}`);
  }
}, { connection: redisClient as any });

billingEventWorker.on('failed', (job, err) => {
  console.error(`[EventBus] Job ${job?.id} failed with error ${err.message}`);
});

billingEventWorker.on('completed', (job) => {
  console.log(`[EventBus] Job ${job.id} (${job.name}) completed`);
});
