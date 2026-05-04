import { Queue, Worker, Job } from 'bullmq';
import { getSharedRedis } from '../redis';
import { Campaign, ICampaignModel } from '../../models';
import { CampaignBatch, ICampaignBatchModel } from '../../models/CampaignBatch';
import { CampaignQueueService } from '../campaign-queue';
import { Workspace } from '../../models';
import { monolithWorkerBridge } from '../monolith-worker-client';

const connection = getSharedRedis();

// Queues
export const billingEventsQueue = new Queue('BillingEventsQueue', { connection });
export const campaignEventsQueue = new Queue('CampaignEventsQueue', { connection });

const handleBudgetReserved = async (data: any) => {
  const { campaignId, workspaceId, totalReservation, contacts, templateSnapshot, variableMapping, templateId } = data;
  console.log(`[CampaignEventBus] Budget reserved for campaign ${campaignId}. Creating batches...`);

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) return;

  try {
    // 3. Create Batches
    const batches = await (CampaignBatch as ICampaignBatchModel).createBatches(
        campaignId,
        workspaceId,
        contacts.map((id: any) => ({ _id: id })),
        templateId,
        templateSnapshot?.name || 'template',
        variableMapping,
        50
    );

    // Throttling Logic
    const workspace = await Workspace.findById(workspaceId).lean() as any;
    const mps = workspace?.inboxSettings?.agentMessagesPerMinute ? workspace.inboxSettings.agentMessagesPerMinute / 60 : 10;
    const delayPerBatch = Math.ceil((50 / mps) * 1000);

    for (let i = 0; i < batches.length; i++) {
        await CampaignQueueService.enqueueBatch(
            batches[i]._id,
            campaignId,
            workspaceId,
            i,
            i * delayPerBatch
        );
    }

    campaign.status = 'RUNNING';
    campaign.startedAt = new Date();
    await campaign.save();
    
    await monolithWorkerBridge.socketBroadcast(workspaceId, "campaign:status_update", { 
        campaignId, 
        status: 'RUNNING',
        totalBatches: batches.length,
        updatedAt: campaign.updatedAt,
        startedAt: campaign.startedAt
    });
  } catch (error) {
    console.error(`[CampaignEventBus] Error creating batches:`, error);
  }
};

const handleBudgetReservationFailed = async (data: any) => {
  const { campaignId, workspaceId, reason } = data;
  console.log(`[CampaignEventBus] Budget reservation failed for ${campaignId}: ${reason}`);

  const campaign = await Campaign.findById(campaignId);
  if (campaign) {
    campaign.status = 'PAUSED';
    await (Campaign as ICampaignModel).addAuditEntry(campaignId, 'SYSTEM_PAUSED', { 
        reason: `Budget failed: ${reason}`,
        systemInitiated: true
    });
    await campaign.save();

    await monolithWorkerBridge.socketBroadcast(workspaceId, 'campaign:status_update', {
      campaignId,
      status: 'PAUSED',
      reason,
      updatedAt: campaign.updatedAt,
    });
  }
};

export const campaignEventWorker = new Worker('CampaignEventsQueue', async (job: Job) => {
  switch (job.name) {
    case 'BudgetReservedEvent':
      await handleBudgetReserved(job.data);
      break;
    case 'BudgetReservationFailedEvent':
      await handleBudgetReservationFailed(job.data);
      break;
    default:
      console.warn(`[CampaignEventBus] Unknown event type: ${job.name}`);
  }
}, { connection });
