import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '@wapi/contracts';
import { Campaign, CampaignBatch, CampaignMessage, ICampaignModel, ICampaignBatchModel, Workspace } from "../models";
import { JOB_TYPES, CampaignQueueService } from "../lib/campaign-queue";
import { CampaignService } from "../services/CampaignService";
import { SegmentService } from "../services/SegmentService";
import { getSharedRedis } from "../lib/redis";
import { monolithWorkerBridge } from "../lib/monolith-worker-client";
import { Types } from "mongoose";

/**
 * CAMPAIGN WORKER (Microservice)
 * 
 * Consumes and processes campaign jobs.
 * This worker has been moved from the monolith to the microservice.
 * It uses a bridge to call monolith-only services (Messaging, Billing, Socket).
 */
export class CampaignWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(QUEUE_NAMES.CAMPAIGN_ENGINE, this.processJob.bind(this), {
      connection: getSharedRedis(),
      concurrency: 5,
    });

    this.worker.on('completed', (job) => {
      console.log(`[CampaignWorker] ✅ Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[CampaignWorker] ❌ Job ${job?.id} failed:`, err.message);
    });
  }

  private async processJob(job: Job) {
    try {
      console.log(`[CampaignWorker] Starting job ${job.id} (${job.name})`);
      switch (job.name) {
        case JOB_TYPES.CAMPAIGN_START:
          return await this.handleCampaignStart(job);
        case JOB_TYPES.BATCH_PROCESS:
          return await this.handleBatchProcess(job);
        case JOB_TYPES.CAMPAIGN_CHECK:
          return await this.handleMaintenance(job);
        default:
          console.warn(`[CampaignWorker] Unknown job type: ${job.name}`);
      }
    } catch (err: any) {
      console.error(`[CampaignWorker] CRITICAL ERROR in job ${job.id}:`, err.message);
      throw err;
    }
  }

  private async handleCampaignStart(job: Job) {
    const { campaignId, workspaceId } = job.data;
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    // 1. Pre-flight Validation (Bridged)
    const preflight = await monolithWorkerBridge.preflightValidate(workspaceId, campaign.template.toString(), campaign.contacts?.length || 0);
    if (!preflight.valid) {
        campaign.status = 'PAUSED';
        await (Campaign as ICampaignModel).addAuditEntry(campaignId, 'SYSTEM_PAUSED', { 
            reason: `Preflight failed: ${preflight.reason}`,
            systemInitiated: true
        });
        await campaign.save();

        await monolithWorkerBridge.socketBroadcast(workspaceId, 'campaign:status_update', {
          campaignId,
          status: 'PAUSED',
          reason: preflight.reason,
          updatedAt: campaign.updatedAt,
        });
        throw new Error(`PREFLIGHT_FAILED: ${preflight.reason}`);
    }

    console.log(`[CampaignWorker] 📦 Initializing campaign ${campaignId}...`);

    // 1. Resolve Contacts
    let contacts = campaign.contacts;
    if (campaign.recipientFilter?.type === 'segment' && campaign.recipientFilter.segmentId) {
        contacts = await SegmentService.resolveSegmentContacts(workspaceId, campaign.recipientFilter.segmentId);
    }

    // 2. Budget Parking (Bridged/Direct)
    const { template } = await monolithWorkerBridge.getTemplate(workspaceId, campaign.template.toString());
    
    // Fetch pricing from Billing Service
    const { serviceRequest } = await import('../lib/service-client');
    const pricingResponse = await serviceRequest('billing', {
      method: 'GET',
      url: `/api/billing/wallets/${workspaceId}/pricing`,
      params: { category: template?.category || 'MARKETING' }
    });
    if (pricingResponse.status !== 200) {
      throw new Error(pricingResponse.data?.error || pricingResponse.data?.message || 'Failed to fetch billing pricing');
    }
    const cost = pricingResponse.data.cost;

    const totalReservation = contacts.length * cost;

    // 2.5 Snapshot
    if (!campaign.templateSnapshot || !campaign.templateSnapshot.name) {

        campaign.templateSnapshot = {
            name: template?.name,
            category: template?.category,
            language: template?.language,
            headerType: template?.components?.find((c: any) => c.type === 'HEADER')?.format || 'TEXT'
        };
        await campaign.save();
    }

    // 3. Emit Saga Event to Billing Service
    const { billingEventsQueue } = await import('../lib/events/EventBus');
    await billingEventsQueue.add('CampaignCreatedEvent', {
      campaignId,
      workspaceId,
      estimatedCost: totalReservation,
      contacts,
      templateId: campaign.template.toString(),
      templateSnapshot: campaign.templateSnapshot,
      variableMapping: campaign.variableMapping
    });

    console.log(`[CampaignWorker] Emitted CampaignCreatedEvent for ${campaignId}. Waiting for BudgetReservedEvent...`);
    return { status: 'waiting_for_budget' };
  }

  private async handleBatchProcess(job: Job) {
    const { batchId, campaignId, workspaceId } = job.data;
    const batch = await (CampaignBatch as any).findById(batchId);
    const campaign = await Campaign.findById(campaignId);
    if (!batch || !campaign) throw new Error('Batch or Campaign not found');

    await (batch as any).markStarted();
    console.log(`[CampaignWorker] 📤 Processing batch ${batchId} index ${batch.batchIndex}...`);

    let successCount = 0;
    let failCount = 0;

    const workspace = await Workspace.findById(workspaceId).select('inboxSettings').lean() as any;
    const mps = workspace?.inboxSettings?.agentMessagesPerMinute ? workspace.inboxSettings.agentMessagesPerMinute / 60 : 10;
    
    const CONCURRENCY = 10;
    const activeRecipients = batch.recipients.filter((r: any) => !!r.contactId && (r.status === 'pending' || r.status === 'queued'));

    for (let i = 0; i < activeRecipients.length; i += CONCURRENCY) {
        const chunk = activeRecipients.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (recipient: any) => {
            try {
                const { contact } = await monolithWorkerBridge.getContact(workspaceId, recipient.contactId);
                if (!contact) return;

                const components: any[] = [];
                const mapping = batch.variableMapping || {};
                
                // Variable resolution (Body)
                const bodyMapping = mapping.body || (typeof mapping === 'object' && !mapping.body && !mapping.header ? mapping : null);
                if (bodyMapping) {
                    const bodyParams = Object.keys(bodyMapping).sort((a,b) => Number(a)-Number(b)).map(k => ({
                        type: 'text', text: String(this.resolveVar(contact, bodyMapping[k]) || '')
                    }));
                    if (bodyParams.length > 0) components.push({ type: 'body', parameters: bodyParams });
                }

                // Dispatch via Bridge
                const result = await monolithWorkerBridge.sendTemplate({
                  workspaceId,
                  to: contact.phone,
                  templateName: batch.templateName || 'template',
                  languageCode: (campaign.templateSnapshot as any)?.language,
                  components,
                  options: {
                    contactId: (contact as any)._id,
                    campaignId: (campaign as any)._id,
                    metadata: { batchId, batchIndex: batch.batchIndex }
                  }
                });

                if (result.success) {
                    successCount++;
                    const messageId = result.message?.whatsappMessageId || (result.result as any)?.messageId;
                    await (batch as any).updateRecipientStatus(contact._id.toString(), 'sent', messageId);
                    await CampaignMessage.findOneAndUpdate(
                      { campaign: campaignId, contact: contact._id },
                      { status: 'sent', whatsappMessageId: messageId, sentAt: new Date(), batchId: batch._id, batchIndex: batch.batchIndex },
                      { upsert: true }
                    );
                } else {
                    failCount++;
                    const error = result.result?.error || 'Unknown Error';
                    await (batch as any).updateRecipientStatus(contact._id.toString(), 'failed', null, error);
                    await CampaignMessage.findOneAndUpdate(
                      { campaign: campaignId, contact: contact._id },
                      { status: 'failed', failedAt: new Date(), failureReason: error, batchId: batch._id, batchIndex: batch.batchIndex },
                      { upsert: true }
                    );
                }
            } catch (err: any) {
                failCount++;
                await (batch as any).updateRecipientStatus(recipient.contactId, 'failed', null, err.message);
            }
        }));
        
        const chunkDelay = Math.max(50, (chunk.length / mps) * 1000);
        if (i + CONCURRENCY < activeRecipients.length) await new Promise(r => setTimeout(r, chunkDelay));
    }

    await (batch as any).markCompleted();

    // Updates
    await (Campaign as ICampaignModel).incrementTotal(campaignId.toString(), 'sent', successCount);
    await (Campaign as ICampaignModel).incrementTotal(campaignId.toString(), 'failed', failCount);
    const afterAudit = await (Campaign as ICampaignModel).addAuditEntry(campaignId.toString(), 'BATCH_COMPLETED', {
      reason: `Batch ${batch.batchIndex + 1} processed`,
      meta: { batchIndex: batch.batchIndex, successCount, failCount }
    });

    const batchStats = await (CampaignBatch as any).getCampaignBatchStats(campaignId);
    const isLastBatch = batchStats.completedBatches + batchStats.failedBatches >= batchStats.totalBatches;
    
    await monolithWorkerBridge.socketBroadcast(workspaceId, "campaign:batch_completed", { 
        campaignId, batchIndex: batch.batchIndex, successCount, failCount, isLastBatch,
        totals: afterAudit?.totals || campaign.totals
    });

    if (isLastBatch) {
        const finalized = await Campaign.findOneAndUpdate({ _id: campaignId, status: { $ne: 'COMPLETED' } }, { $set: { status: 'COMPLETED', completedAt: new Date() } }, { new: true });
        if (finalized) {
            const { template } = await monolithWorkerBridge.getTemplate(workspaceId, finalized.template.toString());
            const { cost } = await monolithWorkerBridge.getPricing(workspaceId, template?.category || 'MARKETING');
            
            const successAmount = (finalized.totals?.sent || 0) * cost;
            const failAmount = (finalized.totals?.failed || 0) * cost;
            
            const { billingEventsQueue } = await import('../lib/events/EventBus');
            await billingEventsQueue.add('CampaignCompletedEvent', {
              campaignId: campaignId.toString(),
              workspaceId,
              reservedAmount: (finalized.contacts?.length || 0) * cost, // Estimated original reservation
              actualSpend: successAmount // We only deduct actual successes
            });
            
            await monolithWorkerBridge.socketBroadcast(workspaceId, "campaign:status_update", { 
                campaignId, status: 'COMPLETED', updatedAt: finalized.updatedAt, totals: finalized.totals
            });
        }
    }

    return { successCount, failCount };
  }

  private resolveVar(contact: any, field: string): any {
    if (!field || typeof field !== 'string') return field;
    const parts = field.split('.');
    let curr = contact;
    for (const p of parts) { curr = curr?.[p]; }
    return curr || field;
  }

  private async handleMaintenance(job: Job) {
      console.log('[CampaignWorker] 🛠️ Running periodic maintenance...');
      const { CampaignScheduler } = await import("../services/CampaignScheduler");
      return await CampaignScheduler.processScheduledCampaigns();
  }
}
